function getInvitationToken() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("token") || "").trim();
}

function setAcceptInvitationNotice(message, type) {
  const notice = document.getElementById("accept-invitation-notice");
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

function setAcceptInvitationSubmitting(isSubmitting) {
  const submitButton = document.getElementById("accept-invitation-submit");
  const loadingMessage = document.getElementById("accept-invitation-loading");
  const form = document.getElementById("accept-invitation-form");

  if (submitButton) {
    submitButton.disabled = isSubmitting;
  }

  if (loadingMessage) {
    loadingMessage.classList.toggle("hidden", !isSubmitting);
  }

  if (form) {
    form.setAttribute("aria-busy", String(isSubmitting));
  }
}

function collectAcceptInvitationPayload() {
  return {
    username: document.getElementById("accept-username")?.value.trim() || "",
    password: document.getElementById("accept-password")?.value || "",
    confirmPassword: document.getElementById("accept-confirm-password")?.value || "",
  };
}

function validateAcceptInvitationPayload(payload) {
  if (!payload.username) return "Username is required.";
  if (!payload.password) return "Password is required.";
  if (payload.password.length < 8) return "Password must be at least 8 characters long.";
  if (payload.password !== payload.confirmPassword) return "Confirm Password must match Password.";
  return "";
}

function bindAcceptInvitationPage() {
  const form = document.getElementById("accept-invitation-form");
  const token = getInvitationToken();

  setAcceptInvitationNotice("", "success");
  setAcceptInvitationSubmitting(false);

  if (!token) {
    setAcceptInvitationNotice("This invitation link is missing its token.", "error");
    if (form) {
      form.querySelectorAll("input, button").forEach((element) => {
        element.disabled = true;
      });
    }
    return;
  }

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAcceptInvitationNotice("", "success");
    let acceptedSuccessfully = false;

    const payload = collectAcceptInvitationPayload();
    const validationMessage = validateAcceptInvitationPayload(payload);

    if (validationMessage) {
      setAcceptInvitationNotice(validationMessage, "error");
      return;
    }

    setAcceptInvitationSubmitting(true);

    try {
      const result = await window.back4app.runCloudFunction("acceptInvitation", {
        token,
        username: payload.username,
        password: payload.password,
      });

      setAcceptInvitationNotice(
        `Account created successfully for ${result.displayName || payload.username}.`,
        "success"
      );
      acceptedSuccessfully = true;
      form.reset();
      form.querySelectorAll("input, button").forEach((element) => {
        element.disabled = true;
      });
    } catch (error) {
      const message = error?.message || "Unable to accept this invitation right now.";
      setAcceptInvitationNotice(message, "error");
    } finally {
      if (!acceptedSuccessfully) {
        setAcceptInvitationSubmitting(false);
      } else {
        const loadingMessage = document.getElementById("accept-invitation-loading");
        if (loadingMessage) {
          loadingMessage.classList.add("hidden");
        }
      }
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  if (window.back4app && typeof window.back4app.init === "function") {
    window.back4app.init();
  }

  bindAcceptInvitationPage();
});
