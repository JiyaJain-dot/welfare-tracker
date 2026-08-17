// Login and role-selection behavior for the shared entry page.

const NETWORK_ERROR_MESSAGE = "Could not reach the server - check that the backend is running";

const formPanel = document.getElementById("formPanel");
const officerForm = document.getElementById("officerLoginForm");
const clientForm = document.getElementById("clientTrackForm");
const officerError = document.getElementById("officerError");
const clientError = document.getElementById("clientError");
const roleButtons = document.querySelectorAll(".role-button");

async function apiRequest(path, options = {}) {
  const { headers = {}, ...fetchOptions } = options;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error?.message || "Request failed. Please try again.";
      throw new Error(message);
    }

    return payload.data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }

    throw error;
  }
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function clearError(element) {
  element.textContent = "";
  element.hidden = true;
}

function setSubmitting(form, isSubmitting) {
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = isSubmitting;
}

function handleRoleSelect(event) {
  const selectedRole = event.currentTarget.dataset.role;

  formPanel.closest(".landing-section").classList.add("compact");
  formPanel.hidden = false;
  officerForm.hidden = selectedRole !== "officer";
  clientForm.hidden = selectedRole !== "client";

  roleButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.role === selectedRole));
  });

  clearError(officerError);
  clearError(clientError);
}

async function handleOfficerLogin(event) {
  event.preventDefault();
  clearError(officerError);
  setSubmitting(officerForm, true);

  const formData = new FormData(officerForm);
  const username = formData.get("officerId").trim();
  const password = formData.get("password");

  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (!data?.token) {
      throw new Error("Login succeeded, but no auth token was returned.");
    }

    sessionStorage.setItem("officerToken", data.token);
    sessionStorage.setItem("officerProfile", JSON.stringify({ ...data, token: undefined }));
    window.location.href = "officer-dashboard.html";
  } catch (error) {
    showError(officerError, error.message);
  } finally {
    setSubmitting(officerForm, false);
  }
}

async function handleClientTrack(event) {
  event.preventDefault();
  clearError(clientError);
  setSubmitting(clientForm, true);

  const formData = new FormData(clientForm);
  const trackingId = formData.get("trackingId").trim();

  try {
    await apiRequest(`/applications/track/${encodeURIComponent(trackingId)}`);

    // TODO: Build the actual client-status.html page that reads this query param.
    window.location.href = `client-status.html?id=${encodeURIComponent(trackingId)}`;
  } catch (error) {
    showError(clientError, error.message);
  } finally {
    setSubmitting(clientForm, false);
  }
}

roleButtons.forEach((button) => {
  button.addEventListener("click", handleRoleSelect);
});

officerForm.addEventListener("submit", handleOfficerLogin);
clientForm.addEventListener("submit", handleClientTrack);
