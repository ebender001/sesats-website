(function () {
  const api = (window.QuestionBank = window.QuestionBank || {});

  api.QUESTION_BANK_TABS = ["questions", "media", "references", "ai-assets", "templates"];
  api.QUESTION_BANK_DIFFICULTIES = ["Easy", "Moderate", "Hard", "Expert"];
  api.QUESTION_BANK_STATUS_ORDER = [
    "Draft",
    "Needs Review",
    "Revision Requested",
    "Approved / Ready",
    "Published",
    "Archived",
  ];
  api.CURRENT_YEAR = new Date().getFullYear();

  api.createDefaultState = function createDefaultState() {
    return {
      activeTab: "questions",
      filtersExpanded: typeof window === "undefined" ? true : window.innerWidth > 680,
      loading: true,
      selectedQuestionIds: new Set(),
      previewQuestionId: "",
      feedback: {
        message: "",
        type: "success",
      },
      datasets: {
        questions: [],
        media: [],
        references: [],
        aiAssets: [],
        templates: [],
      },
      filterValues: {
        search: "",
        status: "",
        specialty: "",
        difficulty: "",
      },
      filterOptions: {
        statuses: [],
        specialties: [],
        difficulties: [...api.QUESTION_BANK_DIFFICULTIES],
      },
      meta: {
        dataSources: {
          questions: "live",
          media: "live",
          references: "live",
          aiAssets: "live",
          templates: "mock",
        },
      },
      listenersBound: false,
    };
  };

  api.state = api.createDefaultState();

  api.resetState = function resetState() {
    api.state = api.createDefaultState();
    return api.state;
  };

  api.escapeHtml = function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return entities[character] || character;
    });
  };

  api.slugify = function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  api.truncateText = function truncateText(value, maxLength) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "Untitled question";
    }

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
  };

  api.formatShortDate = function formatShortDate(value) {
    if (!value) {
      return "Not set";
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Not set";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  api.formatDateTime = function formatDateTime(value) {
    if (!value) {
      return "Not set";
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Not set";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  api.downloadTextFile = function downloadTextFile(filename, contents) {
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  api.csvEscape = function csvEscape(value) {
    const normalized = String(value ?? "");
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }

    return normalized;
  };

  api.getQuestionEditUrl = function getQuestionEditUrl(questionId) {
    return `edit.html?id=${encodeURIComponent(questionId)}`;
  };

  api.getSelectedQuestionRecords = function getSelectedQuestionRecords() {
    return api.state.datasets.questions.filter((question) =>
      api.state.selectedQuestionIds.has(question.objectId)
    );
  };

  api.setFeedback = function setFeedback(message, type) {
    api.state.feedback.message = message || "";
    api.state.feedback.type = type === "error" ? "error" : "success";
    if (typeof api.renderFeedback === "function") {
      api.renderFeedback();
    }
  };

  api.getPreviewQuestion = function getPreviewQuestion() {
    return api.state.datasets.questions.find(
      (question) => question.objectId === api.state.previewQuestionId
    );
  };

  api.getRoot = function getRoot() {
    return document.getElementById("question-bank-root");
  };
})();
