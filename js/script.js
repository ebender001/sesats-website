const DEFAULT_SECTION = "dashboard";
const VALID_SECTIONS = new Set([
  "dashboard",
  "dev-tools",
  "users",
  "users-list",
  "users-invite",
  "institutions",
  "institutions-add",
  "institutions-list",
  "questions",
  "questions-add",
  "questions-list",
  "content",
  "reports",
  "settings",
]);

const authState = {
  loggedIn: false,
  userName: "Admin User",
  userRole: "Administrator",
};

const QUESTION_TYPE_MULTIPLE_CHOICE = "multiple_choice";
const QUESTION_TYPE_TRUE_FALSE = "true_false";

const pageState = {
  institutionsLoaded: false,
  institutionsById: new Map(),
  institutionsData: [],
  institutionSortDirection: "asc",
  usersLoaded: false,
  usersById: new Map(),
  usersData: [],
  userSortDirection: "asc",
  questionsLoaded: false,
  questionsData: [],
  questionVisibleCount: 100,
  questionEditor: null,
  activeInstitutions: [],
  activeSpecialties: [],
  activeStatuses: [],
  specialtiesLoaded: false,
  questionAiMetadata: null,
  questionGenerationState: {
    status: "idle",
    draft: null,
  },
  questionMediaSelections: {},
};

function getMainSection(section) {
  if (section.startsWith("users-")) {
    return "users";
  }

  if (section.startsWith("institutions-")) {
    return "institutions";
  }

  return section.startsWith("questions-") ? "questions" : section;
}

function getPagePath(section) {
  if (section === "dashboard") return "components/pages/dashboard/index.html";
  if (section === "users") return "components/pages/users/index.html";
  if (section === "users-list") return "components/pages/users/list.html";
  if (section === "users-invite") return "components/pages/users/invite.html";
  if (section === "institutions") return "components/pages/institutions/index.html";
  if (section === "institutions-add") return "components/pages/institutions/add.html";
  if (section === "institutions-list") return "components/pages/institutions/list.html";
  if (section === "questions") return "components/pages/questions/index.html";
  if (section === "questions-add") return "components/pages/questions/add.html";
  if (section === "questions-list") return "components/pages/questions/list.html";
  if (section === "content") return "components/pages/content/index.html";
  if (section === "dev-tools") return "components/pages/dev-tools/index.html";
  if (section === "reports") return "components/pages/reports/index.html";
  if (section === "settings") return "components/pages/settings/index.html";
  return `components/pages/${section}.html`;
}

function getPlaceholder(placeholderId) {
  return document.getElementById(placeholderId);
}

async function fetchComponentMarkup(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  return response.text();
}

async function loadComponent(placeholderId, path) {
  const placeholder = getPlaceholder(placeholderId);
  if (!placeholder) return false;

  try {
    placeholder.innerHTML = await fetchComponentMarkup(path);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function renderHeaderAuth() {
  const actionButton = document.getElementById("user-action-button");
  const dropdown = document.getElementById("user-dropdown");
  const editProfileLink = document.getElementById("edit-profile");
  const logoutLink = document.getElementById("logout");

  if (!actionButton) return;

  const safeUserName = String(authState.userName || "Admin User").trim() || "Admin User";
  const userRole = String(authState.userRole || "Administrator").trim() || "Administrator";
  const userInitials = safeUserName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("") || "AU";

  actionButton.innerHTML = authState.loggedIn
    ? `<span class="user-avatar" aria-hidden="true">${userInitials}</span>
       <span class="user-meta">
         <span class="user-name">${escapeHtml(safeUserName)}</span>
         <span class="user-role">${escapeHtml(userRole)}</span>
       </span>
       <span class="caret">▾</span>`
    : `<span class="user-avatar" aria-hidden="true">?</span>
       <span class="user-meta">
         <span class="user-name">Sign In</span>
         <span class="user-role">Administrator access</span>
       </span>
       <span class="caret">▾</span>`;
  actionButton.setAttribute("aria-expanded", "false");

  if (dropdown) {
    dropdown.classList.toggle("hidden", !authState.loggedIn);
  }

  if (editProfileLink) {
    editProfileLink.tabIndex = authState.loggedIn ? 0 : -1;
  }

  if (logoutLink) {
    logoutLink.tabIndex = authState.loggedIn ? 0 : -1;
  }

  renderNavAccess();
}

function setLoginNotice(message, type) {
  const notice = document.getElementById("login-notice");
  if (!notice) return;

  notice.textContent = message;
  notice.classList.remove("hidden", "error", "success");
  notice.classList.add(type === "success" ? "success" : "error");
}

function clearLoginNotice() {
  const notice = document.getElementById("login-notice");
  if (!notice) return;
  notice.textContent = "";
  notice.classList.add("hidden");
  notice.classList.remove("error", "success");
}

function openLoginOverlay() {
  const overlay = document.getElementById("login-overlay");
  if (!overlay) return;

  clearLoginNotice();
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function closeLoginOverlay() {
  const overlay = document.getElementById("login-overlay");
  const loginForm = document.getElementById("login-form");
  if (!overlay) return;

  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  if (loginForm) loginForm.reset();
  clearLoginNotice();
}

function bindHeaderActions() {
  const actionButton = document.getElementById("user-action-button");
  const dropdown = document.getElementById("user-dropdown");
  const editProfileLink = document.getElementById("edit-profile");
  const logoutLink = document.getElementById("logout");
  const loginOverlay = document.getElementById("login-overlay");
  const loginForm = document.getElementById("login-form");
  const forgotPasswordLink = document.getElementById("forgot-password");
  const loginCancelButtons = document.querySelectorAll("#login-cancel, #login-cancel-button");

  if (!actionButton) return;

  actionButton.addEventListener("click", (event) => {
    event.preventDefault();

    if (authState.loggedIn) {
      if (!dropdown) return;
      const isHidden = dropdown.classList.toggle("hidden");
      actionButton.setAttribute("aria-expanded", String(!isHidden));
    } else {
      openLoginOverlay();
    }
  });

  loginCancelButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeLoginOverlay();
    });
  });

  if (loginOverlay) {
    loginOverlay.addEventListener("click", (event) => {
      if (event.target === loginOverlay) {
        closeLoginOverlay();
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearLoginNotice();

      const identifier = document.getElementById("login-username")?.value.trim();
      const password = document.getElementById("login-password")?.value;

      if (!identifier || !password) {
        setLoginNotice("Please enter both username/email and password.", "error");
        return;
      }

      try {
        const result = await window.back4app.runCloudFunction("loginUser", {
          identifier,
          password,
        });

        authState.loggedIn = true;
        authState.userName = result.displayName || result.username || identifier;
        authState.userRole = "Administrator";

        if (typeof Parse !== "undefined" && result.sessionToken) {
          await Parse.User.become(result.sessionToken);
        }

        setLoginNotice(`Login successful. Welcome, ${authState.userName}.`, "success");
        renderHeaderAuth();
        populateQuestionAuthorField();
        setTimeout(closeLoginOverlay, 800);
      } catch (error) {
        const message = error?.message || "Login failed. Please check your credentials.";
        setLoginNotice(message, "error");
      }
    });
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (event) => {
      event.preventDefault();
      alert("Forgot password flow placeholder.");
    });
  }

  if (editProfileLink) {
    editProfileLink.addEventListener("click", (event) => {
      event.preventDefault();
      if (dropdown) {
        dropdown.classList.add("hidden");
      }
      actionButton.setAttribute("aria-expanded", "false");
      alert("Edit profile option selected.");
    });
  }

  if (logoutLink) {
    logoutLink.addEventListener("click", (event) => {
      event.preventDefault();
      authState.loggedIn = false;
      authState.userName = "Admin User";
      authState.userRole = "Administrator";
      if (typeof Parse !== "undefined" && typeof Parse.User?.logOut === "function") {
        Parse.User.logOut().catch((error) => {
          console.error("Unable to log out Parse user.", error);
        });
      }
      renderHeaderAuth();
      populateQuestionAuthorField();
      void navigateToSection(DEFAULT_SECTION);
    });
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".user-menu")) {
      if (dropdown) {
        dropdown.classList.add("hidden");
      }
      actionButton.setAttribute("aria-expanded", "false");
    }
  });
}

function getSectionFromHash() {
  const requestedSection = window.location.hash.replace(/^#/, "").trim().toLowerCase();
  return VALID_SECTIONS.has(requestedSection) ? requestedSection : DEFAULT_SECTION;
}

function canAccessSection(section) {
  const normalizedSection = VALID_SECTIONS.has(section) ? section : DEFAULT_SECTION;
  return authState.loggedIn || normalizedSection === DEFAULT_SECTION;
}

function getAccessibleSection(section) {
  const normalizedSection = VALID_SECTIONS.has(section) ? section : DEFAULT_SECTION;
  return canAccessSection(normalizedSection) ? normalizedSection : DEFAULT_SECTION;
}

function renderNavAccess() {
  const navLinks = document.querySelectorAll(".nav-link, .sub-nav-link");

  navLinks.forEach((link) => {
    const section = link.dataset.section || "";
    const isAccessible = canAccessSection(section);

    link.classList.toggle("disabled", !isAccessible);
    link.setAttribute("aria-disabled", String(!isAccessible));
    link.tabIndex = isAccessible ? 0 : -1;
  });
}

function setActiveNavLink(section) {
  const navLinks = document.querySelectorAll(".nav-link");
  const subNavLinks = document.querySelectorAll(".sub-nav-link");
  const mainSection = getMainSection(section);

  navLinks.forEach((link) => {
    const isActive = link.dataset.section === mainSection;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  subNavLinks.forEach((link) => {
    const isActive = link.dataset.section === section;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function renderMissingSection(section) {
  const placeholder = getPlaceholder("main-placeholder");
  if (!placeholder) return;

  const label = section.charAt(0).toUpperCase() + section.slice(1);
  placeholder.innerHTML = `
    <section class="page-title">
      <h2>${label}</h2>
    </section>
    <section class="placeholder-card">
      <div class="placeholder-icon">!</div>
      <p>We couldn't load the ${label} page right now.</p>
    </section>
  `;
}

function escapeHtml(value) {
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
}

function setInstitutionsFeedback(message, type) {
  const feedback = document.getElementById("institutions-feedback");
  if (!feedback) return;

  if (!message) {
    feedback.textContent = "";
    feedback.classList.add("hidden");
    feedback.classList.remove("success", "error");
    return;
  }

  feedback.textContent = message;
  feedback.classList.remove("hidden", "success", "error");
  feedback.classList.add(type === "success" ? "success" : "error");
}

function setInstitutionFormNotice(message, type) {
  const notice = document.getElementById("institution-form-notice");
  if (!notice) return;

  if (!message) {
    notice.textContent = "";
    notice.classList.add("hidden");
    notice.classList.remove("success", "error");
    return;
  }

  notice.textContent = message;
  notice.classList.remove("hidden", "success", "error");
  notice.classList.add(type === "success" ? "success" : "error");
}

function setUsersFeedback(message, type) {
  const feedback = document.getElementById("users-feedback");
  if (!feedback) return;

  if (!message) {
    feedback.textContent = "";
    feedback.classList.add("hidden");
    feedback.classList.remove("success", "error");
    return;
  }

  feedback.textContent = message;
  feedback.classList.remove("hidden", "success", "error");
  feedback.classList.add(type === "success" ? "success" : "error");
}

function setInviteUserNotice(message, type) {
  const notice = document.getElementById("invite-user-feedback");
  if (!notice) return;

  if (!message) {
    notice.textContent = "";
    notice.classList.add("hidden");
    notice.classList.remove("success", "error");
    return;
  }

  notice.textContent = message;
  notice.classList.remove("hidden", "success", "error");
  notice.classList.add(type === "success" ? "success" : "error");
}

function setDevToolsFeedback(message, type) {
  const feedback = document.getElementById("dev-tools-feedback");
  if (!feedback) return;

  if (!message) {
    feedback.textContent = "";
    feedback.classList.add("hidden");
    feedback.classList.remove("success", "error");
    return;
  }

  feedback.textContent = message;
  feedback.classList.remove("hidden", "success", "error");
  feedback.classList.add(type === "success" ? "success" : "error");
}

function setDevToolsSubmitting(mode, isSubmitting) {
  const seedButton = document.getElementById("dev-tools-seed-button");
  const clearButton = document.getElementById("dev-tools-clear-button");
  const countInput = document.getElementById("dev-tools-seed-count");
  const seedBatchInput = document.getElementById("dev-tools-seed-batch-id");

  if (seedButton) {
    const isSeedMode = mode === "seed";
    seedButton.disabled = isSubmitting && isSeedMode;
    seedButton.textContent = isSubmitting && isSeedMode ? "Seeding..." : "Seed Development Data";
  }

  if (clearButton) {
    const isClearMode = mode === "clear";
    clearButton.disabled = isSubmitting && isClearMode;
    clearButton.textContent = isSubmitting && isClearMode ? "Removing..." : "Remove Seeded Data";
  }

  if (countInput) {
    countInput.disabled = isSubmitting && mode === "seed";
  }

  if (seedBatchInput) {
    seedBatchInput.disabled = isSubmitting && mode === "clear";
  }
}

function bindDevToolsPage() {
  const seedForm = document.getElementById("dev-tools-seed-form");
  const clearForm = document.getElementById("dev-tools-clear-form");
  if (!seedForm || !clearForm) return;

  setDevToolsFeedback("", "success");
  setDevToolsSubmitting("seed", false);
  setDevToolsSubmitting("clear", false);

  seedForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const countInput = document.getElementById("dev-tools-seed-count");
    const requestedCount = Number.parseInt(countInput?.value || "200", 10);
    const questionCount = Math.max(1, Math.min(500, Number.isNaN(requestedCount) ? 200 : requestedCount));

    setDevToolsFeedback("", "success");
    setDevToolsSubmitting("seed", true);

    try {
      const result = await window.back4app.runCloudFunction("seedDevelopmentData", {
        questionCount,
      });

      const batchId = result?.seedBatchId || "unknown";
      const createdQuestions = result?.createdCounts?.Question ?? questionCount;
      const batchInput = document.getElementById("dev-tools-seed-batch-id");
      if (batchInput && result?.seedBatchId) {
        batchInput.value = result.seedBatchId;
      }
      setDevToolsFeedback(
        `Seed data created successfully. Batch ${batchId} created ${createdQuestions} questions.`,
        "success"
      );
    } catch (error) {
      const message = error?.message || "Unable to seed development data right now.";
      setDevToolsFeedback(message, "error");
    } finally {
      setDevToolsSubmitting("seed", false);
    }
  });

  clearForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const seedBatchInput = document.getElementById("dev-tools-seed-batch-id");
    const seedBatchId = String(seedBatchInput?.value || "").trim();
    const payload = seedBatchId ? { seedBatchId } : {};

    setDevToolsFeedback("", "success");
    setDevToolsSubmitting("clear", true);

    try {
      const result = await window.back4app.runCloudFunction("clearSeedData", payload);
      const deletedCounts = result?.deletedCounts || {};
      const totalDeleted = Object.values(deletedCounts).reduce(
        (sum, value) => sum + (Number.isFinite(value) ? value : 0),
        0
      );
      const scopeLabel = seedBatchId ? `batch ${seedBatchId}` : "all seeded data";
      setDevToolsFeedback(
        `Removed ${totalDeleted} seeded records from ${scopeLabel}.`,
        "success"
      );
    } catch (error) {
      const message = error?.message || "Unable to remove seeded data right now.";
      setDevToolsFeedback(message, "error");
    } finally {
      setDevToolsSubmitting("clear", false);
    }
  });
}

function setEditInstitutionNotice(message, type) {
  const notice = document.getElementById("edit-institution-notice");
  if (!notice) return;

  if (!message) {
    notice.textContent = "";
    notice.classList.add("hidden");
    notice.classList.remove("success", "error");
    return;
  }

  notice.textContent = message;
  notice.classList.remove("hidden", "success", "error");
  notice.classList.add(type === "success" ? "success" : "error");
}

function resetInstitutionForm() {
  const form = document.getElementById("add-institution-form");
  const activeCheckbox = document.getElementById("institution-active");
  if (form) {
    form.reset();
  }
  if (activeCheckbox) {
    activeCheckbox.checked = true;
  }
}

function clearInstitutionForm() {
  resetInstitutionForm();
  setInstitutionFormNotice("", "success");
}

function getUserLastName(displayName) {
  const normalizedName = String(displayName || "").trim().replace(/\s+/g, " ");
  if (!normalizedName) return "";

  const parts = normalizedName.split(" ");
  return parts[parts.length - 1].toLowerCase();
}

function formatUserDisplayName(user) {
  const displayName = String(user?.displayName || "").trim() || "Unnamed User";
  const credentials = String(user?.credentials || "").trim();
  return credentials ? `${displayName}, ${credentials}` : displayName;
}

function getCurrentParseUserDisplayName() {
  if (typeof Parse === "undefined" || typeof Parse.User?.current !== "function") {
    return "";
  }

  const currentUser = Parse.User.current();
  if (!currentUser) return "";

  const displayName = String(
    currentUser.get?.("displayName") ||
      currentUser.attributes?.displayName ||
      currentUser.get?.("username") ||
      currentUser.getUsername?.() ||
      ""
  ).trim();
  const credentials = String(
    currentUser.get?.("credentials") || currentUser.attributes?.credentials || ""
  ).trim();

  return displayName && credentials ? `${displayName}, ${credentials}` : displayName;
}

function populateQuestionAuthorField() {
  const authorInput = document.getElementById("add-question-author");
  if (!authorInput) return;

  authorInput.value = getCurrentParseUserDisplayName();
}

function setQuestionGenerationNotice(message, type) {
  const notice = document.getElementById("question-generate-notice");
  if (!notice) return;

  if (!message) {
    notice.innerHTML = "";
    notice.classList.remove("is-visible", "error", "success", "loading");
    return;
  }

  const variant = type === "success" ? "success" : type === "loading" ? "loading" : "error";
  notice.classList.remove("error", "success", "loading");
  notice.classList.add(variant);
  notice.classList.add("is-visible");
  notice.innerHTML =
    variant === "loading"
      ? '<span class="question-generate-inline-spinner" aria-hidden="true"></span><span>Generating question...</span>'
      : `<span>${escapeHtml(message)}</span>`;
}

function setQuestionGenerationSubmitting(isSubmitting) {
  const submitButton = document.getElementById("question-generate-submit");
  const cancelButton = document.getElementById("question-generate-cancel-button");
  const closeButton = document.getElementById("question-generate-cancel");
  const sourceTextarea = document.getElementById("question-generate-source");
  const notesTextarea = document.getElementById("question-generate-notes-input");
  const hasMediaCheckbox = document.getElementById("question-generate-has-media");

  if (submitButton) {
    const generationStatus = pageState.questionGenerationState?.status || "idle";
    submitButton.disabled = isSubmitting;
    submitButton.textContent =
      generationStatus === "ready"
        ? "Accept Question"
        : generationStatus === "error"
          ? "Try Again"
          : "Generate Question";
  }

  [cancelButton, closeButton, sourceTextarea, notesTextarea, hasMediaCheckbox].forEach((element) => {
    if (element) {
      element.disabled = isSubmitting;
    }
  });
}

function openQuestionGenerateOverlay() {
  const overlay = document.getElementById("question-generate-overlay");
  const sourceTextarea = document.getElementById("question-generate-source");
  if (!overlay) return;

  pageState.questionGenerationState = {
    status: "idle",
    draft: null,
  };
  setQuestionGenerationNotice("", "success");
  setQuestionGenerationSubmitting(false);
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");

  if (sourceTextarea) {
    window.setTimeout(() => sourceTextarea.focus(), 0);
  }
}

function closeQuestionGenerateOverlay({ clearInput = false } = {}) {
  const overlay = document.getElementById("question-generate-overlay");
  const form = document.getElementById("question-generate-form");
  if (!overlay) return;

  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  pageState.questionGenerationState = {
    status: "idle",
    draft: null,
  };
  setQuestionGenerationNotice("", "success");
  setQuestionGenerationSubmitting(false);

  if (clearInput && form) {
    form.reset();
  }
}

function questionEditorHasDraftContent() {
  const stem = document.getElementById("add-question-stem")?.value.trim() || "";
  const critique = document.getElementById("add-question-critique")?.value.trim() || "";
  return Boolean(
    stem ||
      critique ||
      questionEditorHasOptionContent() ||
      collectQuestionReferencePayloads().length > 0
  );
}

function applyGeneratedQuestionDraftToEditor(draft) {
  const stemTextarea = document.getElementById("add-question-stem");
  const critiqueTextarea = document.getElementById("add-question-critique");
  const questionTypeSelect = document.getElementById("add-question-type");

  if (!pageState.questionEditor) {
    initializeQuestionEditorState();
  }

  if (stemTextarea) {
    stemTextarea.value = String(draft?.stem || "");
    bindAutoResizingTextarea(stemTextarea);
  }

  if (critiqueTextarea) {
    critiqueTextarea.value = String(draft?.critique || "");
    bindAutoResizingTextarea(critiqueTextarea);
  }

  if (questionTypeSelect) {
    questionTypeSelect.value = QUESTION_TYPE_MULTIPLE_CHOICE;
  }

  pageState.questionEditor.questionType = QUESTION_TYPE_MULTIPLE_CHOICE;
  pageState.questionEditor.options = (Array.isArray(draft?.options) ? draft.options : []).map((option) =>
    createQuestionOption({
      text: String(option?.text || ""),
      isCorrect: Boolean(option?.isCorrect),
      locked: false,
    })
  );
  pageState.questionEditor.references = (Array.isArray(draft?.references) ? draft.references : []).map(
    (reference) =>
      createQuestionReference({
        parseInput: String(reference?.citationText || ""),
        title: String(reference?.title || ""),
        authors: String(reference?.authors || ""),
        journal: String(reference?.journal || ""),
        year:
          reference?.year === null || reference?.year === undefined ? "" : String(reference.year),
        volume: String(reference?.volume || ""),
        issue: String(reference?.issue || ""),
        pages: String(reference?.pages || ""),
        doi: String(reference?.doi || ""),
        pmid: String(reference?.pmid || ""),
        url: String(reference?.url || ""),
        citationText: String(reference?.citationText || ""),
        note: String(reference?.note || ""),
      })
  );

  if (pageState.questionEditor.references.length === 0) {
    pageState.questionEditor.references = [createQuestionReference()];
  }

  pageState.questionAiMetadata = {
    generatedByAI: Boolean(draft?.generatedByAI),
    aiModel: String(draft?.aiModel || ""),
    aiPromptVersion: String(draft?.aiPromptVersion || ""),
  };

  renderQuestionOptionsEditor();
  renderQuestionReferencesEditor();
}

function setQuestionsFeedback(message, type) {
  const feedback = document.getElementById("questions-feedback");
  if (!feedback) return;

  if (!message) {
    feedback.textContent = "";
    feedback.classList.add("hidden");
    feedback.classList.remove("success", "error");
    return;
  }

  feedback.textContent = message;
  feedback.classList.remove("hidden", "success", "error");
  feedback.classList.add(type === "success" ? "success" : "error");
}

function setQuestionSaveSubmitting(isSubmitting) {
  const button = document.getElementById("save-question-button");
  if (!button) return;

  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? "Saving..." : "Save Article";
}

function buildQuestionEditUrl(objectId) {
  return `edit.html?id=${encodeURIComponent(objectId)}`;
}

function formatQuestionListDate(value) {
  if (!value) return "Not set";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  const formattedTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${formattedDate}\n${formattedTime}`;
}

function truncateQuestionPreview(value, maxLength = 140) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function compareQuestionText(leftValue, rightValue) {
  return String(leftValue || "").localeCompare(String(rightValue || ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function getQuestionOrderValue(question) {
  const orderValue = question?.questionNumber ?? question?.displayOrder ?? "";
  if (typeof orderValue === "number") {
    return { rank: orderValue, label: String(orderValue) };
  }

  const normalized = String(orderValue || "").trim();
  const numericValue = Number(normalized);

  if (normalized && Number.isFinite(numericValue)) {
    return { rank: numericValue, label: normalized };
  }

  return {
    rank: normalized ? Number.MAX_SAFE_INTEGER - 1 : Number.MAX_SAFE_INTEGER,
    label: normalized,
  };
}

function getQuestionStatusClassName(value, prefix) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized ? `${prefix}-${normalized}` : `${prefix}-default`;
}

function normalizeQuestionRecord(question) {
  const safeQuestion = question && typeof question === "object" ? question : {};
  const correctOption = Array.isArray(safeQuestion.questionOptions)
    ? safeQuestion.questionOptions.find((option) => option?.isCorrect)
    : null;
  const questionNumberValue = safeQuestion.questionNumber;
  const displayOrderValue = safeQuestion.displayOrder;
  const sectionValue = safeQuestion.section || safeQuestion.topic || "";
  const stemValue = safeQuestion.questionText || safeQuestion.stem || "";
  const editorStatusValue = safeQuestion.editorStatus || safeQuestion.status || "";
  const createdAtValue = safeQuestion.createdAt || "";
  const lastReviewedValue = safeQuestion.lastReviewedAt || safeQuestion.approvedAt || "";
  const updatedAtValue = safeQuestion.updatedAt || "";

  return {
    objectId: safeQuestion.objectId || "",
    questionNumber: questionNumberValue ?? displayOrderValue ?? "",
    displayOrder: displayOrderValue ?? questionNumberValue ?? "",
    specialty: safeQuestion.specialty || "",
    section: sectionValue,
    questionText: stemValue,
    stemPreview: truncateQuestionPreview(stemValue, 140),
    correctAnswer: correctOption
      ? [String(correctOption.label || "").trim(), String(correctOption.text || "").trim()]
          .filter(Boolean)
          .join(". ")
      : String(safeQuestion.correctAnswer || "").trim(),
    difficulty: safeQuestion.difficulty || "",
    editorStatus: editorStatusValue,
    createdAt: typeof createdAtValue === "string" ? createdAtValue : "",
    updatedAt: typeof updatedAtValue === "string" ? updatedAtValue : "",
    lastReviewedAt: typeof lastReviewedValue === "string" ? lastReviewedValue : "",
  };
}

function populateQuestionFilterSelect(elementId, values, emptyLabel) {
  const select = document.getElementById(elementId);
  if (!select) return;

  const currentValue = select.value;
  const options = [
    `<option value="">${emptyLabel}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
  ];

  select.innerHTML = options.join("");
  if (values.includes(currentValue)) {
    select.value = currentValue;
  }
}

function syncQuestionFilterOptions(questions) {
  const specialties = [...new Set(questions.map((question) => question.specialty).filter(Boolean))].sort(
    compareQuestionText
  );
  const sections = [...new Set(questions.map((question) => question.section).filter(Boolean))].sort(
    compareQuestionText
  );
  const statuses = [...new Set(questions.map((question) => question.editorStatus).filter(Boolean))].sort(
    compareQuestionText
  );
  const difficulties = [...new Set(questions.map((question) => question.difficulty).filter(Boolean))].sort(
    compareQuestionText
  );

  populateQuestionFilterSelect("question-specialty-filter", specialties, "All specialties");
  populateQuestionFilterSelect("question-section-filter", sections, "All sections");
  populateQuestionFilterSelect("question-status-filter", statuses, "All statuses");
  populateQuestionFilterSelect("question-difficulty-filter", difficulties, "All difficulties");
}

function renderQuestionAddSpecialtyOptions(specialties) {
  const select = document.getElementById("add-question-specialty");
  if (!select) return;

  if (!Array.isArray(specialties) || specialties.length === 0) {
    select.innerHTML = '<option value="">No active specialties available</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = [
    '<option value=""></option>',
    ...specialties.map((specialty) => {
      const label = specialty.name || "Unnamed Specialty";
      return `<option value="${escapeHtml(specialty.objectId || "")}">${escapeHtml(label)}</option>`;
    }),
  ].join("");
}

function renderQuestionAddStatusOptions(statuses) {
  const select = document.getElementById("add-question-status");
  if (!select) return;

  if (!Array.isArray(statuses) || statuses.length === 0) {
    select.innerHTML = '<option value="">No active statuses available</option>';
    select.disabled = true;
    return;
  }

  const draftStatus = statuses.find(
    (status) => normalizeLookupText(status?.name) === "draft"
  );

  select.disabled = false;
  select.innerHTML = statuses
    .map((status) => {
      const name = status.name || "Unnamed Status";
      const isSelected = draftStatus?.objectId === status.objectId;
      return `<option value="${escapeHtml(name)}"${isSelected ? " selected" : ""}>${escapeHtml(
        name
      )}</option>`;
    })
    .join("");
}

function applyQuestionStatusAccent(statusName) {
  const card = document.getElementById("question-add-card");
  const select = document.getElementById("add-question-status");
  if (!card) return;

  const selectedStatus = (pageState.activeStatuses || []).find(
    (status) => normalizeLookupText(status?.name) === normalizeLookupText(statusName)
  );

  const accentColor = selectedStatus?.color || "transparent";
  card.style.borderLeftColor = accentColor;
  if (select) {
    select.style.borderColor = accentColor;
    select.style.backgroundColor =
      accentColor && accentColor !== "transparent" ? `${accentColor}14` : "";
  }
}

function getSelectedOptionLabel(select) {
  if (!select) return "";
  const selectedOption = select.options[select.selectedIndex];
  return selectedOption ? String(selectedOption.textContent || "").trim() : "";
}

function renderQuestionAddTopicOptions(topics, { placeholder = "Select a specialty first" } = {}) {
  const select = document.getElementById("add-question-topic");
  if (!select) return;

  if (!Array.isArray(topics) || topics.length === 0) {
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = [
    '<option value="">Select a topic</option>',
    ...topics.map((topic) => {
      const label = topic.name || "Unnamed Topic";
      return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
    }),
  ].join("");
}

function normalizeLookupText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function findSpecialtyByName(name) {
  const normalizedName = normalizeLookupText(name);
  return (pageState.activeSpecialties || []).find(
    (specialty) => normalizeLookupText(specialty?.name) === normalizedName
  );
}

function setQuestionTopicCreatorState({ visible, enabled, submitting = false } = {}) {
  const container = document.getElementById("question-topic-create");
  const input = document.getElementById("add-question-topic-name");
  const button = document.getElementById("add-question-topic-button");

  if (!container || !input || !button) return;

  container.classList.toggle("is-visible", Boolean(visible));
  container.setAttribute("aria-hidden", String(!visible));
  input.disabled = !enabled || submitting;
  button.disabled = !enabled || submitting;
  button.textContent = submitting ? "Adding..." : "Add Topic";
}

async function loadQuestionTopicsForSpecialty(specialtyObjectId) {
  if (!specialtyObjectId) {
    renderQuestionAddTopicOptions([], { placeholder: "Select a specialty first" });
    return;
  }

  renderQuestionAddTopicOptions([], { placeholder: "Loading topics..." });

  const selectedSpecialty = (pageState.activeSpecialties || []).find(
    (specialty) => specialty?.objectId === specialtyObjectId
  );

  if (normalizeLookupText(selectedSpecialty?.name) === "adult cardiac surgery") {
    const cardiothoracicSpecialty = findSpecialtyByName("Cardiothoracic Surgery");
    const generalThoracicSpecialty = findSpecialtyByName("General Thoracic Surgery");

    if (cardiothoracicSpecialty?.objectId) {
      await window.back4app.runCloudFunction("syncSubsetTopics", {
        targetSpecialtyObjectId: specialtyObjectId,
        sourceSpecialtyObjectId: cardiothoracicSpecialty.objectId,
        excludedSpecialtyObjectId: generalThoracicSpecialty?.objectId || "",
      });
    }
  }

  const topics = await window.back4app.runCloudFunction("listTopics", {
    specialtyObjectId,
  });
  const matchingTopics = Array.isArray(topics) ? topics : [];

  if (matchingTopics.length === 0) {
    renderQuestionAddTopicOptions([], { placeholder: "No topics available for this specialty" });
    return;
  }

  renderQuestionAddTopicOptions(matchingTopics);
}

async function addQuestionTopicForSelectedSpecialty() {
  const specialtySelect = document.getElementById("add-question-specialty");
  const topicSelect = document.getElementById("add-question-topic");
  const topicInput = document.getElementById("add-question-topic-name");

  const specialtyObjectId = specialtySelect?.value?.trim() || "";
  const topicName = topicInput?.value?.trim() || "";

  if (!specialtyObjectId) {
    setQuestionsFeedback("Select a specialty before adding a topic.", "error");
    return;
  }

  if (!topicName) {
    setQuestionsFeedback("Topic name is required.", "error");
    return;
  }

  setQuestionTopicCreatorState({ visible: true, enabled: true, submitting: true });
  setQuestionsFeedback("", "success");

  try {
    const result = await window.back4app.runCloudFunction("addTopic", {
      name: topicName,
      specialtyObjectId,
    });

    await loadQuestionTopicsForSpecialty(specialtyObjectId);
    if (topicSelect) {
      topicSelect.value = result?.name || topicName;
    }
    if (topicInput) {
      topicInput.value = "";
    }

    setQuestionsFeedback(
      result?.created === false
        ? `Topic ${result.name} already exists and is now selected.`
        : `Added topic ${result?.name || topicName}.`,
      "success"
    );
  } catch (error) {
    console.error("Unable to add topic.", error);
    setQuestionsFeedback(error?.message || "Unable to add topic right now. Please try again.", "error");
  } finally {
    setQuestionTopicCreatorState({ visible: true, enabled: true, submitting: false });
  }
}

function collectQuestionAddPayload() {
  const specialtySelect = document.getElementById("add-question-specialty");
  const topicSelect = document.getElementById("add-question-topic");
  const statusSelect = document.getElementById("add-question-status");
  const currentUserId =
    typeof Parse !== "undefined" && typeof Parse.User?.current === "function"
      ? Parse.User.current()?.id || ""
      : "";

  return {
    stem: document.getElementById("add-question-stem")?.value.trim() || "",
    critique: document.getElementById("add-question-critique")?.value.trim() || "",
    specialty: getSelectedOptionLabel(specialtySelect),
    topic: topicSelect?.value.trim() || "",
    difficulty: document.getElementById("add-question-difficulty")?.value || "",
    status: statusSelect?.value || "",
    createdByObjectId: currentUserId,
    lastEditedByObjectId: currentUserId,
    lastEditedAt: new Date().toISOString(),
    generatedByAI: Boolean(pageState.questionAiMetadata?.generatedByAI),
    aiModel: String(pageState.questionAiMetadata?.aiModel || ""),
    aiPromptVersion: String(pageState.questionAiMetadata?.aiPromptVersion || ""),
  };
}

function validateQuestionAddPayload(payload) {
  if (!payload.specialty) return "Specialty is required.";
  if (!payload.topic) return "Topic is required.";
  if (!payload.difficulty) return "Difficulty is required.";
  if (!payload.status) return "Article Status is required.";
  if (!payload.stem) return "Question Stem is required.";

  const editor = pageState.questionEditor;
  if (!editor) return "Question editor is not ready.";

  const populatedOptions = editor.options.filter((option) => option.text.trim().length > 0);
  const correctOptions = populatedOptions.filter((option) => option.isCorrect);

  if (editor.questionType === QUESTION_TYPE_TRUE_FALSE) {
    const values = editor.options.map((option) => option.text.trim());
    if (values.length !== 2 || values[0] !== "True" || values[1] !== "False") {
      return "True / False questions must contain exactly the options True and False.";
    }
  } else {
    if (editor.options.length < 3) {
      return "Multiple-choice questions must contain at least three answer options.";
    }

    if (populatedOptions.length < 3) {
      return "Please enter at least three answer options before saving.";
    }
  }

  if (correctOptions.length !== 1) {
    return "Exactly one populated answer option must be marked correct.";
  }

  return "";
}

function collectQuestionOptionPayloads() {
  if (!pageState.questionEditor) return [];

  const relevantOptions =
    pageState.questionEditor.questionType === QUESTION_TYPE_TRUE_FALSE
      ? pageState.questionEditor.options
      : pageState.questionEditor.options.filter((option) => option.text.trim().length > 0);

  return relevantOptions.map((option, index) => ({
    label: getQuestionOptionLabel(index),
    text: option.text.trim(),
    isCorrect: option.isCorrect,
    sortOrder: index,
  }));
}

function questionReferenceHasContent(reference) {
  return [
    reference.title,
    reference.authors,
    reference.journal,
    reference.year,
    reference.volume,
    reference.issue,
    reference.pages,
    reference.doi,
    reference.pmid,
    reference.url,
    reference.citationText,
    reference.note,
    reference.parseInput,
  ].some((value) => String(value || "").trim().length > 0);
}

function collectQuestionReferencePayloads() {
  if (!pageState.questionEditor) return [];

  return pageState.questionEditor.references
    .filter((reference) => questionReferenceHasContent(reference))
    .map((reference, index) => {
      const parsedYear = Number.parseInt(String(reference.year || "").trim(), 10);

      return {
        title: String(reference.title || "").trim(),
        authors: String(reference.authors || "").trim(),
        journal: String(reference.journal || "").trim(),
        year: Number.isFinite(parsedYear) ? parsedYear : undefined,
        volume: String(reference.volume || "").trim(),
        issue: String(reference.issue || "").trim(),
        pages: String(reference.pages || "").trim(),
        doi: String(reference.doi || "").trim(),
        pmid: String(reference.pmid || "").trim(),
        url: String(reference.url || "").trim(),
        citationText: String(reference.citationText || reference.parseInput || "").trim(),
        note: String(reference.note || "").trim(),
        sortOrder: index,
        isPrimary: index === 0,
      };
    });
}

function getQuestionMediaGroups() {
  return [
    {
      inputId: "add-question-images",
      listId: "add-question-images-list",
      placement: "QUESTION",
      mediaType: "IMAGE",
    },
    {
      inputId: "add-question-videos",
      listId: "add-question-videos-list",
      placement: "QUESTION",
      mediaType: "VIDEO",
    },
    {
      inputId: "add-question-critique-images",
      listId: "add-question-critique-images-list",
      placement: "CRITIQUE",
      mediaType: "IMAGE",
    },
    {
      inputId: "add-question-critique-videos",
      listId: "add-question-critique-videos-list",
      placement: "CRITIQUE",
      mediaType: "VIDEO",
    },
  ];
}

function buildQuestionMediaFileId(file) {
  return [
    String(file?.name || ""),
    String(file?.size || 0),
    String(file?.lastModified || 0),
    String(file?.type || ""),
  ].join("::");
}

function initializeQuestionMediaSelections() {
  pageState.questionMediaSelections = {};
  getQuestionMediaGroups().forEach((group) => {
    pageState.questionMediaSelections[group.inputId] = [];
  });
}

function renderQuestionMediaSelections() {
  getQuestionMediaGroups().forEach((group) => {
    const list = document.getElementById(group.listId);
    if (!list) return;

    const files = Array.isArray(pageState.questionMediaSelections?.[group.inputId])
      ? pageState.questionMediaSelections[group.inputId]
      : [];

    list.innerHTML = files
      .map(
        (entry) => `
          <span class="question-media-chip">
            <span class="question-media-chip-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(
              entry.file.name
            )}</span>
            <button
              type="button"
              class="question-media-chip-remove"
              data-input-id="${escapeHtml(group.inputId)}"
              data-file-id="${escapeHtml(entry.id)}"
              aria-label="Remove ${escapeHtml(entry.file.name)}"
              title="Remove file"
            >
              ×
            </button>
          </span>
        `
      )
      .join("");
  });
}

function appendQuestionMediaSelections(inputId, files) {
  if (!pageState.questionMediaSelections?.[inputId]) {
    pageState.questionMediaSelections[inputId] = [];
  }

  const existingEntries = pageState.questionMediaSelections[inputId];
  const existingIds = new Set(existingEntries.map((entry) => entry.id));

  Array.from(files || []).forEach((file) => {
    const fileId = buildQuestionMediaFileId(file);
    if (existingIds.has(fileId)) return;

    existingEntries.push({
      id: fileId,
      file,
    });
    existingIds.add(fileId);
  });

  renderQuestionMediaSelections();
}

function removeQuestionMediaSelection(inputId, fileId) {
  if (!pageState.questionMediaSelections?.[inputId]) return;

  pageState.questionMediaSelections[inputId] = pageState.questionMediaSelections[inputId].filter(
    (entry) => entry.id !== fileId
  );
  renderQuestionMediaSelections();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Unable to read file ${file.name}.`));

    reader.readAsDataURL(file);
  });
}

async function uploadQuestionMediaFiles(questionId) {
  const uploadTasks = [];

  getQuestionMediaGroups().forEach((group) => {
    const files = Array.isArray(pageState.questionMediaSelections?.[group.inputId])
      ? pageState.questionMediaSelections[group.inputId].map((entry) => entry.file)
      : [];

    files.forEach((file, index) => {
      uploadTasks.push({
        file,
        placement: group.placement,
        mediaType: group.mediaType,
        sortOrder: index,
      });
    });
  });

  for (const task of uploadTasks) {
    const base64Data = await readFileAsDataUrl(task.file);

    await window.back4app.runCloudFunction("uploadQuestionMedia", {
      questionId,
      fileName: task.file.name,
      contentType: task.file.type || (task.mediaType === "IMAGE" ? "image/*" : "video/*"),
      base64Data,
      placement: task.placement,
      mediaType: task.mediaType,
      sortOrder: task.sortOrder,
    });
  }
}

async function collectQuestionMediaPayloads() {
  const mediaPayloads = [];

  for (const group of getQuestionMediaGroups()) {
    const files = Array.isArray(pageState.questionMediaSelections?.[group.inputId])
      ? pageState.questionMediaSelections[group.inputId].map((entry) => entry.file)
      : [];

    for (const [index, file] of files.entries()) {
      mediaPayloads.push({
        fileName: file.name,
        contentType: file.type || (group.mediaType === "IMAGE" ? "image/*" : "video/*"),
        base64Data: await readFileAsDataUrl(file),
        placement: group.placement,
        mediaType: group.mediaType,
        sortOrder: index,
      });
    }
  }

  return mediaPayloads;
}

async function saveQuestionArticle() {
  const questionPayload = collectQuestionAddPayload();
  const validationMessage = validateQuestionAddPayload(questionPayload);

  if (validationMessage) {
    setQuestionsFeedback(validationMessage, "error");
    return;
  }

  setQuestionsFeedback("", "success");
  setQuestionSaveSubmitting(true);

  try {
    const optionPayloads = collectQuestionOptionPayloads();
    const referencePayloads = collectQuestionReferencePayloads();
    const mediaPayloads = await collectQuestionMediaPayloads();

    await window.back4app.runCloudFunction("saveQuestionBundle", {
      question: questionPayload,
      options: optionPayloads,
      references: referencePayloads,
      media: mediaPayloads,
      editHistory: {
        previousStatus: "",
        newStatus: questionPayload.status,
        changeSummary: questionPayload.generatedByAI
          ? "Initial AI-assisted article draft created."
          : "Initial article draft created.",
      },
    });

    setQuestionsFeedback("Article saved successfully.", "success");
  } catch (error) {
    console.error("Unable to save article.", error);
    const message = error?.message || "Unable to save the article right now.";
    setQuestionsFeedback(message, "error");
  } finally {
    setQuestionSaveSubmitting(false);
  }
}

function collectQuestionGenerationPayload() {
  const specialtySelect = document.getElementById("add-question-specialty");
  const topicSelect = document.getElementById("add-question-topic");

  return {
    sourceText: document.getElementById("question-generate-source")?.value.trim() || "",
    generatorNotes: document.getElementById("question-generate-notes-input")?.value.trim() || "",
    specialty: getSelectedOptionLabel(specialtySelect),
    topic: topicSelect?.value.trim() || "",
    difficulty: document.getElementById("add-question-difficulty")?.value || "",
    hasMedia: Boolean(document.getElementById("question-generate-has-media")?.checked),
  };
}

async function generateAiQuestionDraft() {
  if (pageState.questionGenerationState?.status === "ready" && pageState.questionGenerationState?.draft) {
    applyGeneratedQuestionDraftToEditor(pageState.questionGenerationState.draft);
    closeQuestionGenerateOverlay({ clearInput: true });
    setQuestionsFeedback("AI draft added. Review and edit it before saving.", "success");
    return;
  }

  const payload = collectQuestionGenerationPayload();
  if (!payload.sourceText) {
    setQuestionGenerationNotice("Question input is required.", "error");
    pageState.questionGenerationState = {
      status: "error",
      draft: null,
    };
    setQuestionGenerationSubmitting(false);
    return;
  }

  if (
    questionEditorHasDraftContent() &&
    !window.confirm("Generating a new AI draft will replace the current stem, options, critique, and references. Continue?")
  ) {
    return;
  }

  pageState.questionGenerationState = {
    status: "loading",
    draft: null,
  };
  setQuestionGenerationNotice("Generating question...", "loading");
  setQuestionGenerationSubmitting(true);

  try {
    const generatedDraft = await window.back4app.runCloudFunction("generateQuestionDraft", payload);
    pageState.questionGenerationState = {
      status: "ready",
      draft: generatedDraft || {},
    };
    setQuestionGenerationNotice("Question draft generated. Review it, then accept it.", "success");
    setQuestionGenerationSubmitting(false);
  } catch (error) {
    console.error("Unable to generate AI question draft.", error);
    pageState.questionGenerationState = {
      status: "error",
      draft: null,
    };
    setQuestionGenerationNotice(
      error?.message || "Unable to generate an AI draft right now. Please try again.",
      "error"
    );
    setQuestionGenerationSubmitting(false);
  }
}

function bindAutoResizingTextarea(textarea) {
  if (!textarea) return;

  const resizeTextarea = () => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  textarea.addEventListener("input", resizeTextarea);
  resizeTextarea();
}

function createQuestionOption(overrides = {}) {
  const optionId = `option-${pageState.questionEditor.nextOptionId++}`;
  return {
    id: optionId,
    text: "",
    isCorrect: false,
    locked: false,
    ...overrides,
  };
}

function buildMultipleChoiceOptions(count = 5) {
  return Array.from({ length: count }, () => createQuestionOption());
}

function createQuestionReference(overrides = {}) {
  const referenceId = `reference-${pageState.questionEditor.nextReferenceId++}`;
  return {
    id: referenceId,
    parseInput: "",
    parseError: "",
    isParsing: false,
    title: "",
    authors: "",
    journal: "",
    year: "",
    volume: "",
    issue: "",
    pages: "",
    doi: "",
    pmid: "",
    url: "",
    citationText: "",
    note: "",
    ...overrides,
  };
}

function buildTrueFalseOptions() {
  return [
    createQuestionOption({ text: "True", locked: true }),
    createQuestionOption({ text: "False", locked: true }),
  ];
}

function initializeQuestionEditorState() {
  pageState.questionAiMetadata = null;
  pageState.questionEditor = {
    questionType: QUESTION_TYPE_MULTIPLE_CHOICE,
    nextOptionId: 1,
    nextReferenceId: 1,
    dragOptionId: "",
    options: [],
    references: [],
  };

  pageState.questionEditor.options = buildMultipleChoiceOptions();
  pageState.questionEditor.references = [createQuestionReference()];
}

function renderQuestionReferencesEditor() {
  const list = document.getElementById("question-references-list");
  if (!list || !pageState.questionEditor) return;

  list.innerHTML = pageState.questionEditor.references
    .map((reference, index) => {
      const hasParseInput = String(reference.parseInput || "").trim().length > 0;
      const removeButton =
        pageState.questionEditor.references.length > 1
          ? `<button
              type="button"
              class="button button-secondary question-reference-remove"
              data-reference-id="${escapeHtml(reference.id)}"
            >
              Remove
            </button>`
          : "";

      return `
        <article class="question-reference-card" data-reference-id="${escapeHtml(reference.id)}">
          <div class="question-reference-card-header">
            <p class="question-reference-card-title">Reference ${index + 1}</p>
            ${removeButton}
          </div>
          <div class="question-reference-parse-panel">
            <div class="question-reference-parse-header">
              <div>
                <p class="question-reference-parse-title">Paste Formatted Reference</p>
                <p class="question-reference-parse-help">Paste a formatted citation, PMID-style reference, DOI reference, or guideline citation. AI will fill the fields below for review, or you can enter the fields manually if you prefer.</p>
              </div>
              <button
                type="button"
                class="button ${
                  hasParseInput ? "button-primary" : "button-secondary"
                } question-reference-parse-button ${reference.isParsing ? "is-loading" : ""}"
                data-reference-parse="${escapeHtml(reference.id)}"
                ${reference.isParsing ? "disabled" : ""}
              >
                ${
                  reference.isParsing
                    ? '<span class="question-reference-parse-spinner" aria-hidden="true"></span><span>Parsing...</span>'
                    : "Parse Reference"
                }
              </button>
            </div>
            <textarea
              rows="3"
              class="question-reference-parse-input"
              data-reference-id="${escapeHtml(reference.id)}"
              data-field="parseInput"
              placeholder="Paste the full citation here."
              ${reference.isParsing ? "disabled" : ""}
            >${escapeHtml(reference.parseInput)}</textarea>
            ${
              reference.parseError
                ? `<p class="question-reference-parse-error">${escapeHtml(reference.parseError)}</p>`
                : ""
            }
          </div>
          <div class="question-reference-grid">
            <label class="question-reference-field span-8">
              Title
              <input type="text" data-reference-id="${escapeHtml(reference.id)}" data-field="title" value="${escapeHtml(reference.title)}" />
            </label>
            <label class="question-reference-field span-4">
              PMID
              <input type="text" inputmode="numeric" data-reference-id="${escapeHtml(reference.id)}" data-field="pmid" value="${escapeHtml(reference.pmid)}" />
            </label>
            <label class="question-reference-field span-8">
              Authors
              <input type="text" data-reference-id="${escapeHtml(reference.id)}" data-field="authors" value="${escapeHtml(reference.authors)}" />
            </label>
            <label class="question-reference-field span-4">
              DOI
              <input type="text" data-reference-id="${escapeHtml(reference.id)}" data-field="doi" value="${escapeHtml(reference.doi)}" />
            </label>
            <label class="question-reference-field span-6">
              Journal
              <input type="text" data-reference-id="${escapeHtml(reference.id)}" data-field="journal" value="${escapeHtml(reference.journal)}" />
            </label>
            <label class="question-reference-field span-6">
              URL
              <input type="text" data-reference-id="${escapeHtml(reference.id)}" data-field="url" value="${escapeHtml(reference.url)}" />
            </label>
            <label class="question-reference-field span-4">
              Pages
              <input type="text" data-reference-id="${escapeHtml(reference.id)}" data-field="pages" value="${escapeHtml(reference.pages)}" />
            </label>
            <label class="question-reference-field span-2">
              Volume
              <input type="text" data-reference-id="${escapeHtml(reference.id)}" data-field="volume" value="${escapeHtml(reference.volume)}" />
            </label>
            <label class="question-reference-field span-2">
              Issue
              <input type="text" data-reference-id="${escapeHtml(reference.id)}" data-field="issue" value="${escapeHtml(reference.issue)}" />
            </label>
            <label class="question-reference-field span-2">
              Year
              <input type="text" inputmode="numeric" data-reference-id="${escapeHtml(reference.id)}" data-field="year" value="${escapeHtml(reference.year)}" />
            </label>
            <label class="question-reference-field span-12">
              Note
              <textarea rows="2" data-reference-id="${escapeHtml(reference.id)}" data-field="note">${escapeHtml(reference.note)}</textarea>
            </label>
          </div>
        </article>
      `;
    })
    .join("");

  list.querySelectorAll("textarea").forEach((textarea) => bindAutoResizingTextarea(textarea));
}

async function parseQuestionReference(referenceId) {
  if (!pageState.questionEditor) return;

  const reference = pageState.questionEditor.references.find(
    (currentReference) => currentReference.id === referenceId
  );
  if (!reference) return;

  const citationText = String(reference.parseInput || "").trim();
  if (!citationText) {
    reference.parseError = "Paste a citation before parsing.";
    renderQuestionReferencesEditor();
    return;
  }

  reference.parseError = "";
  reference.isParsing = true;
  renderQuestionReferencesEditor();

  try {
    const parsedReference = await window.back4app.runCloudFunction("parseReferenceCitation", {
      citationText,
    });

    reference.title = String(parsedReference?.title || "");
    reference.authors = String(parsedReference?.authors || "");
    reference.journal = String(parsedReference?.journal || "");
    reference.year =
      parsedReference?.year === null || parsedReference?.year === undefined
        ? ""
        : String(parsedReference.year);
    reference.volume = String(parsedReference?.volume || "");
    reference.issue = String(parsedReference?.issue || "");
    reference.pages = String(parsedReference?.pages || "");
    reference.pmid = String(parsedReference?.pmid || "");
    reference.doi = String(parsedReference?.doi || "");
    reference.url = String(parsedReference?.url || "");
    reference.note = String(parsedReference?.note || "");
    reference.citationText = String(parsedReference?.citationText || citationText);
    reference.parseError = "";
  } catch (error) {
    console.error("Unable to parse reference citation.", error);
    reference.parseError =
      error?.message || "Unable to parse that citation right now. Please review it manually.";
  } finally {
    reference.isParsing = false;
    renderQuestionReferencesEditor();
  }
}

function getQuestionOptionLabel(index) {
  let label = "";
  let currentIndex = index;

  do {
    label = String.fromCharCode(65 + (currentIndex % 26)) + label;
    currentIndex = Math.floor(currentIndex / 26) - 1;
  } while (currentIndex >= 0);

  return label;
}

function questionEditorHasOptionContent() {
  const editor = pageState.questionEditor;
  if (!editor) return false;

  return editor.options.some((option) => option.text.trim() || option.isCorrect);
}

function updateQuestionTypeHelpText() {
  const helpText = document.getElementById("question-options-help");
  if (!helpText || !pageState.questionEditor) return;

  helpText.textContent =
    pageState.questionEditor.questionType === QUESTION_TYPE_TRUE_FALSE
      ? "True / False questions always contain exactly two locked options and one correct answer."
      : "Default multiple-choice questions start with five answer rows. Add, remove, drag, or shuffle as needed.";
}

function renderQuestionOptionValidation() {
  const notice = document.getElementById("question-option-validation");
  if (!notice || !pageState.questionEditor) return;

  const editor = pageState.questionEditor;
  const populatedOptions = editor.options.filter((option) => option.text.trim().length > 0);
  const correctOptions = populatedOptions.filter((option) => option.isCorrect);
  const warnings = [];
  const blockers = [];

  if (editor.questionType === QUESTION_TYPE_TRUE_FALSE) {
    const trueFalseValues = editor.options.map((option) => option.text.trim());
    if (trueFalseValues.length !== 2 || trueFalseValues[0] !== "True" || trueFalseValues[1] !== "False") {
      blockers.push("True / False questions must contain exactly the options True and False.");
    }
  } else {
    if (editor.options.length < 3) {
      blockers.push("Multiple-choice questions must contain at least three answer options.");
    }

    if (populatedOptions.length < 3) {
      blockers.push("Publish/approval requires at least three populated answer options.");
    }
  }

  if (correctOptions.length !== 1) {
    blockers.push("Exactly one correct answer must be selected.");
  }

  if (blockers.length === 0 && warnings.length === 0) {
    notice.textContent = "Answer options meet current publish/approval requirements.";
    notice.classList.remove("hidden", "warning", "error");
    notice.classList.add("success");
    return;
  }

  notice.classList.remove("hidden", "success", "warning", "error");
  if (blockers.length > 0) {
    notice.textContent = [...blockers, ...warnings].join(" ");
    notice.classList.add("error");
    return;
  }

  notice.textContent = warnings.join(" ");
  notice.classList.add("warning");
}

function renderQuestionOptionsEditor() {
  const list = document.getElementById("question-options-list");
  const shuffleButton = document.getElementById("shuffle-question-options");
  const shuffleTooltip = document.getElementById("shuffle-question-options-tooltip");
  const addButton = document.getElementById("add-question-option");
  const addTooltip = document.getElementById("add-question-option-tooltip");
  if (!list || !pageState.questionEditor) return;

  const editor = pageState.questionEditor;
  const isTrueFalse = editor.questionType === QUESTION_TYPE_TRUE_FALSE;
  const disableRemoveButton = isTrueFalse || editor.options.length <= 3;
  const populatedOptionCount = editor.options.filter((option) => option.text.trim().length > 0).length;

  list.innerHTML = editor.options
    .map((option, index) => {
      const optionLabel = getQuestionOptionLabel(index);
      const optionText = escapeHtml(option.text);
      const optionId = escapeHtml(option.id);

      return `
        <div
          class="question-option-row${isTrueFalse ? " is-locked" : ""}"
          data-option-id="${optionId}"
          draggable="${isTrueFalse ? "false" : "true"}"
        >
          <button
            type="button"
            class="question-option-drag"
            aria-label="Drag to reorder option ${optionLabel}"
            title="${isTrueFalse ? "Reordering is unavailable for True / False questions" : "Drag to reorder"}"
            ${isTrueFalse ? "disabled" : ""}
          >
            ⋮⋮
          </button>
          <span class="question-option-label">${optionLabel}</span>
          <label class="question-option-correct">
            <input
              type="radio"
              name="question-correct-option"
              class="question-option-correct-input"
              data-option-id="${optionId}"
              ${option.isCorrect ? "checked" : ""}
            />
            <span>Correct</span>
          </label>
          <textarea
            class="question-option-text"
            data-option-id="${optionId}"
            rows="2"
            placeholder="Enter answer option text."
            ${isTrueFalse ? "readonly" : ""}
          >${optionText}</textarea>
          <span
            class="question-button-tooltip"
            title="${
              isTrueFalse
                ? "Remove is unavailable for True / False questions."
                : disableRemoveButton
                  ? "Multiple-choice questions must keep at least three options."
                  : ""
            }"
          >
            <button
              type="button"
              class="question-option-remove button button-secondary"
              data-option-id="${optionId}"
              ${disableRemoveButton ? "disabled" : ""}
            >
              Remove
            </button>
          </span>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll(".question-option-text").forEach(bindAutoResizingTextarea);

  if (shuffleButton) {
    shuffleButton.classList.toggle("hidden", isTrueFalse);
    shuffleButton.disabled = isTrueFalse || populatedOptionCount < 3;
    if (shuffleTooltip) {
      shuffleTooltip.title = isTrueFalse
        ? "Random shuffle is unavailable for True / False questions."
        : populatedOptionCount < 3
          ? "Enter text for at least three options before shuffling."
          : "";
    }
  }

  if (addButton) {
    addButton.classList.toggle("hidden", isTrueFalse);
    addButton.disabled = isTrueFalse || editor.options.length >= 5;
    if (addTooltip) {
      addTooltip.title = isTrueFalse
        ? "Add Option is unavailable for True / False questions."
        : editor.options.length >= 5
          ? "A maximum of five options is allowed."
          : "";
    }
  }

  updateQuestionTypeHelpText();
  renderQuestionOptionValidation();
}

function setQuestionEditorType(nextType) {
  if (!pageState.questionEditor) return;

  pageState.questionEditor.questionType = nextType;
  pageState.questionEditor.options =
    nextType === QUESTION_TYPE_TRUE_FALSE
      ? buildTrueFalseOptions()
      : buildMultipleChoiceOptions();

  renderQuestionOptionsEditor();
}

function compactEmptyQuestionOptions() {
  const editor = pageState.questionEditor;
  if (!editor || editor.questionType !== QUESTION_TYPE_MULTIPLE_CHOICE) return;

  editor.options = editor.options.filter((option) => option.text.trim().length > 0);
}

function moveQuestionOption(sourceId, targetId) {
  const editor = pageState.questionEditor;
  if (!editor || !sourceId || !targetId || sourceId === targetId) return;

  compactEmptyQuestionOptions();

  const sourceIndex = editor.options.findIndex((option) => option.id === sourceId);
  const targetIndex = editor.options.findIndex((option) => option.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0) return;

  const [movedOption] = editor.options.splice(sourceIndex, 1);
  editor.options.splice(targetIndex, 0, movedOption);
  renderQuestionOptionsEditor();
}

function shuffleQuestionOptions() {
  const editor = pageState.questionEditor;
  if (!editor || editor.questionType !== QUESTION_TYPE_MULTIPLE_CHOICE) return;

  const populatedOptionCount = editor.options.filter((option) => option.text.trim().length > 0).length;
  if (populatedOptionCount < 3) {
    return;
  }

  const hasEnteredText = editor.options.some((option) => option.text.trim().length > 0);
  if (hasEnteredText && !window.confirm("Shuffle the current answer options? Their order will change.")) {
    return;
  }

  compactEmptyQuestionOptions();

  const shuffledOptions = [...editor.options];
  for (let index = shuffledOptions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledOptions[index], shuffledOptions[swapIndex]] = [
      shuffledOptions[swapIndex],
      shuffledOptions[index],
    ];
  }

  editor.options = shuffledOptions;
  renderQuestionOptionsEditor();
}

function resetInviteSuccessCard() {
  const successCard = document.getElementById("invite-user-success-card");
  if (!successCard) return;

  successCard.classList.add("hidden");

  [
    "invite-success-display-name",
    "invite-success-email",
    "invite-success-role",
    "invite-success-expiration",
  ].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = "";
    }
  });
}

function resetInviteUserForm() {
  const form = document.getElementById("invite-user-form");
  if (form) {
    form.reset();
  }

  setInviteUserNotice("", "success");
  resetInviteSuccessCard();
}

function collectInstitutionFormPayload() {
  const name = document.getElementById("institution-name")?.value.trim() || "";
  const city = document.getElementById("institution-city")?.value.trim() || "";
  const stateProvince = document.getElementById("institution-state")?.value.trim() || "";
  const institutionType = document.getElementById("institution-type")?.value.trim() || "";
  const contactEmail = document.getElementById("institution-contact-email")?.value.trim() || "";
  const website = document.getElementById("institution-website")?.value.trim() || "";
  const isActive = Boolean(document.getElementById("institution-active")?.checked);

  return {
    name,
    city,
    stateProvince,
    institutionType,
    contactEmail,
    website,
    isActive,
  };
}

function collectEditInstitutionPayload() {
  const objectId = document.getElementById("edit-institution-object-id")?.value || "";
  const name = document.getElementById("edit-institution-name")?.value.trim() || "";
  const city = document.getElementById("edit-institution-city")?.value.trim() || "";
  const stateProvince = document.getElementById("edit-institution-state")?.value.trim() || "";
  const institutionType = document.getElementById("edit-institution-type")?.value.trim() || "";
  const contactEmail = document.getElementById("edit-institution-contact-email")?.value.trim() || "";
  const website = document.getElementById("edit-institution-website")?.value.trim() || "";
  const isActive = Boolean(document.getElementById("edit-institution-active")?.checked);

  return {
    objectId,
    name,
    city,
    stateProvince,
    institutionType,
    contactEmail,
    website,
    isActive,
  };
}

function collectInviteUserPayload() {
  return {
    displayName: document.getElementById("invite-display-name")?.value.trim() || "",
    email: document.getElementById("invite-email")?.value.trim() || "",
    credentials: document.getElementById("invite-credentials")?.value.trim() || "",
    institutionId: document.getElementById("invite-institution")?.value.trim() || "",
    primarySpecialtyId:
      document.getElementById("invite-primary-specialty")?.value.trim() || "",
    roleName: document.getElementById("invite-role-name")?.value.trim() || "",
    invitationMessage: document.getElementById("invite-message")?.value.trim() || "",
    notes: document.getElementById("invite-notes")?.value.trim() || "",
  };
}

function setInviteUserSubmitting(isSubmitting) {
  const submitButton = document.getElementById("invite-user-submit");
  const resetButton = document.getElementById("invite-user-reset");
  const loadingMessage = document.getElementById("invite-user-loading");
  const form = document.getElementById("invite-user-form");

  if (submitButton) {
    submitButton.disabled = isSubmitting;
  }

  if (resetButton) {
    resetButton.disabled = isSubmitting;
  }

  if (loadingMessage) {
    loadingMessage.classList.toggle("hidden", !isSubmitting);
  }

  if (form) {
    form.setAttribute("aria-busy", String(isSubmitting));
  }
}

function validateInviteUserPayload(payload) {
  if (!payload.displayName) return "Display Name is required.";
  if (!payload.email) return "Email Address is required.";
  if (!payload.credentials) return "Credentials is required.";
  if (!payload.institutionId) return "Institution is required.";
  if (!payload.primarySpecialtyId) return "Primary Specialty is required.";
  if (!payload.roleName) return "Role is required.";
  return "";
}

function formatInvitationExpiration(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function renderInviteSuccess(result) {
  const successCard = document.getElementById("invite-user-success-card");
  if (!successCard) return;

  document.getElementById("invite-success-display-name").textContent =
    result.displayName || "";
  document.getElementById("invite-success-email").textContent = result.email || "";
  document.getElementById("invite-success-role").textContent =
    result.roleDisplayName || result.roleName || "";
  document.getElementById("invite-success-expiration").textContent = formatInvitationExpiration(
    result.tokenExpiresAt
  );

  successCard.classList.remove("hidden");
}

function renderInviteInstitutionOptions(institutions) {
  const select = document.getElementById("invite-institution");
  if (!select) return;

  if (!Array.isArray(institutions) || institutions.length === 0) {
    select.innerHTML = '<option value="">No active institutions available</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = [
    '<option value=""></option>',
    ...institutions.map((institution) => {
      const label = escapeHtml(institution.name || "Unnamed Institution");
      const objectId = escapeHtml(institution.objectId || "");
      return `<option value="${objectId}">${label}</option>`;
    }),
  ].join("");
}

function renderInviteSpecialtyOptions(specialties) {
  const select = document.getElementById("invite-primary-specialty");
  if (!select) return;

  if (!Array.isArray(specialties) || specialties.length === 0) {
    select.innerHTML = '<option value="">No active specialties available</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = [
    '<option value=""></option>',
    ...specialties.map((specialty) => {
      const primaryLabel = specialty.name || "Unnamed Specialty";
      return `<option value="${escapeHtml(specialty.objectId || "")}">${escapeHtml(primaryLabel)}</option>`;
    }),
  ].join("");
}

function getSortedInstitutions(institutions) {
  const direction = pageState.institutionSortDirection === "desc" ? -1 : 1;

  return [...institutions].sort((left, right) => {
    const leftName = (left.name || "").toLocaleLowerCase();
    const rightName = (right.name || "").toLocaleLowerCase();

    if (leftName < rightName) return -1 * direction;
    if (leftName > rightName) return 1 * direction;
    return 0;
  });
}

function getSortedUsers(users) {
  const direction = pageState.userSortDirection === "desc" ? -1 : 1;

  return [...users].sort((left, right) => {
    const leftLastName = getUserLastName(left?.displayName);
    const rightLastName = getUserLastName(right?.displayName);

    if (leftLastName < rightLastName) return -1 * direction;
    if (leftLastName > rightLastName) return 1 * direction;

    const leftDisplayName = String(left?.displayName || "").trim().toLowerCase();
    const rightDisplayName = String(right?.displayName || "").trim().toLowerCase();

    if (leftDisplayName < rightDisplayName) return -1 * direction;
    if (leftDisplayName > rightDisplayName) return 1 * direction;
    return 0;
  });
}

function updateInstitutionSortIcon() {
  const icon = document.getElementById("institution-name-sort-icon");
  if (!icon) return;

  icon.textContent = pageState.institutionSortDirection === "desc" ? "↓" : "↑";
}

function updateUserSortIcon() {
  const icon = document.getElementById("user-display-name-sort-icon");
  if (!icon) return;

  icon.textContent = pageState.userSortDirection === "desc" ? "↓" : "↑";
}

function openEditInstitutionOverlay(institution) {
  const overlay = document.getElementById("edit-institution-overlay");
  if (!overlay || !institution) return;

  document.getElementById("edit-institution-object-id").value = institution.objectId || "";
  document.getElementById("edit-institution-name").value = institution.name || "";
  document.getElementById("edit-institution-city").value = institution.city || "";
  document.getElementById("edit-institution-state").value = institution.stateProvince || "";
  document.getElementById("edit-institution-type").value = institution.institutionType || "";
  document.getElementById("edit-institution-contact-email").value = institution.contactEmail || "";
  document.getElementById("edit-institution-website").value = institution.website || "";
  document.getElementById("edit-institution-active").checked = Boolean(institution.isActive);
  setEditInstitutionNotice("", "success");

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function closeEditInstitutionOverlay() {
  const overlay = document.getElementById("edit-institution-overlay");
  const form = document.getElementById("edit-institution-form");
  if (!overlay) return;

  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  if (form) {
    form.reset();
  }
  setEditInstitutionNotice("", "success");
}

function renderInstitutionRows(institutions) {
  const list = document.getElementById("institutions-list");
  if (!list) return;

  if (!Array.isArray(institutions) || institutions.length === 0) {
    pageState.institutionsById = new Map();
    pageState.institutionsData = [];
    updateInstitutionSortIcon();
    list.innerHTML = '<div class="institution-message">No institutions found.</div>';
    return;
  }

  const sortedInstitutions = getSortedInstitutions(institutions);
  pageState.institutionsData = [...institutions];

  pageState.institutionsById = new Map(
    sortedInstitutions.map((institution) => [institution.objectId, institution])
  );
  updateInstitutionSortIcon();

  list.innerHTML = sortedInstitutions
    .map((institution) => {
      const name = escapeHtml(institution.name || "Unnamed Institution");
      const city = escapeHtml(institution.city || "No city listed");
      const state = escapeHtml(institution.stateProvince || "No state listed");
      const contactEmail = escapeHtml(institution.contactEmail || "No email listed");
      const isActive = Boolean(institution.isActive);
      const statusLabel = isActive ? "Active" : "Inactive";
      const statusClass = isActive ? "active" : "inactive";
      const objectId = escapeHtml(institution.objectId || "");

      return `
        <div class="institution-row">
          <span class="institution-name">${name}</span>
          <span class="institution-city">${city}</span>
          <span class="institution-state">${state}</span>
          <span class="institution-email">${contactEmail}</span>
          <span class="institution-status ${statusClass}">${statusLabel}</span>
          <span class="institution-actions-cell">
            <button
              type="button"
              class="institution-edit-button"
              data-institution-id="${objectId}"
              aria-label="Edit ${name}"
              title="Edit institution"
            >
              ✎
            </button>
          </span>
        </div>
      `;
    })
    .join("");
}

function renderUserRows(users) {
  const list = document.getElementById("users-list");
  if (!list) return;

  if (!Array.isArray(users) || users.length === 0) {
    pageState.usersById = new Map();
    pageState.usersData = [];
    updateUserSortIcon();
    list.innerHTML = '<div class="user-list-message">No users found.</div>';
    return;
  }

  const sortedUsers = getSortedUsers(users);
  pageState.usersData = [...users];
  pageState.usersById = new Map(sortedUsers.map((user) => [user.objectId, user]));
  updateUserSortIcon();

  list.innerHTML = sortedUsers
    .map((user) => {
      const objectId = escapeHtml(user.objectId || "");
      const displayName = escapeHtml(formatUserDisplayName(user));
      const institutionName = escapeHtml(user.institutionName || "No institution listed");
      const specialtyName = escapeHtml(user.specialtyName || "No specialty listed");
      const ariaName = escapeHtml(user.displayName || "user");

      return `
        <div class="user-row">
          <span class="user-display-name">${displayName}</span>
          <span class="user-institution">${institutionName}</span>
          <span class="user-specialty">${specialtyName}</span>
          <span class="user-actions-cell">
            <button
              type="button"
              class="user-edit-button"
              data-user-id="${objectId}"
              aria-label="Edit ${ariaName}"
              title="Edit user"
            >
              ✎
            </button>
          </span>
        </div>
      `;
    })
    .join("");
}

function compareQuestionOrder(leftQuestion, rightQuestion) {
  const leftOrder = getQuestionOrderValue(leftQuestion);
  const rightOrder = getQuestionOrderValue(rightQuestion);

  if (leftOrder.rank !== rightOrder.rank) {
    return leftOrder.rank - rightOrder.rank;
  }

  return compareQuestionText(leftOrder.label, rightOrder.label);
}

function compareQuestionDefault(leftQuestion, rightQuestion) {
  const specialtyComparison = compareQuestionText(leftQuestion.specialty, rightQuestion.specialty);
  if (specialtyComparison !== 0) return specialtyComparison;

  const sectionComparison = compareQuestionText(leftQuestion.section, rightQuestion.section);
  if (sectionComparison !== 0) return sectionComparison;

  const questionNumberComparison = compareQuestionOrder(leftQuestion, rightQuestion);
  if (questionNumberComparison !== 0) return questionNumberComparison;

  return new Date(rightQuestion.updatedAt || 0) - new Date(leftQuestion.updatedAt || 0);
}

function sortQuestionsForDisplay(questions, sortKey) {
  const list = [...questions];

  list.sort((leftQuestion, rightQuestion) => {
    if (sortKey === "updatedAt") {
      const updatedComparison =
        new Date(rightQuestion.updatedAt || 0) - new Date(leftQuestion.updatedAt || 0);
      return updatedComparison || compareQuestionDefault(leftQuestion, rightQuestion);
    }

    if (sortKey === "lastReviewedAt") {
      const reviewedComparison =
        new Date(rightQuestion.lastReviewedAt || 0) -
        new Date(leftQuestion.lastReviewedAt || 0);
      return reviewedComparison || compareQuestionDefault(leftQuestion, rightQuestion);
    }

    if (sortKey === "editorStatus") {
      const statusComparison = compareQuestionText(
        leftQuestion.editorStatus,
        rightQuestion.editorStatus
      );
      return statusComparison || compareQuestionDefault(leftQuestion, rightQuestion);
    }

    if (sortKey === "difficulty") {
      const difficultyComparison = compareQuestionText(
        leftQuestion.difficulty,
        rightQuestion.difficulty
      );
      return difficultyComparison || compareQuestionDefault(leftQuestion, rightQuestion);
    }

    if (sortKey === "questionNumber") {
      return compareQuestionOrder(leftQuestion, rightQuestion) || compareQuestionDefault(leftQuestion, rightQuestion);
    }

    return compareQuestionDefault(leftQuestion, rightQuestion);
  });

  return list;
}

function getQuestionFilterValues() {
  return {
    searchTerm: document.getElementById("question-search")?.value.trim().toLowerCase() || "",
    specialty: document.getElementById("question-specialty-filter")?.value || "",
    section: document.getElementById("question-section-filter")?.value || "",
    editorStatus: document.getElementById("question-status-filter")?.value || "",
    difficulty: document.getElementById("question-difficulty-filter")?.value || "",
    sortKey: document.getElementById("question-sort")?.value || "default",
  };
}

function getFilteredQuestions() {
  const { searchTerm, specialty, section, editorStatus, difficulty } = getQuestionFilterValues();

  return pageState.questionsData.filter((question) => {
    if (specialty && question.specialty !== specialty) return false;
    if (section && question.section !== section) return false;
    if (editorStatus && question.editorStatus !== editorStatus) return false;
    if (difficulty && question.difficulty !== difficulty) return false;

    if (!searchTerm) return true;

    const haystack = [
      question.questionText,
      question.section,
      question.specialty,
      question.correctAnswer,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchTerm);
  });
}

function updateQuestionListFooter(totalMatchingCount, displayedCount) {
  const count = document.getElementById("questions-count");
  const loadMoreButton = document.getElementById("questions-load-more");
  if (count) {
    count.textContent =
      totalMatchingCount === 0
        ? "No questions to display."
        : `Showing ${displayedCount} of ${totalMatchingCount} matching questions.`;
  }

  if (loadMoreButton) {
    loadMoreButton.classList.toggle("hidden", displayedCount >= totalMatchingCount);
  }
}

function navigateToQuestionEditor(questionId) {
  if (!questionId) return;
  window.location.href = buildQuestionEditUrl(questionId);
}

function renderQuestionRows() {
  const list = document.getElementById("questions-list");
  if (!list) return;

  const { sortKey } = getQuestionFilterValues();
  const filteredQuestions = getFilteredQuestions();

  if (filteredQuestions.length === 0) {
    list.innerHTML = '<div class="question-list-message">No questions match the current filters.</div>';
    updateQuestionListFooter(0, 0);
    return;
  }

  const sortedQuestions = sortQuestionsForDisplay(filteredQuestions, sortKey);
  const displayedQuestions = sortedQuestions.slice(0, pageState.questionVisibleCount);

  list.innerHTML = displayedQuestions
    .map((question) => {
      const createdAt = escapeHtml(formatQuestionListDate(question.createdAt));
      const specialty = escapeHtml(question.specialty || "—");
      const section = escapeHtml(question.section || "—");
      const stemPreview = escapeHtml(question.stemPreview || "No stem available.");
      const difficulty = escapeHtml(question.difficulty || "Unspecified");
      const editorStatus = escapeHtml(question.editorStatus || "Unspecified");
      const lastReviewedAt = escapeHtml(formatQuestionListDate(question.lastReviewedAt));
      const updatedAt = escapeHtml(formatQuestionListDate(question.updatedAt));
      const objectId = escapeHtml(question.objectId || "");
      const difficultyClass = getQuestionStatusClassName(question.difficulty, "question-difficulty");
      const statusClass = getQuestionStatusClassName(question.editorStatus, "question-status");

      return `
        <div class="question-row" data-question-id="${objectId}" tabindex="0" role="link" aria-label="Open question created ${createdAt}">
          <span class="question-date">${createdAt}</span>
          <span class="question-specialty">${specialty}</span>
          <span class="question-section">${section}</span>
          <span
            class="question-stem-preview"
            data-question-id="${objectId}"
            role="button"
            tabindex="0"
            aria-label="Preview full question stem"
            title="Preview full stem"
          >${stemPreview}</span>
          <span class="question-difficulty-badge ${difficultyClass}">${difficulty}</span>
          <span class="question-status-badge ${statusClass}">${editorStatus}</span>
          <span class="question-date">${lastReviewedAt}</span>
          <span class="question-date">${updatedAt}</span>
          <span class="question-actions-cell">
            <button
              type="button"
              class="question-edit-button"
              data-question-id="${objectId}"
              aria-label="Edit question created ${createdAt}"
              title="Edit question"
            >
              ✎
            </button>
          </span>
        </div>
      `;
    })
    .join("");

  updateQuestionListFooter(filteredQuestions.length, displayedQuestions.length);
}

function openQuestionStemOverlay(stemText) {
  const overlay = document.getElementById("question-stem-overlay");
  const body = document.getElementById("question-stem-body");
  if (!overlay || !body) return;

  body.textContent = String(stemText || "").trim() || "No stem available.";
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function closeQuestionStemOverlay() {
  const overlay = document.getElementById("question-stem-overlay");
  const body = document.getElementById("question-stem-body");
  if (!overlay || !body) return;

  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  body.textContent = "";
}

async function fetchQuestions() {
  const list = document.getElementById("questions-list");
  if (!list) return;

  list.innerHTML = '<div class="question-list-message">Loading questions...</div>';

  try {
    const questions = await window.back4app.runCloudFunction("listQuestions");
    pageState.questionsData = (Array.isArray(questions) ? questions : []).map((question) =>
      normalizeQuestionRecord(question)
    );
    pageState.questionsLoaded = true;
    syncQuestionFilterOptions(pageState.questionsData);
    renderQuestionRows();
  } catch (error) {
    console.error("Unable to load questions.", error);
    list.innerHTML =
      '<div class="question-list-message error">Unable to load questions right now.</div>';
    updateQuestionListFooter(0, 0);
  }
}

async function fetchInstitutions() {
  const list = document.getElementById("institutions-list");
  if (!list) return;

  list.innerHTML = '<div class="institution-message">Loading institutions...</div>';

  try {
    const institutions = await window.back4app.runCloudFunction("listInstitutions");
    renderInstitutionRows(institutions);
    pageState.activeInstitutions = (Array.isArray(institutions) ? institutions : []).filter(
      (institution) => institution?.isActive !== false
    );
    pageState.institutionsLoaded = true;
  } catch (error) {
    console.error("Unable to load institutions.", error);
    list.innerHTML = '<div class="institution-message error">Unable to load institutions right now.</div>';
  }
}

async function fetchUsers() {
  const list = document.getElementById("users-list");
  if (!list) return;

  list.innerHTML = '<div class="user-list-message">Loading users...</div>';

  try {
    const users = await window.back4app.runCloudFunction("listUsers");
    renderUserRows(users);
    pageState.usersLoaded = true;
  } catch (error) {
    console.error("Unable to load users.", error);
    list.innerHTML = '<div class="user-list-message error">Unable to load users right now.</div>';
  }
}

async function ensureInviteReferenceData() {
  if (!pageState.institutionsLoaded) {
    const institutions = await window.back4app.runCloudFunction("listInstitutions");
    pageState.activeInstitutions = (Array.isArray(institutions) ? institutions : []).filter(
      (institution) => institution?.isActive !== false
    );
    pageState.institutionsLoaded = true;
  }

  if (!pageState.specialtiesLoaded) {
    const specialties = await window.back4app.runCloudFunction("listSpecialties");
    pageState.activeSpecialties = (Array.isArray(specialties) ? specialties : []).filter(
      (specialty) => specialty?.isActive !== false
    );
    pageState.specialtiesLoaded = true;
  }
}

async function refreshInstitutionsList() {
  pageState.institutionsLoaded = false;
  if (document.getElementById("institutions-list")) {
    await fetchInstitutions();
  }
}

function bindAddInstitutionPage() {
  const cancelButton = document.getElementById("cancel-add-institution");
  const form = document.getElementById("add-institution-form");

  setInstitutionsFeedback("", "success");

  if (cancelButton) {
    cancelButton.addEventListener("click", (event) => {
      event.preventDefault();
      clearInstitutionForm();
    });
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setInstitutionFormNotice("", "success");
      setInstitutionsFeedback("", "success");

      const payload = collectInstitutionFormPayload();

      if (!payload.name) {
        setInstitutionFormNotice("Institution name is required.", "error");
        return;
      }

      try {
        await window.back4app.runCloudFunction("addInstitution", payload);
        setInstitutionsFeedback(`${payload.name} added successfully.`, "success");
        pageState.institutionsLoaded = false;
        resetInstitutionForm();
      } catch (error) {
        const message = error?.message || "Unable to add institution right now.";
        setInstitutionFormNotice(message, "error");
        setInstitutionsFeedback(message, "error");
      }
    });
  }
}

function bindInstitutionsListPage() {
  const sortButton = document.getElementById("institution-name-sort");
  const list = document.getElementById("institutions-list");
  const editOverlay = document.getElementById("edit-institution-overlay");
  const closeEditButton = document.getElementById("close-edit-institution");
  const cancelEditButton = document.getElementById("cancel-edit-institution");
  const editForm = document.getElementById("edit-institution-form");

  setInstitutionsFeedback("", "success");

  if (sortButton) {
    sortButton.addEventListener("click", () => {
      pageState.institutionSortDirection =
        pageState.institutionSortDirection === "asc" ? "desc" : "asc";
      renderInstitutionRows(pageState.institutionsData);
    });
  }

  if (list) {
    list.addEventListener("click", (event) => {
      const editButton = event.target.closest(".institution-edit-button");
      if (!editButton) return;

      const institutionId = editButton.dataset.institutionId;
      const institution = pageState.institutionsById.get(institutionId);
      if (institution) {
        openEditInstitutionOverlay(institution);
      }
    });
  }

  [closeEditButton, cancelEditButton].forEach((button) => {
    if (!button) return;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeEditInstitutionOverlay();
    });
  });

  if (editOverlay) {
    editOverlay.addEventListener("click", (event) => {
      if (event.target === editOverlay) {
        closeEditInstitutionOverlay();
      }
    });
  }

  if (editForm) {
    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setEditInstitutionNotice("", "success");

      const payload = collectEditInstitutionPayload();
      if (!payload.objectId || !payload.name) {
        setEditInstitutionNotice("Institution name is required.", "error");
        return;
      }

      try {
        await window.back4app.runCloudFunction("editInstitution", payload);
        setInstitutionsFeedback(`Updated ${payload.name}.`, "success");
        await refreshInstitutionsList();
        closeEditInstitutionOverlay();
      } catch (error) {
        const message = error?.message || "Unable to update institution right now.";
        setEditInstitutionNotice(message, "error");
        setInstitutionsFeedback(message, "error");
      }
    });
  }

  fetchInstitutions();
}

function bindUsersListPage() {
  const sortButton = document.getElementById("user-display-name-sort");
  const list = document.getElementById("users-list");

  setUsersFeedback("", "success");

  if (sortButton) {
    sortButton.addEventListener("click", () => {
      pageState.userSortDirection = pageState.userSortDirection === "asc" ? "desc" : "asc";
      renderUserRows(pageState.usersData);
    });
  }

  if (list) {
    list.addEventListener("click", (event) => {
      const editButton = event.target.closest(".user-edit-button");
      if (!editButton) return;

      const userId = editButton.dataset.userId;
      const user = pageState.usersById.get(userId);
      const displayName = user?.displayName || "this user";
      setUsersFeedback(`Edit user for ${displayName} is coming soon.`, "success");
    });
  }

  fetchUsers();
}

function bindQuestionsListPage() {
  const searchInput = document.getElementById("question-search");
  const specialtyFilter = document.getElementById("question-specialty-filter");
  const sectionFilter = document.getElementById("question-section-filter");
  const statusFilter = document.getElementById("question-status-filter");
  const difficultyFilter = document.getElementById("question-difficulty-filter");
  const sortSelect = document.getElementById("question-sort");
  const list = document.getElementById("questions-list");
  const loadMoreButton = document.getElementById("questions-load-more");
  const stemOverlay = document.getElementById("question-stem-overlay");
  const stemOverlayClose = document.getElementById("question-stem-close");

  setQuestionsFeedback("", "success");
  pageState.questionVisibleCount = 100;

  [searchInput, specialtyFilter, sectionFilter, statusFilter, difficultyFilter, sortSelect].forEach(
    (element) => {
      if (!element) return;

      element.addEventListener("input", () => {
        pageState.questionVisibleCount = 100;
        renderQuestionRows();
      });

      element.addEventListener("change", () => {
        pageState.questionVisibleCount = 100;
        renderQuestionRows();
      });
    }
  );

  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", () => {
      pageState.questionVisibleCount += 100;
      renderQuestionRows();
    });
  }

  if (list) {
    list.addEventListener("click", (event) => {
      const stemPreviewButton = event.target.closest(".question-stem-preview");
      if (stemPreviewButton) {
        event.preventDefault();
        event.stopPropagation();
        const selectedQuestion = pageState.questionsData.find(
          (question) => question.objectId === stemPreviewButton.dataset.questionId
        );
        openQuestionStemOverlay(selectedQuestion?.questionText || selectedQuestion?.stemPreview || "");
        return;
      }

      const editButton = event.target.closest(".question-edit-button");
      if (editButton) {
        event.preventDefault();
        navigateToQuestionEditor(editButton.dataset.questionId);
        return;
      }

      const questionRow = event.target.closest(".question-row");
      if (questionRow) {
        navigateToQuestionEditor(questionRow.dataset.questionId);
      }
    });

    list.addEventListener("keydown", (event) => {
      const stemPreviewButton = event.target.closest(".question-stem-preview");
      if (stemPreviewButton && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        const selectedQuestion = pageState.questionsData.find(
          (question) => question.objectId === stemPreviewButton.dataset.questionId
        );
        openQuestionStemOverlay(selectedQuestion?.questionText || selectedQuestion?.stemPreview || "");
        return;
      }

      const questionRow = event.target.closest(".question-row");
      if (!questionRow) return;
      if (stemPreviewButton) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        navigateToQuestionEditor(questionRow.dataset.questionId);
      }
    });
  }

  if (stemOverlayClose) {
    stemOverlayClose.addEventListener("click", () => {
      closeQuestionStemOverlay();
    });
  }

  if (stemOverlay) {
    stemOverlay.addEventListener("click", (event) => {
      if (event.target === stemOverlay) {
        closeQuestionStemOverlay();
      }
    });
  }

  fetchQuestions();
}

function bindQuestionsAddPage() {
  const questionTypeSelect = document.getElementById("add-question-type");
  const stemTextarea = document.getElementById("add-question-stem");
  const critiqueTextarea = document.getElementById("add-question-critique");
  const addOptionButton = document.getElementById("add-question-option");
  const addReferenceButton = document.getElementById("add-question-reference");
  const saveQuestionButton = document.getElementById("save-question-button");
  const shuffleButton = document.getElementById("shuffle-question-options");
  const optionsList = document.getElementById("question-options-list");
  const referencesList = document.getElementById("question-references-list");
  const specialtySelect = document.getElementById("add-question-specialty");
  const addTopicInput = document.getElementById("add-question-topic-name");
  const addTopicButton = document.getElementById("add-question-topic-button");
  const statusSelect = document.getElementById("add-question-status");
  const importQuestionButton = document.getElementById("import-question-button");
  const generateOverlay = document.getElementById("question-generate-overlay");
  const generateForm = document.getElementById("question-generate-form");
  const generateCancelButton = document.getElementById("question-generate-cancel-button");
  const generateCloseButton = document.getElementById("question-generate-cancel");
  const generateSourceTextarea = document.getElementById("question-generate-source");

  setQuestionsFeedback("", "success");
  initializeQuestionEditorState();
  initializeQuestionMediaSelections();
  bindAutoResizingTextarea(stemTextarea);
  bindAutoResizingTextarea(critiqueTextarea);
  bindAutoResizingTextarea(generateSourceTextarea);
  renderQuestionOptionsEditor();
  renderQuestionReferencesEditor();
  renderQuestionMediaSelections();
  renderQuestionAddTopicOptions([], { placeholder: "Select a specialty first" });
  setQuestionTopicCreatorState({ visible: false, enabled: false });
  populateQuestionAuthorField();

  if (questionTypeSelect) {
    questionTypeSelect.value = QUESTION_TYPE_MULTIPLE_CHOICE;
    questionTypeSelect.addEventListener("change", (event) => {
      const nextType = event.target.value;
      if (
        pageState.questionEditor &&
        pageState.questionEditor.questionType !== nextType &&
        questionEditorHasOptionContent() &&
        !window.confirm("Changing question type will reset the current answer options. Continue?")
      ) {
        event.target.value = pageState.questionEditor.questionType;
        return;
      }

      setQuestionEditorType(nextType);
    });
  }

  if (addOptionButton) {
    addOptionButton.addEventListener("click", () => {
      if (
        pageState.questionEditor.questionType !== QUESTION_TYPE_MULTIPLE_CHOICE ||
        pageState.questionEditor.options.length >= 5
      ) {
        return;
      }

      pageState.questionEditor.options.push(createQuestionOption());
      renderQuestionOptionsEditor();
    });
  }

  if (shuffleButton) {
    shuffleButton.addEventListener("click", shuffleQuestionOptions);
  }

  if (addReferenceButton) {
    addReferenceButton.addEventListener("click", () => {
      pageState.questionEditor.references.push(createQuestionReference());
      renderQuestionReferencesEditor();
    });
  }

  if (saveQuestionButton) {
    saveQuestionButton.addEventListener("click", () => {
      void saveQuestionArticle();
    });
  }

  if (importQuestionButton) {
    importQuestionButton.addEventListener("click", () => {
      openQuestionGenerateOverlay();
    });
  }

  if (generateCancelButton) {
    generateCancelButton.addEventListener("click", () => {
      closeQuestionGenerateOverlay();
    });
  }

  if (generateCloseButton) {
    generateCloseButton.addEventListener("click", () => {
      closeQuestionGenerateOverlay();
    });
  }

  if (generateOverlay) {
    generateOverlay.addEventListener("click", (event) => {
      if (event.target === generateOverlay) {
        closeQuestionGenerateOverlay();
      }
    });
  }

  if (generateForm) {
    generateForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await generateAiQuestionDraft();
    });
  }

  if (optionsList) {
    optionsList.addEventListener("change", (event) => {
      const correctInput = event.target.closest(".question-option-correct-input");
      if (!correctInput) return;

      pageState.questionEditor.options = pageState.questionEditor.options.map((option) => ({
        ...option,
        isCorrect: option.id === correctInput.dataset.optionId,
      }));
      renderQuestionOptionsEditor();
    });

    optionsList.addEventListener("input", (event) => {
      const textInput = event.target.closest(".question-option-text");
      if (!textInput) return;

      const option = pageState.questionEditor.options.find(
        (currentOption) => currentOption.id === textInput.dataset.optionId
      );
      if (!option) return;

      option.text = textInput.value;
      renderQuestionOptionValidation();
    });

    optionsList.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".question-option-remove");
      if (!removeButton) return;
      if (
        pageState.questionEditor.questionType !== QUESTION_TYPE_MULTIPLE_CHOICE ||
        pageState.questionEditor.options.length <= 3
      ) {
        return;
      }

      pageState.questionEditor.options = pageState.questionEditor.options.filter(
        (option) => option.id !== removeButton.dataset.optionId
      );
      renderQuestionOptionsEditor();
    });

    optionsList.addEventListener("dragstart", (event) => {
      const optionRow = event.target.closest(".question-option-row");
      if (!optionRow || pageState.questionEditor.questionType !== QUESTION_TYPE_MULTIPLE_CHOICE) {
        event.preventDefault();
        return;
      }

      pageState.questionEditor.dragOptionId = optionRow.dataset.optionId;
      optionRow.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", optionRow.dataset.optionId);
      }
    });

    optionsList.addEventListener("dragend", (event) => {
      const optionRow = event.target.closest(".question-option-row");
      if (optionRow) {
        optionRow.classList.remove("is-dragging");
      }
      pageState.questionEditor.dragOptionId = "";
      optionsList
        .querySelectorAll(".question-option-row.is-drop-target")
        .forEach((row) => row.classList.remove("is-drop-target"));
    });

    optionsList.addEventListener("dragover", (event) => {
      const optionRow = event.target.closest(".question-option-row");
      if (!optionRow || pageState.questionEditor.questionType !== QUESTION_TYPE_MULTIPLE_CHOICE) {
        return;
      }

      event.preventDefault();
      optionsList
        .querySelectorAll(".question-option-row.is-drop-target")
        .forEach((row) => row.classList.remove("is-drop-target"));
      optionRow.classList.add("is-drop-target");
    });

    optionsList.addEventListener("dragleave", (event) => {
      const optionRow = event.target.closest(".question-option-row");
      if (optionRow) {
        optionRow.classList.remove("is-drop-target");
      }
    });

    optionsList.addEventListener("drop", (event) => {
      const optionRow = event.target.closest(".question-option-row");
      if (!optionRow || pageState.questionEditor.questionType !== QUESTION_TYPE_MULTIPLE_CHOICE) {
        return;
      }

      event.preventDefault();
      optionRow.classList.remove("is-drop-target");
      moveQuestionOption(pageState.questionEditor.dragOptionId, optionRow.dataset.optionId);
      pageState.questionEditor.dragOptionId = "";
    });
  }

  if (referencesList) {
    referencesList.addEventListener("input", (event) => {
      const field = event.target.closest("[data-reference-id][data-field]");
      if (!field || !pageState.questionEditor) return;

      const reference = pageState.questionEditor.references.find(
        (currentReference) => currentReference.id === field.dataset.referenceId
      );
      if (!reference) return;

      reference[field.dataset.field] = field.value;
      if (field.dataset.field === "parseInput") {
        reference.parseError = "";
      }
    });

    referencesList.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".question-reference-remove");
      if (removeButton && pageState.questionEditor) {
        pageState.questionEditor.references = pageState.questionEditor.references.filter(
          (reference) => reference.id !== removeButton.dataset.referenceId
        );
        renderQuestionReferencesEditor();
        return;
      }

      const parseButton = event.target.closest("[data-reference-parse]");
      if (!parseButton) return;

      parseQuestionReference(parseButton.dataset.referenceParse);
    });
  }

  getQuestionMediaGroups().forEach((group) => {
    const input = document.getElementById(group.inputId);
    const list = document.getElementById(group.listId);
    const triggerButton = document.querySelector(`[data-file-input="${group.inputId}"]`);

    if (triggerButton && input) {
      triggerButton.addEventListener("click", () => {
        input.click();
      });
    }

    if (input) {
      input.addEventListener("change", (event) => {
        appendQuestionMediaSelections(group.inputId, event.target.files);
        event.target.value = "";
      });
    }

    if (list) {
      list.addEventListener("click", (event) => {
        const removeButton = event.target.closest(".question-media-chip-remove");
        if (!removeButton) return;

        removeQuestionMediaSelection(removeButton.dataset.inputId, removeButton.dataset.fileId);
      });
    }
  });

  if (specialtySelect) {
    specialtySelect.addEventListener("change", async (event) => {
      setQuestionsFeedback("", "success");
      if (addTopicInput) {
        addTopicInput.value = "";
      }

      try {
        await loadQuestionTopicsForSpecialty(event.target.value);
        setQuestionTopicCreatorState({
          visible: Boolean(event.target.value),
          enabled: Boolean(event.target.value),
        });
      } catch (error) {
        console.error("Unable to load topics for the selected specialty.", error);
        renderQuestionAddTopicOptions([], { placeholder: "Unable to load topics" });
        setQuestionTopicCreatorState({
          visible: Boolean(event.target.value),
          enabled: Boolean(event.target.value),
        });
        setQuestionsFeedback("Unable to load topics right now. Please try again.", "error");
      }
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener("change", (event) => {
      applyQuestionStatusAccent(event.target.value);
    });
  }

  if (addTopicButton) {
    addTopicButton.addEventListener("click", () => {
      addQuestionTopicForSelectedSpecialty();
    });
  }

  if (addTopicInput) {
    addTopicInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addQuestionTopicForSelectedSpecialty();
    });
  }

  window.back4app
    .runCloudFunction("listSpecialties")
    .then((specialties) => {
      const activeSpecialties = (Array.isArray(specialties) ? specialties : []).filter(
        (specialty) => specialty?.isActive !== false
      );
      pageState.activeSpecialties = activeSpecialties;
      renderQuestionAddSpecialtyOptions(activeSpecialties);
      renderQuestionAddTopicOptions([], { placeholder: "Select a specialty first" });
    })
    .catch((error) => {
      console.error("Unable to load specialties for question authoring.", error);
      renderQuestionAddSpecialtyOptions([]);
      renderQuestionAddTopicOptions([], { placeholder: "Unable to load topics" });
      setQuestionsFeedback("Unable to load specialties right now. Please try again.", "error");
    });

  window.back4app
    .runCloudFunction("listStatuses")
    .then((statuses) => {
      const activeStatuses = (Array.isArray(statuses) ? statuses : []).filter(
        (status) => status?.isActive !== false
      );
      pageState.activeStatuses = activeStatuses;
      renderQuestionAddStatusOptions(activeStatuses);
      applyQuestionStatusAccent(document.getElementById("add-question-status")?.value || "");
    })
    .catch((error) => {
      console.error("Unable to load statuses for question authoring.", error);
      renderQuestionAddStatusOptions([]);
      setQuestionsFeedback("Unable to load article statuses right now. Please try again.", "error");
    });
}

function bindInviteUserPage() {
  const form = document.getElementById("invite-user-form");
  const resetButton = document.getElementById("invite-user-reset");

  setInviteUserNotice("", "success");
  resetInviteSuccessCard();
  setInviteUserSubmitting(false);

  if (resetButton) {
    resetButton.addEventListener("click", (event) => {
      event.preventDefault();
      resetInviteUserForm();
    });
  }

  ensureInviteReferenceData()
    .then(() => {
      renderInviteInstitutionOptions(pageState.activeInstitutions);
      renderInviteSpecialtyOptions(pageState.activeSpecialties);
    })
    .catch((error) => {
      console.error("Unable to load invitation reference data.", error);
      renderInviteInstitutionOptions([]);
      renderInviteSpecialtyOptions([]);
      setInviteUserNotice(
        "Unable to load institutions and specialties right now. Please try again.",
        "error"
      );
    });

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setInviteUserNotice("", "success");
      resetInviteSuccessCard();

      const payload = collectInviteUserPayload();
      const validationMessage = validateInviteUserPayload(payload);

      if (validationMessage) {
        setInviteUserNotice(validationMessage, "error");
        return;
      }

      setInviteUserSubmitting(true);

      try {
        const result = await window.back4app.runCloudFunction("inviteUser", payload);
        setInviteUserNotice("Invitation created successfully.", "success");
        renderInviteSuccess(result || {});
        form.reset();
      } catch (error) {
        const message = error?.message || "Unable to send invitation right now.";
        setInviteUserNotice(message, "error");
      } finally {
        setInviteUserSubmitting(false);
      }
    });
  }
}

function initializeSection(section) {
  if (section === "dashboard" && typeof bindDashboardPage === "function") {
    void bindDashboardPage();
  }

  if (section === "content" && typeof bindContentPage === "function") {
    void bindContentPage();
  }

  if (section === "dev-tools") {
    bindDevToolsPage();
  }

  if (section === "questions-add") {
    bindQuestionsAddPage();
  }

  if (section === "questions-list") {
    bindQuestionsListPage();
  }

  if (section === "users-list") {
    bindUsersListPage();
  }

  if (section === "institutions-add") {
    bindAddInstitutionPage();
  }

  if (section === "institutions-list") {
    bindInstitutionsListPage();
  }

  if (section === "users-invite") {
    bindInviteUserPage();
  }
}

async function loadPageContent(section) {
  const normalizedSection = VALID_SECTIONS.has(section) ? section : DEFAULT_SECTION;
  const placeholder = getPlaceholder("main-placeholder");
  if (!placeholder) return;

  placeholder.setAttribute("aria-busy", "true");

  try {
    const markup = await fetchComponentMarkup(getPagePath(normalizedSection));
    placeholder.innerHTML = markup;
    initializeSection(normalizedSection);
  } catch (error) {
    console.error(error);
    renderMissingSection(normalizedSection);
  } finally {
    placeholder.setAttribute("aria-busy", "false");
  }
}

async function navigateToSection(section, { updateHash = true } = {}) {
  const normalizedSection = getAccessibleSection(section);

  setActiveNavLink(normalizedSection);
  await loadPageContent(normalizedSection);

  if (updateHash && window.location.hash !== `#${normalizedSection}`) {
    window.location.hash = normalizedSection;
  }
}

function bindNavLinks() {
  const navLinks = document.querySelectorAll(".nav-link, .sub-nav-link");
  const navItemsWithSubmenus = document.querySelectorAll(".nav-item-has-submenu");
  const navPanel = document.getElementById("app-nav-panel");
  const navOverlay = document.getElementById("nav-overlay");
  const navToggleButton = document.getElementById("nav-toggle-button");
  const navCloseButton = document.getElementById("nav-close-button");

  function isMobileNavViewport() {
    return window.innerWidth < 800;
  }

  function setNavDrawerOpen(isOpen) {
    document.body.classList.toggle("nav-panel-open", isOpen);
    document.body.classList.toggle("nav-drawer-open", isOpen && isMobileNavViewport());
    navPanel?.classList.toggle("is-visible", isOpen);
    navOverlay?.classList.toggle("hidden", !(isOpen && isMobileNavViewport()));
    navToggleButton?.classList.toggle("is-active", isOpen);

    if (navToggleButton) {
      navToggleButton.setAttribute("aria-expanded", String(isOpen));
      navToggleButton.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
    }
  }

  function closeAllDropdowns() {
    navItemsWithSubmenus.forEach((item) => item.classList.remove("is-open"));
  }

  function closeNavDrawer() {
    setNavDrawerOpen(false);
    closeAllDropdowns();
  }

  function toggleNavDrawer() {
    const isOpen = navPanel?.classList.contains("is-visible");
    setNavDrawerOpen(!isOpen);
  }

  navItemsWithSubmenus.forEach((item) => {
    item.addEventListener("mouseleave", () => {
      item.classList.remove("submenu-locked");
    });
  });

  navToggleButton?.addEventListener("click", () => {
    toggleNavDrawer();
  });

  navCloseButton?.addEventListener("click", () => {
    closeNavDrawer();
  });

  navOverlay?.addEventListener("click", () => {
    closeNavDrawer();
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();

      const section = link.dataset.section;
      if (!section) return;
      if (!canAccessSection(section)) return;

      const parentNavItem = link.closest(".nav-item-has-submenu");

      if (parentNavItem && link.classList.contains("nav-link")) {
        if (!parentNavItem.classList.contains("is-open")) {
          closeAllDropdowns();
          parentNavItem.classList.add("is-open");
          return;
        }
      }

      await navigateToSection(section);
      if (link.classList.contains("sub-nav-link") && parentNavItem) {
        parentNavItem.classList.add("submenu-locked");
        link.blur();
      }
      if (isMobileNavViewport()) {
        closeNavDrawer();
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".nav-item-has-submenu")) {
      closeAllDropdowns();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNavDrawer();
    }
  });

  window.addEventListener("resize", () => {
    const shouldBeOpen = window.innerWidth >= 800;
    if (shouldBeOpen !== navPanel?.classList.contains("is-visible")) {
      setNavDrawerOpen(shouldBeOpen);
    }
  });

  setNavDrawerOpen(window.innerWidth >= 800);
}

async function loadPageComponents() {
  await Promise.all([
    loadComponent("header-placeholder", "components/header.html"),
    loadComponent("nav-placeholder", "components/nav.html"),
    loadComponent("footer-placeholder", "components/footer.html"),
  ]);

  renderHeaderAuth();
  bindHeaderActions();
  bindNavLinks();
  renderNavAccess();
  await navigateToSection(getSectionFromHash(), { updateHash: false });
}

window.addEventListener("hashchange", async () => {
  await navigateToSection(getSectionFromHash(), { updateHash: false });
});

window.addEventListener("DOMContentLoaded", async () => {
  if (window.back4app && typeof window.back4app.init === "function") {
    window.back4app.init();
  }

  await loadPageComponents();
});
