(function () {
  const api = window.QuestionBank;

  api.renderFilterControls = function renderFilterControls() {
    const statusSelect = document.getElementById("question-bank-status-filter");
    const specialtySelect = document.getElementById("question-bank-specialty-filter");
    const difficultySelect = document.getElementById("question-bank-difficulty-filter");
    const searchInput = document.getElementById("question-bank-search");
    const filterToggle = document.getElementById("question-bank-filter-toggle");
    const filterRow = document.getElementById("question-bank-filter-row");

    if (searchInput) {
      searchInput.value = api.state.filterValues.search;
    }

    if (statusSelect) {
      statusSelect.innerHTML = [
        '<option value="">All statuses</option>',
        ...api.state.filterOptions.statuses.map(
          (status) => `<option value="${api.escapeHtml(status)}">${api.escapeHtml(status)}</option>`
        ),
      ].join("");
      statusSelect.value = api.state.filterValues.status;
    }

    if (specialtySelect) {
      specialtySelect.innerHTML = [
        '<option value="">All specialties</option>',
        ...api.state.filterOptions.specialties.map(
          (specialty) =>
            `<option value="${api.escapeHtml(specialty)}">${api.escapeHtml(specialty)}</option>`
        ),
      ].join("");
      specialtySelect.value = api.state.filterValues.specialty;
    }

    if (difficultySelect) {
      difficultySelect.innerHTML = [
        '<option value="">All difficulty levels</option>',
        ...api.state.filterOptions.difficulties.map(
          (difficulty) =>
            `<option value="${api.escapeHtml(difficulty)}">${api.escapeHtml(difficulty)}</option>`
        ),
      ].join("");
      difficultySelect.value = api.state.filterValues.difficulty;
    }

    if (filterRow) {
      filterRow.classList.toggle("is-collapsed", !api.state.filtersExpanded);
    }

    if (filterToggle) {
      filterToggle.setAttribute("aria-expanded", String(api.state.filtersExpanded));
    }
  };

  api.renderTabs = function renderTabs() {
    const tabs = document.querySelectorAll(".question-bank-tab");

    tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === api.state.activeTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
  };

  api.renderFeedback = function renderFeedback() {
    const feedback = document.getElementById("question-bank-feedback");
    if (!feedback) {
      return;
    }

    if (!api.state.feedback.message) {
      feedback.textContent = "";
      feedback.className = "question-bank-feedback hidden";
      return;
    }

    feedback.textContent = api.state.feedback.message;
    feedback.className = `question-bank-feedback ${api.state.feedback.type}`;
  };

  api.renderBulkBar = function renderBulkBar() {
    const bulkBar = document.getElementById("question-bank-bulk-bar");
    if (!bulkBar) {
      return;
    }

    if (api.state.activeTab !== "questions" || api.state.selectedQuestionIds.size === 0) {
      bulkBar.innerHTML = "";
      bulkBar.classList.add("hidden");
      return;
    }

    bulkBar.innerHTML = `
      <div class="question-bank-bulk-copy">${api.state.selectedQuestionIds.size} selected</div>
      <div class="question-bank-bulk-actions">
        <button type="button" class="question-bank-inline-action" data-bulk-action="change-status">Change Status</button>
        <button type="button" class="question-bank-inline-action" data-bulk-action="assign-reviewer">Assign Reviewer</button>
        <button type="button" class="question-bank-inline-action" data-bulk-action="verify-references">Verify References</button>
        <button type="button" class="question-bank-inline-action" data-bulk-action="export-selected">Export Selected</button>
        <button type="button" class="question-bank-inline-action is-danger" data-bulk-action="archive">Archive</button>
      </div>
    `;
    bulkBar.classList.remove("hidden");
  };

  api.renderBadge = function renderBadge(label, kind) {
    const normalizedKind = kind === "difficulty" ? "difficulty" : "status";
    const slug = api.slugify(label) || "default";

    return `<span class="question-bank-badge question-bank-${normalizedKind}-badge question-bank-${normalizedKind}-${slug}">${api.escapeHtml(
      label || "Unspecified"
    )}</span>`;
  };

  api.renderPreviewDrawer = function renderPreviewDrawer() {
    const overlay = document.getElementById("question-bank-preview-overlay");
    const content = document.getElementById("question-bank-preview-content");
    const previewQuestion = api.getPreviewQuestion();

    if (!overlay || !content) {
      return;
    }

    if (!previewQuestion) {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      content.innerHTML = "";
      return;
    }

    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    content.innerHTML = `
      <div class="question-bank-preview-header">
        <div>
          <p class="question-bank-preview-eyebrow">Question Preview</p>
          <h3 id="question-bank-preview-title">${api.escapeHtml(previewQuestion.title)}</h3>
          <p class="question-bank-preview-meta">Question ID ${api.escapeHtml(previewQuestion.idLabel)}</p>
        </div>
        <button type="button" class="question-bank-preview-close" data-close-preview aria-label="Close preview">×</button>
      </div>

      <div class="question-bank-preview-badges">
        ${api.renderBadge(previewQuestion.status, "status")}
        ${api.renderBadge(previewQuestion.difficulty, "difficulty")}
      </div>

      <dl class="question-bank-preview-grid">
        <div>
          <dt>Specialty</dt>
          <dd>${api.escapeHtml(previewQuestion.specialty)}</dd>
        </div>
        <div>
          <dt>Topic</dt>
          <dd>${api.escapeHtml(previewQuestion.topic)}</dd>
        </div>
        <div>
          <dt>Author</dt>
          <dd>${api.escapeHtml(previewQuestion.author)}</dd>
        </div>
        <div>
          <dt>Last edited</dt>
          <dd>${api.escapeHtml(previewQuestion.lastEditedLabel)}</dd>
        </div>
        <div>
          <dt>References</dt>
          <dd>${api.escapeHtml(String(previewQuestion.referencesCount))}</dd>
        </div>
        <div>
          <dt>Media</dt>
          <dd>${api.escapeHtml(String(previewQuestion.mediaCount))}</dd>
        </div>
      </dl>

      <section class="question-bank-preview-section">
        <h4>Question stem preview</h4>
        <p>${api.escapeHtml(previewQuestion.stem || "No stem available.")}</p>
      </section>

      <section class="question-bank-preview-section">
        <h4>Correct answer</h4>
        <p>${api.escapeHtml(previewQuestion.correctAnswer)}</p>
      </section>

      <section class="question-bank-preview-section">
        <h4>Critique preview</h4>
        <p>${api.escapeHtml(previewQuestion.critique || "No critique preview available.")}</p>
      </section>

      <div class="question-bank-preview-actions">
        <button type="button" class="button-primary" data-open-editor="${api.escapeHtml(previewQuestion.objectId)}">
          Open Full Editor
        </button>
        <button type="button" class="dashboard-toolbar-button" data-close-preview>Close</button>
      </div>
    `;
  };

  function renderQuestionsTable(records) {
    const allVisibleSelected =
      records.length > 0 &&
      records.every((question) => api.state.selectedQuestionIds.has(question.objectId));

    return `
      <div class="question-bank-table-card">
        <div class="question-bank-table-scroll">
          <table class="question-bank-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select all visible questions" data-select-all ${allVisibleSelected ? "checked" : ""} /></th>
                <th>ID</th>
                <th>Title</th>
                <th>Specialty</th>
                <th>Topic</th>
                <th>Status</th>
                <th>Difficulty</th>
                <th>References</th>
                <th>Media</th>
                <th>Last Edited</th>
                <th>Author</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (question) => `
                    <tr>
                      <td>
                        <input
                          type="checkbox"
                          aria-label="Select ${api.escapeHtml(question.title)}"
                          data-select-question="${api.escapeHtml(question.objectId)}"
                          ${api.state.selectedQuestionIds.has(question.objectId) ? "checked" : ""}
                        />
                      </td>
                      <td><span class="question-bank-id-pill">${api.escapeHtml(question.idLabel)}</span></td>
                      <td>
                        <div class="question-bank-primary-cell">
                          <strong>${api.escapeHtml(question.title)}</strong>
                          <span>${api.escapeHtml(api.truncateText(question.stem, 92))}</span>
                        </div>
                      </td>
                      <td>${api.escapeHtml(question.specialty)}</td>
                      <td>${api.escapeHtml(question.topic)}</td>
                      <td>${api.renderBadge(question.status, "status")}</td>
                      <td>${api.renderBadge(question.difficulty, "difficulty")}</td>
                      <td>${api.escapeHtml(String(question.referencesCount))}</td>
                      <td>${api.escapeHtml(String(question.mediaCount))}</td>
                      <td>${api.escapeHtml(question.lastEditedLabel)}</td>
                      <td>${api.escapeHtml(question.author)}</td>
                      <td>
                        <div class="question-bank-row-actions">
                          <button type="button" class="question-bank-inline-action" data-row-action="preview" data-question-id="${api.escapeHtml(question.objectId)}">Preview</button>
                          <button type="button" class="question-bank-inline-action" data-row-action="edit" data-question-id="${api.escapeHtml(question.objectId)}">Edit</button>
                          <button type="button" class="question-bank-inline-action" data-row-action="duplicate" data-question-id="${api.escapeHtml(question.objectId)}">Duplicate</button>
                          <button type="button" class="question-bank-inline-action is-danger" data-row-action="archive" data-question-id="${api.escapeHtml(question.objectId)}">Archive</button>
                        </div>
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderMediaTable(records) {
    return `
      <div class="question-bank-table-card">
        <div class="question-bank-table-scroll">
          <table class="question-bank-table">
            <thead>
              <tr>
                <th>Thumbnail</th>
                <th>Type</th>
                <th>Filename</th>
                <th>Linked Question</th>
                <th>Uploaded By</th>
                <th>Upload Date</th>
                <th>Size</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (record) => `
                    <tr>
                      <td><div class="question-bank-thumbnail">${api.escapeHtml(record.type.slice(0, 1))}</div></td>
                      <td>${api.escapeHtml(record.type)}</td>
                      <td>${api.escapeHtml(record.filename)}</td>
                      <td>${api.escapeHtml(record.linkedQuestion)}</td>
                      <td>${api.escapeHtml(record.uploadedBy)}</td>
                      <td>${api.escapeHtml(record.uploadDate)}</td>
                      <td>${api.escapeHtml(record.size)}</td>
                      <td>${api.renderBadge(record.status, "status")}</td>
                      <td>
                        <div class="question-bank-row-actions">
                          <button type="button" class="question-bank-inline-action" data-row-action="preview-media" data-record-id="${api.escapeHtml(record.objectId)}">Preview</button>
                          <button type="button" class="question-bank-inline-action" data-row-action="copy-filename" data-record-id="${api.escapeHtml(record.objectId)}">Copy Name</button>
                        </div>
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderReferencesTable(records) {
    return `
      <div class="question-bank-table-card">
        <div class="question-bank-table-scroll">
          <table class="question-bank-table">
            <thead>
              <tr>
                <th>Citation</th>
                <th>First Author</th>
                <th>Journal</th>
                <th>Year</th>
                <th>PMID</th>
                <th>DOI</th>
                <th>Questions Using</th>
                <th>Last Verified</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (record) => `
                    <tr>
                      <td>
                        <div class="question-bank-primary-cell">
                          <strong>${api.escapeHtml(api.truncateText(record.citation, 90))}</strong>
                        </div>
                      </td>
                      <td>${api.escapeHtml(record.firstAuthor)}</td>
                      <td>${api.escapeHtml(record.journal)}</td>
                      <td>${api.escapeHtml(String(record.year))}</td>
                      <td>${api.escapeHtml(record.pmid)}</td>
                      <td>${api.escapeHtml(record.doi)}</td>
                      <td>${api.escapeHtml(String(record.questionsUsing))}</td>
                      <td>${api.escapeHtml(record.lastVerified)}</td>
                      <td>${api.renderBadge(record.status, "status")}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderAiAssetsTable(records) {
    return `
      <div class="question-bank-table-card">
        <div class="question-bank-table-scroll">
          <table class="question-bank-table">
            <thead>
              <tr>
                <th>Question ID</th>
                <th>Asset Type</th>
                <th>Model</th>
                <th>Prompt Version</th>
                <th>Generated At</th>
                <th>Cached</th>
                <th>Needs Regeneration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (record) => `
                    <tr>
                      <td>${api.escapeHtml(record.questionId)}</td>
                      <td>${api.escapeHtml(record.assetType)}</td>
                      <td>${api.escapeHtml(record.model)}</td>
                      <td>${api.escapeHtml(record.promptVersion)}</td>
                      <td>${api.escapeHtml(record.generatedAt)}</td>
                      <td>${api.escapeHtml(record.cached)}</td>
                      <td>${api.escapeHtml(record.needsRegeneration)}</td>
                      <td>
                        <div class="question-bank-row-actions">
                          <button type="button" class="question-bank-inline-action" data-row-action="view-ai-asset" data-record-id="${api.escapeHtml(record.objectId)}">View</button>
                          <button type="button" class="question-bank-inline-action" data-row-action="regenerate-ai-asset" data-record-id="${api.escapeHtml(record.objectId)}">Regenerate</button>
                        </div>
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderTemplatesTable(records) {
    return `
      <div class="question-bank-table-card">
        <div class="question-bank-table-scroll">
          <table class="question-bank-table">
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Type</th>
                <th>Version</th>
                <th>Last Modified</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (record) => `
                    <tr>
                      <td>${api.escapeHtml(record.templateName)}</td>
                      <td>${api.escapeHtml(record.type)}</td>
                      <td>${api.escapeHtml(record.version)}</td>
                      <td>${api.escapeHtml(record.lastModified)}</td>
                      <td>${api.renderBadge(record.active === "Yes" ? "Active" : "Inactive", "status")}</td>
                      <td>
                        <div class="question-bank-row-actions">
                          <button type="button" class="question-bank-inline-action" data-row-action="edit-template" data-record-id="${api.escapeHtml(record.objectId)}">Edit</button>
                          <button type="button" class="question-bank-inline-action" data-row-action="duplicate-template" data-record-id="${api.escapeHtml(record.objectId)}">Duplicate</button>
                          <button type="button" class="question-bank-inline-action is-danger" data-row-action="deactivate-template" data-record-id="${api.escapeHtml(record.objectId)}">Deactivate</button>
                        </div>
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  api.renderEmptyState = function renderEmptyState(copy) {
    return `
      <div class="question-bank-empty-state">
        <h3>No matching records</h3>
        <p>${api.escapeHtml(copy)}</p>
      </div>
    `;
  };

  api.renderCurrentTab = function renderCurrentTab() {
    const region = document.getElementById("question-bank-table-region");
    if (!region) {
      return;
    }

    const records = api.getFilteredTabRecords();
    const sourceMap = {
      questions: api.state.meta.dataSources.questions,
      media: api.state.meta.dataSources.media,
      references: api.state.meta.dataSources.references,
      "ai-assets": api.state.meta.dataSources.aiAssets,
      templates: api.state.meta.dataSources.templates,
    };
    const sourceNote =
      sourceMap[api.state.activeTab] === "mock"
        ? `
            <div class="question-bank-source-note">
              Showing seeded development data for this tab until its live source is connected.
            </div>
          `
        : "";

    if (records.length === 0) {
      region.innerHTML = `${sourceNote}${api.renderEmptyState(
        "Try adjusting the search or filters for this workspace."
      )}`;
      return;
    }

    if (api.state.activeTab === "media") {
      region.innerHTML = `${sourceNote}${renderMediaTable(records)}`;
      return;
    }

    if (api.state.activeTab === "references") {
      region.innerHTML = `${sourceNote}${renderReferencesTable(records)}`;
      return;
    }

    if (api.state.activeTab === "ai-assets") {
      region.innerHTML = `${sourceNote}${renderAiAssetsTable(records)}`;
      return;
    }

    if (api.state.activeTab === "templates") {
      region.innerHTML = `${sourceNote}${renderTemplatesTable(records)}`;
      return;
    }

    region.innerHTML = `${sourceNote}${renderQuestionsTable(records)}`;
  };

  api.renderAll = function renderAll() {
    api.renderFilterControls();
    api.renderTabs();
    api.renderFeedback();
    api.renderBulkBar();
    api.renderCurrentTab();
    api.renderPreviewDrawer();
  };
})();
