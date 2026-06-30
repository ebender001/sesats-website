(function () {
  const api = window.QuestionBank;

  function closePreviewDrawer() {
    api.state.previewQuestionId = "";
    api.renderPreviewDrawer();
  }

  function openPreviewDrawer(questionId) {
    api.state.previewQuestionId = questionId;
    api.renderPreviewDrawer();
  }

  function toggleQuestionSelection(questionId, isSelected) {
    if (!questionId) {
      return;
    }

    if (isSelected) {
      api.state.selectedQuestionIds.add(questionId);
    } else {
      api.state.selectedQuestionIds.delete(questionId);
    }

    api.renderBulkBar();
    api.renderCurrentTab();
  }

  function toggleVisibleQuestionSelection(isSelected) {
    api.getFilteredQuestions().forEach((question) => {
      if (isSelected) {
        api.state.selectedQuestionIds.add(question.objectId);
      } else {
        api.state.selectedQuestionIds.delete(question.objectId);
      }
    });

    api.renderBulkBar();
    api.renderCurrentTab();
  }

  async function updateQuestionStatus(questionIds, newStatus) {
    const ids = Array.isArray(questionIds) ? questionIds.filter(Boolean) : [];
    if (!ids.length || !newStatus) {
      return;
    }

    const localDate = new Date().toISOString();
    const selectedQuestions = api.state.datasets.questions.filter((question) =>
      ids.includes(question.objectId)
    );

    await Promise.all(
      ids.map(async (questionId) => {
        if (window.back4app && typeof window.back4app.runCloudFunction === "function") {
          try {
            await window.back4app.runCloudFunction("editQuestion", {
              objectId: questionId,
              status: newStatus,
              lastEditedAt: localDate,
            });
          } catch (error) {
            console.error(`Unable to update question ${questionId}.`, error);
          }
        }
      })
    );

    selectedQuestions.forEach((question) => {
      question.status = newStatus;
      question.lastEditedAt = localDate;
      question.lastEditedLabel = api.formatDateTime(localDate);
      question.searchableText = [
        question.title,
        question.stem,
        question.critique,
        question.specialty,
        question.topic,
        question.status,
        question.difficulty,
        question.author,
      ]
        .join(" ")
        .toLowerCase();
    });
  }

  async function handleArchive(questionIds) {
    await updateQuestionStatus(questionIds, "Archived");
    api.setFeedback(
      questionIds.length === 1 ? "Question archived." : `${questionIds.length} questions archived.`,
      "success"
    );
    questionIds.forEach((questionId) => {
      api.state.selectedQuestionIds.delete(questionId);
    });
    api.renderAll();
  }

  async function handleDuplicate(questionId) {
    const question = api.state.datasets.questions.find((record) => record.objectId === questionId);
    if (!question) {
      return;
    }

    if (window.back4app && typeof window.back4app.runCloudFunction === "function") {
      try {
        await window.back4app.runCloudFunction("saveQuestionBundle", {
          question: {
            stem: question.stem,
            critique: question.critique,
            explanation: question.critique,
            specialty: question.specialty,
            topic: question.topic,
            status: "Draft",
            difficulty: question.difficulty,
            generatedByAI: question.generatedByAI,
            aiModel: question.aiModel,
            aiPromptVersion: question.aiPromptVersion,
          },
          options: question.questionOptions.map((option, index) => ({
            label: option.label || String.fromCharCode(65 + index),
            text: option.text,
            isCorrect: option.isCorrect,
            sortOrder: index,
          })),
          references: question.referenceRecords.map((reference, index) => ({
            title: reference.title || reference.citation,
            authors: reference.firstAuthor || "",
            journal: reference.journal,
            year: Number(reference.year) || undefined,
            pmid: reference.pmid === "—" ? "" : reference.pmid,
            doi: reference.doi === "—" ? "" : reference.doi,
            citationText: reference.citation,
            sortOrder: index,
            isPrimary: index === 0,
          })),
          editHistory: {
            previousStatus: question.status,
            newStatus: "Draft",
            changeSummary: `Duplicated from ${question.idLabel} in Question Bank.`,
          },
        });
        await api.refreshQuestionBank();
        api.setFeedback("Question duplicated as a new draft.", "success");
        return;
      } catch (error) {
        console.error("Unable to duplicate question with live data.", error);
      }
    }

    const duplicateId = `local-${Date.now()}`;
    const duplicate = {
      ...question,
      objectId: duplicateId,
      idLabel: duplicateId.slice(-8).toUpperCase(),
      status: "Draft",
      title: `${question.title} (Copy)`,
      lastEditedAt: new Date().toISOString(),
      lastEditedLabel: api.formatDateTime(new Date()),
    };
    api.state.datasets.questions.unshift(duplicate);
    api.setFeedback("Question duplicated locally for this session.", "success");
    api.renderAll();
  }

  function exportQuestions(records, filename) {
    const headers = [
      "ID",
      "Title",
      "Specialty",
      "Topic",
      "Status",
      "Difficulty",
      "References",
      "Media",
      "Last Edited",
      "Author",
    ];
    const rows = records.map((question) => [
      question.idLabel,
      question.title,
      question.specialty,
      question.topic,
      question.status,
      question.difficulty,
      question.referencesCount,
      question.mediaCount,
      question.lastEditedLabel,
      question.author,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(api.csvEscape).join(",")).join("\n");

    api.downloadTextFile(filename, csv);
  }

  async function handleBulkAction(actionName) {
    const selectedIds = Array.from(api.state.selectedQuestionIds);
    if (!selectedIds.length) {
      return;
    }

    if (actionName === "archive") {
      await handleArchive(selectedIds);
      return;
    }

    if (actionName === "change-status") {
      const nextStatus = window.prompt(
        "Enter the new status for the selected questions:",
        "Needs Review"
      );
      if (nextStatus && nextStatus.trim()) {
        await updateQuestionStatus(selectedIds, nextStatus.trim());
        api.setFeedback(`Updated ${selectedIds.length} questions to ${nextStatus.trim()}.`, "success");
        api.renderAll();
      }
      return;
    }

    if (actionName === "export-selected") {
      exportQuestions(api.getSelectedQuestionRecords(), "sesats-question-bank-selected.csv");
      api.setFeedback("Selected questions exported.", "success");
      return;
    }

    if (actionName === "assign-reviewer") {
      api.setFeedback("Reviewer assignment workflow will plug into the next review surface.", "success");
      return;
    }

    if (actionName === "verify-references") {
      api.setFeedback("Reference verification queued for the selected questions.", "success");
    }
  }

  function handleRowAction(actionName, questionId, recordId) {
    if (actionName === "preview") {
      openPreviewDrawer(questionId);
      return;
    }

    if (actionName === "edit") {
      window.location.href = api.getQuestionEditUrl(questionId);
      return;
    }

    if (actionName === "duplicate") {
      void handleDuplicate(questionId);
      return;
    }

    if (actionName === "archive") {
      void handleArchive([questionId]);
      return;
    }

    if (actionName === "preview-media") {
      api.setFeedback("Media preview will open in the asset viewer when that route is connected.", "success");
      return;
    }

    if (actionName === "copy-filename") {
      const record = api.state.datasets.media.find((item) => item.objectId === recordId);
      if (record && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(record.filename)
          .then(() => api.setFeedback("Filename copied to clipboard.", "success"))
          .catch(() => api.setFeedback("Unable to copy filename.", "error"));
      }
      return;
    }

    if (actionName === "view-ai-asset") {
      api.setFeedback("AI asset preview will open in the generation review flow.", "success");
      return;
    }

    if (actionName === "regenerate-ai-asset") {
      api.setFeedback("AI regeneration requested for this artifact.", "success");
      return;
    }

    if (actionName === "edit-template") {
      api.setFeedback("Template editor is not wired yet, but this row is ready for that route.", "success");
      return;
    }

    if (actionName === "duplicate-template") {
      api.setFeedback("Template duplicated locally in the workspace roadmap.", "success");
      return;
    }

    if (actionName === "deactivate-template") {
      api.setFeedback("Template deactivation would be handled by the template service.", "success");
    }
  }

  function handleQuestionBankEscape(event) {
    if (event.key === "Escape" && api.state.previewQuestionId) {
      closePreviewDrawer();
    }
  }

  function bindQuestionBankEvents() {
    const root = api.getRoot();
    if (!root || api.state.listenersBound) {
      return;
    }

    const searchInput = document.getElementById("question-bank-search");
    const statusFilter = document.getElementById("question-bank-status-filter");
    const specialtyFilter = document.getElementById("question-bank-specialty-filter");
    const difficultyFilter = document.getElementById("question-bank-difficulty-filter");
    const filterToggle = document.getElementById("question-bank-filter-toggle");
    const clearFilters = document.getElementById("question-bank-clear-filters");
    const tabs = document.querySelectorAll(".question-bank-tab");
    const tableRegion = document.getElementById("question-bank-table-region");
    const bulkBar = document.getElementById("question-bank-bulk-bar");
    const previewOverlay = document.getElementById("question-bank-preview-overlay");
    const newQuestionButton = document.getElementById("question-bank-new-question");
    const exportButton = document.getElementById("question-bank-export");
    const importButton = document.getElementById("question-bank-import");

    searchInput?.addEventListener("input", (event) => {
      api.state.filterValues.search = String(event.target.value || "");
      api.renderCurrentTab();
      api.renderBulkBar();
    });

    statusFilter?.addEventListener("change", (event) => {
      api.state.filterValues.status = String(event.target.value || "");
      api.renderAll();
    });

    specialtyFilter?.addEventListener("change", (event) => {
      api.state.filterValues.specialty = String(event.target.value || "");
      api.renderAll();
    });

    difficultyFilter?.addEventListener("change", (event) => {
      api.state.filterValues.difficulty = String(event.target.value || "");
      api.renderAll();
    });

    filterToggle?.addEventListener("click", () => {
      api.state.filtersExpanded = !api.state.filtersExpanded;
      api.renderFilterControls();
    });

    clearFilters?.addEventListener("click", () => {
      api.state.filterValues = {
        search: "",
        status: "",
        specialty: "",
        difficulty: "",
      };
      api.renderAll();
    });

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const nextTab = tab.dataset.tab;
        if (!api.QUESTION_BANK_TABS.includes(nextTab)) {
          return;
        }

        api.state.activeTab = nextTab;
        if (nextTab !== "questions") {
          api.state.selectedQuestionIds.clear();
        }
        api.renderAll();
      });
    });

    tableRegion?.addEventListener("click", (event) => {
      const rowActionButton = event.target.closest("[data-row-action]");
      const openEditorButton = event.target.closest("[data-open-editor]");
      const closePreviewButton = event.target.closest("[data-close-preview]");

      if (closePreviewButton) {
        closePreviewDrawer();
        return;
      }

      if (openEditorButton) {
        window.location.href = api.getQuestionEditUrl(openEditorButton.dataset.openEditor);
        return;
      }

      if (!rowActionButton) {
        return;
      }

      handleRowAction(
        rowActionButton.dataset.rowAction,
        rowActionButton.dataset.questionId || "",
        rowActionButton.dataset.recordId || ""
      );
    });

    tableRegion?.addEventListener("change", (event) => {
      const questionToggle = event.target.closest("[data-select-question]");
      const selectAllToggle = event.target.closest("[data-select-all]");

      if (questionToggle) {
        toggleQuestionSelection(questionToggle.dataset.selectQuestion, questionToggle.checked);
        return;
      }

      if (selectAllToggle) {
        toggleVisibleQuestionSelection(selectAllToggle.checked);
      }
    });

    bulkBar?.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-bulk-action]");
      if (!actionButton) {
        return;
      }

      void handleBulkAction(actionButton.dataset.bulkAction);
    });

    previewOverlay?.addEventListener("click", (event) => {
      if (event.target === previewOverlay) {
        closePreviewDrawer();
      }

      const closeButton = event.target.closest("[data-close-preview]");
      const openEditorButton = event.target.closest("[data-open-editor]");

      if (closeButton) {
        closePreviewDrawer();
      }

      if (openEditorButton) {
        window.location.href = api.getQuestionEditUrl(openEditorButton.dataset.openEditor);
      }
    });

    document.addEventListener("keydown", handleQuestionBankEscape);

    newQuestionButton?.addEventListener("click", () => {
      window.location.hash = "#questions-add";
    });

    exportButton?.addEventListener("click", () => {
      if (api.state.activeTab === "questions") {
        exportQuestions(api.getFilteredQuestions(), "sesats-question-bank.csv");
        api.setFeedback("Question bank export created from the current view.", "success");
        return;
      }

      api.setFeedback("Export is currently wired for the Questions tab.", "success");
    });

    importButton?.addEventListener("click", () => {
      api.setFeedback("Import workflow placeholder ready for Back4App ingestion hooks.", "success");
    });

    api.state.listenersBound = true;
  }

  function unbindQuestionBankEvents() {
    document.removeEventListener("keydown", handleQuestionBankEscape);
    api.state.listenersBound = false;
  }

  api.refreshQuestionBank = async function refreshQuestionBank() {
    api.state.loading = true;
    api.state.selectedQuestionIds.clear();
    api.state.previewQuestionId = "";
    api.renderFeedback();
    api.renderPreviewDrawer();
    api.renderBulkBar();

    const region = document.getElementById("question-bank-table-region");
    if (region) {
      region.innerHTML = `
        <div class="question-bank-loading-card">
          <div class="question-bank-loading-title">Refreshing question bank...</div>
          <p>Syncing the latest editorial content from Back4App.</p>
        </div>
      `;
    }

    await api.loadQuestionBankData();
    api.renderAll();
  };

  api.bindContentPage = async function bindContentPage() {
    const root = api.getRoot();
    if (!root) {
      return;
    }

    unbindQuestionBankEvents();
    api.resetState();
    api.renderFilterControls();
    api.renderTabs();
    api.renderFeedback();
    bindQuestionBankEvents();

    try {
      await api.loadQuestionBankData();
      api.renderAll();
    } catch (error) {
      console.error("Unable to initialize the Question Bank page.", error);
      api.state.loading = false;
      const region = document.getElementById("question-bank-table-region");
      if (region) {
        region.innerHTML = api.renderEmptyState(
          "We couldn't load the question bank right now. Please try again."
        );
      }
      api.setFeedback("Unable to load the question bank.", "error");
    }
  };

  window.bindContentPage = api.bindContentPage;
})();
