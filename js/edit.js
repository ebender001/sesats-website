(function () {
  const EDITOR_COMPONENT_PATH = "components/pages/questions/add.html";
  const QUESTION_TYPE_MULTIPLE_CHOICE = "multiple_choice";
  const QUESTION_TYPE_TRUE_FALSE = "true_false";
  let originalEditorSnapshot = "";

  function getQuestionIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("id") || "").trim();
  }

  function setLoadingState(title, message) {
    const root = document.getElementById("question-editor-root");
    if (!root) return;

    root.innerHTML = `
      <section class="invite-user-card">
        <div class="invite-user-intro">
          <p class="invite-user-eyebrow">ABTS SESATS Administration</p>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(message)}</p>
        </div>
      </section>
    `;
  }

  function waitFor(condition, { timeoutMs = 10000, intervalMs = 50 } = {}) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      function checkCondition() {
        if (condition()) {
          resolve();
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("Timed out while preparing the question editor."));
          return;
        }

        window.setTimeout(checkCondition, intervalMs);
      }

      checkCondition();
    });
  }

  function inferQuestionType(questionOptions) {
    const normalizedOptions = Array.isArray(questionOptions) ? questionOptions : [];
    if (normalizedOptions.length !== 2) {
      return QUESTION_TYPE_MULTIPLE_CHOICE;
    }

    const optionTexts = normalizedOptions.map((option) => String(option?.text || "").trim().toLowerCase());
    return optionTexts[0] === "true" && optionTexts[1] === "false"
      ? QUESTION_TYPE_TRUE_FALSE
      : QUESTION_TYPE_MULTIPLE_CHOICE;
  }

  function buildEditorOption(option) {
    return createQuestionOption({
      objectId: String(option?.objectId || ""),
      text: String(option?.text || ""),
      isCorrect: Boolean(option?.isCorrect),
      locked: false,
    });
  }

  function ensureMinimumOptions(questionType) {
    if (!pageState.questionEditor) return;

    if (questionType === QUESTION_TYPE_TRUE_FALSE) {
      pageState.questionEditor.options = buildTrueFalseOptions().map((option, index) => ({
        ...option,
        objectId: String(pageState.questionEditor.options[index]?.objectId || ""),
        isCorrect: Boolean(pageState.questionEditor.options[index]?.isCorrect),
      }));
      return;
    }

    while (pageState.questionEditor.options.length < 3) {
      pageState.questionEditor.options.push(createQuestionOption());
    }
  }

  async function populateEditor(question) {
    const specialtySelect = document.getElementById("add-question-specialty");
    const topicSelect = document.getElementById("add-question-topic");
    const statusSelect = document.getElementById("add-question-status");
    const difficultySelect = document.getElementById("add-question-difficulty");
    const stemTextarea = document.getElementById("add-question-stem");
    const critiqueTextarea = document.getElementById("add-question-critique");
    const typeSelect = document.getElementById("add-question-type");

    const inferredQuestionType = inferQuestionType(question.questionOptions);
    const specialty = findSpecialtyByName(question.specialty || "");

    if (specialtySelect && specialty?.objectId) {
      specialtySelect.value = specialty.objectId;
      await loadQuestionTopicsForSpecialty(specialty.objectId);
      setQuestionTopicCreatorState({ visible: true, enabled: true });
    }

    if (topicSelect) {
      const matchingTopicOption = Array.from(topicSelect.options || []).find(
        (option) => normalizeLookupText(option.value) === normalizeLookupText(question.topic || "")
      );

      if (matchingTopicOption) {
        topicSelect.value = matchingTopicOption.value;
      } else if (question.topic) {
        const option = document.createElement("option");
        option.value = String(question.topic);
        option.textContent = String(question.topic);
        topicSelect.appendChild(option);
        topicSelect.value = option.value;
        topicSelect.disabled = false;
      }
    }

    if (statusSelect) {
      statusSelect.value = String(question.status || "");
      applyQuestionStatusAccent(statusSelect.value);
    }

    if (difficultySelect) {
      difficultySelect.value = String(question.difficulty || "Average");
    }

    if (stemTextarea) {
      stemTextarea.value = String(question.stem || "");
      bindAutoResizingTextarea(stemTextarea);
    }

    if (critiqueTextarea) {
      critiqueTextarea.value = String(question.critique || "");
      bindAutoResizingTextarea(critiqueTextarea);
    }

    if (typeSelect) {
      typeSelect.value = inferredQuestionType;
    }

    pageState.questionEditor.questionType = inferredQuestionType;
    pageState.questionEditor.options = (Array.isArray(question.questionOptions) ? question.questionOptions : []).map(
      buildEditorOption
    );
    ensureMinimumOptions(inferredQuestionType);
    renderQuestionOptionsEditor();
  }

  function replaceSaveButton() {
    const existingButton = document.getElementById("save-question-button");
    if (!existingButton || !existingButton.parentNode) return null;

    const nextButton = existingButton.cloneNode(true);
    nextButton.textContent = "Save Changes";
    nextButton.dataset.idleLabel = "Save Changes";
    nextButton.dataset.loadingLabel = "Saving Changes...";
    existingButton.parentNode.replaceChild(nextButton, existingButton);
    return nextButton;
  }

  function addExitButton() {
    const actions = document.querySelector(".question-form-actions");
    if (!actions) return;

    actions.innerHTML = `
      <a href="index.html#questions-list" class="button button-secondary">Back to Question List</a>
    `;
  }

  function setEditSubmitting(isSubmitting) {
    const button = document.getElementById("save-question-button");
    if (!button) return;

    button.disabled = isSubmitting;
    button.textContent = isSubmitting
      ? button.dataset.loadingLabel || "Saving..."
      : button.dataset.idleLabel || "Save";
  }

  function collectQuestionEditPayload() {
    const basePayload = collectQuestionAddPayload();
    return {
      objectId: pageState.currentEditQuestion.objectId,
      stem: basePayload.stem,
      critique: basePayload.critique,
      specialty: basePayload.specialty,
      topic: basePayload.topic,
      difficulty: basePayload.difficulty,
      status: basePayload.status,
      generatedByAI: basePayload.generatedByAI,
      aiModel: basePayload.aiModel,
      aiPromptVersion: basePayload.aiPromptVersion,
      lastEditedByObjectId: basePayload.lastEditedByObjectId,
      lastEditedAt: basePayload.lastEditedAt,
    };
  }

  function collectEditableOptionPayloads() {
    const relevantOptions =
      pageState.questionEditor.questionType === QUESTION_TYPE_TRUE_FALSE
        ? pageState.questionEditor.options
        : pageState.questionEditor.options.filter((option) => option.text.trim().length > 0);

    return relevantOptions.map((option, index) => ({
      objectId: String(option.objectId || ""),
      label: getQuestionOptionLabel(index),
      text: option.text.trim(),
      isCorrect: Boolean(option.isCorrect),
      sortOrder: index,
    }));
  }

  function buildEditorSnapshot() {
    const payload = collectQuestionEditPayload();
    const options = collectEditableOptionPayloads().map((option) => ({
      label: option.label,
      text: option.text,
      isCorrect: option.isCorrect,
      sortOrder: option.sortOrder,
    }));

    return JSON.stringify({
      stem: payload.stem,
      critique: payload.critique,
      specialty: payload.specialty,
      topic: payload.topic,
      difficulty: payload.difficulty,
      status: payload.status,
      questionType: pageState.questionEditor?.questionType || QUESTION_TYPE_MULTIPLE_CHOICE,
      options,
    });
  }

  function updateSaveButtonDirtyState() {
    const button = document.getElementById("save-question-button");
    if (!button) return;

    const isDirty = Boolean(originalEditorSnapshot) && buildEditorSnapshot() !== originalEditorSnapshot;
    button.disabled = !isDirty;
  }

  function bindDirtyStateTracking() {
    const form = document.getElementById("add-question-form");
    if (!form) return;

    form.addEventListener("input", () => {
      updateSaveButtonDirtyState();
    });

    form.addEventListener("change", () => {
      updateSaveButtonDirtyState();
    });

    form.addEventListener("click", () => {
      window.setTimeout(updateSaveButtonDirtyState, 0);
    });
  }

  async function saveEditedQuestion() {
    const questionPayload = collectQuestionEditPayload();
    const validationMessage = validateQuestionAddPayload(questionPayload);
    if (validationMessage) {
      setQuestionsFeedback(validationMessage, "error");
      return;
    }

    const previousQuestion = pageState.currentEditQuestion || {};
    const nextOptions = collectEditableOptionPayloads();
    const previousOptionIds = new Set(
      (Array.isArray(previousQuestion.questionOptions) ? previousQuestion.questionOptions : [])
        .map((option) => String(option?.objectId || ""))
        .filter(Boolean)
    );
    const retainedOptionIds = new Set(nextOptions.map((option) => option.objectId).filter(Boolean));
    const deletedOptionIds = [...previousOptionIds].filter((optionId) => !retainedOptionIds.has(optionId));

    setQuestionsFeedback("", "success");
    setEditSubmitting(true);

    try {
      const updatedQuestion = await window.back4app.runCloudFunction("editQuestion", questionPayload);
      const savedOptions = [];

      for (const optionPayload of nextOptions) {
        if (optionPayload.objectId) {
          const savedOption = await window.back4app.runCloudFunction("editQuestionOption", optionPayload);
          savedOptions.push(savedOption);
        } else {
          const savedOption = await window.back4app.runCloudFunction("addQuestionOption", {
            ...optionPayload,
            questionObjectId: updatedQuestion.objectId,
          });
          savedOptions.push(savedOption);
        }
      }

      for (const optionId of deletedOptionIds) {
        await window.back4app.runCloudFunction("deleteQuestionOption", { objectId: optionId });
      }

      pageState.currentEditQuestion = {
        ...updatedQuestion,
        questionOptions: savedOptions,
      };

      await populateEditor(pageState.currentEditQuestion);
      originalEditorSnapshot = buildEditorSnapshot();
      updateSaveButtonDirtyState();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setQuestionsFeedback("Question updated successfully.", "success");
    } catch (error) {
      console.error("Unable to update question.", error);
      setQuestionsFeedback(error?.message || "Unable to save question changes right now.", "error");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function initializeEditorPage() {
    const questionId = getQuestionIdFromUrl();
    if (!questionId) {
      setLoadingState("Question Not Found", "A question id is required to open the editor.");
      return;
    }

    if (window.back4app && typeof window.back4app.init === "function") {
      window.back4app.init();
    }

    const root = document.getElementById("question-editor-root");
    if (!root) return;

    const response = await fetch(EDITOR_COMPONENT_PATH);
    if (!response.ok) {
      throw new Error("Unable to load the question editor layout.");
    }

    root.innerHTML = await response.text();

    const pageTitle = root.querySelector(".page-title h2");
    const cardTitle = root.querySelector(".invite-user-intro h3");
    const cardDescription = root.querySelector(".invite-user-intro p:last-child");
    const importActions = root.querySelector(".question-form-actions");
    const questionImagesLabel = document.querySelector('label[for="add-question-images"]');
    const questionVideosLabel = document.querySelector('label[for="add-question-videos"]');
    const critiqueImagesLabel = document.querySelector('label[for="add-question-critique-images"]');
    const critiqueVideosLabel = document.querySelector('label[for="add-question-critique-videos"]');
    const referencesPanel = root.querySelector(".question-references-panel");

    if (pageTitle) pageTitle.textContent = "Edit Question";
    if (cardTitle) cardTitle.textContent = "Question Editor";
    if (cardDescription) {
      cardDescription.textContent = "Review and update the selected question.";
    }
    if (importActions) {
      importActions.innerHTML = "";
    }
    [questionImagesLabel, questionVideosLabel, critiqueImagesLabel, critiqueVideosLabel, referencesPanel].forEach(
      (element) => {
        if (element) {
          element.remove();
        }
      }
    );

    bindQuestionsAddPage();
    addExitButton();
    replaceSaveButton()?.addEventListener("click", () => {
      void saveEditedQuestion();
    });
    bindDirtyStateTracking();

    await waitFor(
      () => Array.isArray(pageState.activeSpecialties) && pageState.activeSpecialties.length > 0
    );
    await waitFor(() => Array.isArray(pageState.activeStatuses) && pageState.activeStatuses.length > 0);

    const question = await window.back4app.runCloudFunction("getQuestion", { objectId: questionId });
    pageState.currentEditQuestion = question;
    await populateEditor(question);
    originalEditorSnapshot = buildEditorSnapshot();
    updateSaveButtonDirtyState();
  }

  window.addEventListener("DOMContentLoaded", () => {
    void initializeEditorPage().catch((error) => {
      console.error("Unable to initialize question editor.", error);
      setLoadingState("Unable To Load Question", error?.message || "Please try again.");
    });
  });
})();
