const DEFAULT_SECTION = "dashboard";
const VALID_SECTIONS = new Set([
  "dashboard",
  "users",
  "institutions",
  "questions",
  "content",
  "reports",
  "settings",
]);

const authState = {
  loggedIn: false,
  userName: "Admin User",
};

const pageState = {
  institutionsLoaded: false,
  institutionsById: new Map(),
};

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

  actionButton.innerHTML = authState.loggedIn
    ? `${authState.userName}<span class="caret">▾</span>`
    : `Login<span class="caret">▾</span>`;
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

        if (typeof Parse !== "undefined" && result.sessionToken) {
          await Parse.User.become(result.sessionToken);
        }

        setLoginNotice(`Login successful. Welcome, ${authState.userName}.`, "success");
        renderHeaderAuth();
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
      renderHeaderAuth();
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

function setActiveNavLink(section) {
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
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
    list.innerHTML = '<div class="institution-message">No institutions found.</div>';
    return;
  }

  pageState.institutionsById = new Map(
    institutions.map((institution) => [institution.objectId, institution])
  );

  list.innerHTML = institutions
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

async function fetchInstitutions() {
  const list = document.getElementById("institutions-list");
  if (!list) return;

  list.innerHTML = '<div class="institution-message">Loading institutions...</div>';

  try {
    const institutions = await window.back4app.runCloudFunction("listInstitutions");
    renderInstitutionRows(institutions);
    pageState.institutionsLoaded = true;
  } catch (error) {
    console.error("Unable to load institutions.", error);
    list.innerHTML = '<div class="institution-message error">Unable to load institutions right now.</div>';
  }
}

async function toggleInstitutionsPanel(forceOpen = false) {
  const shouldOpen = toggleExpandableSection("institutions-toggle", "institutions-content", forceOpen);
  if (!shouldOpen) return;

  if (shouldOpen && !pageState.institutionsLoaded) {
    await fetchInstitutions();
  }
}

function toggleExpandableSection(toggleId, contentId, forceOpen = false) {
  const toggle = document.getElementById(toggleId);
  const content = document.getElementById(contentId);
  if (!toggle || !content) return false;

  const shouldOpen = forceOpen || toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(shouldOpen));
  content.classList.toggle("is-open", shouldOpen);
  return shouldOpen;
}

function closeExpandableSection(toggleId, contentId) {
  const toggle = document.getElementById(toggleId);
  const content = document.getElementById(contentId);
  if (!toggle || !content) return;

  toggle.setAttribute("aria-expanded", "false");
  content.classList.remove("is-open");
}

function collapseInstitutionPanels(except = "") {
  const sections = [
    { toggleId: "open-add-institution", contentId: "add-institution-content", key: "add" },
    { toggleId: "institutions-toggle", contentId: "institutions-content", key: "list" },
  ];

  sections.forEach((section) => {
    if (section.key !== except) {
      closeExpandableSection(section.toggleId, section.contentId);
    }
  });
}

function toggleAddInstitutionCard(forceOpen = false) {
  if (forceOpen) {
    collapseInstitutionPanels("add");
  }

  const isOpen = toggleExpandableSection("open-add-institution", "add-institution-content", forceOpen);
  if (isOpen) {
    collapseInstitutionPanels("add");
  }
  return isOpen;
}

async function refreshInstitutionsList() {
  pageState.institutionsLoaded = false;
  await toggleInstitutionsPanel(true);
}

function bindInstitutionsSection() {
  const addButton = document.getElementById("open-add-institution");
  const toggle = document.getElementById("institutions-toggle");
  const cancelButton = document.getElementById("cancel-add-institution");
  const form = document.getElementById("add-institution-form");
  if (!toggle) return;

  pageState.institutionsLoaded = false;
  setInstitutionsFeedback("", "success");

  toggle.addEventListener("click", async () => {
    collapseInstitutionPanels("list");
    await toggleInstitutionsPanel();
  });

  if (addButton) {
    addButton.addEventListener("click", () => {
      const isOpen = toggleAddInstitutionCard();
      if (isOpen) {
        setInstitutionFormNotice("", "success");
      }
    });
  }

  const list = document.getElementById("institutions-list");
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

      const payload = collectInstitutionFormPayload();

      if (!payload.name) {
        setInstitutionFormNotice("Institution name is required.", "error");
        return;
      }

      try {
        await window.back4app.runCloudFunction("addInstitution", payload);
        setInstitutionFormNotice("Institution added successfully.", "success");
        setInstitutionsFeedback(`Added ${payload.name}.`, "success");
        await refreshInstitutionsList();
        resetInstitutionForm();
        toggleAddInstitutionCard(true);
      } catch (error) {
        const message = error?.message || "Unable to add institution right now.";
        setInstitutionFormNotice(message, "error");
        setInstitutionsFeedback(message, "error");
      }
    });
  }

  const editOverlay = document.getElementById("edit-institution-overlay");
  const closeEditButton = document.getElementById("close-edit-institution");
  const cancelEditButton = document.getElementById("cancel-edit-institution");
  const editForm = document.getElementById("edit-institution-form");

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
}

function initializeSection(section) {
  if (section === "institutions") {
    bindInstitutionsSection();
  }
}

async function loadPageContent(section) {
  const normalizedSection = VALID_SECTIONS.has(section) ? section : DEFAULT_SECTION;
  const placeholder = getPlaceholder("main-placeholder");
  if (!placeholder) return;

  placeholder.setAttribute("aria-busy", "true");

  try {
    const markup = await fetchComponentMarkup(`components/pages/${normalizedSection}.html`);
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
  const normalizedSection = VALID_SECTIONS.has(section) ? section : DEFAULT_SECTION;

  setActiveNavLink(normalizedSection);
  await loadPageContent(normalizedSection);

  if (updateHash && window.location.hash !== `#${normalizedSection}`) {
    window.location.hash = normalizedSection;
  }
}

function bindNavLinks() {
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();

      const section = link.dataset.section;
      if (!section) return;

      await navigateToSection(section);
    });
  });
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
