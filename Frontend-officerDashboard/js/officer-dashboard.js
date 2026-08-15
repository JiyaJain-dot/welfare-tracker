// Officer dashboard behavior for authenticated review and status updates.

const NETWORK_ERROR_MESSAGE = "Could not reach the server - check that the backend is running";
const SCHEME_PRIORITY = [
  "old age pension",
  "old-age pension",
  "differently-abled pension",
  "disability pension",
  "disabled pension",
  "widow pension",
  "scholarship",
  "scholarships",
  "ration card",
  "bank scheme",
  "bank schemes",
];

let officerToken = null;
let applications = [];
let currentApplication = null;
let sortMode = "priority";

const dashboardAlert = document.getElementById("dashboardAlert");
const dashboardLoading = document.getElementById("dashboardLoading");
const officerIdentity = document.getElementById("officerIdentity");
const logoutButton = document.getElementById("logoutButton");
const sortToggleButton = document.getElementById("sortToggleButton");
const daysSortHeader = document.getElementById("daysSortHeader");
const applicationsTableBody = document.getElementById("applicationsTableBody");
const applicationsTableWrap = document.getElementById("applicationsTableWrap");
const emptyState = document.getElementById("emptyState");
const schemeBreakdownList = document.getElementById("schemeBreakdownList");
const totalApplications = document.getElementById("totalApplications");
const pendingReview = document.getElementById("pendingReview");
const overdueApplications = document.getElementById("overdueApplications");
const approvedThisMonth = document.getElementById("approvedThisMonth");
const overdueCard = document.getElementById("overdueCard");
const manageDialog = document.getElementById("manageDialog");
const manageTitle = document.getElementById("manageTitle");
const applicationDetails = document.getElementById("applicationDetails");
const stageSelect = document.getElementById("stageSelect");
const documentName = document.getElementById("documentName");
const updateStageButton = document.getElementById("updateStageButton");
const flagDocumentButton = document.getElementById("flagDocumentButton");
const manageMessage = document.getElementById("manageMessage");

function checkAuth() {
  officerToken = sessionStorage.getItem("officerToken");

  if (!officerToken) {
    window.location.replace("index.html");
    return false;
  }

  renderOfficerIdentity();
  return true;
}

function renderOfficerIdentity() {
  const profile = readJsonFromSession("officerProfile");
  const label = profile?.name || profile?.username || profile?.officerId || profile?.id || "Officer";
  officerIdentity.textContent = label;
}

function readJsonFromSession(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

async function apiRequest(path, options = {}) {
  const { headers = {}, ...fetchOptions } = options;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${officerToken}`,
        ...headers,
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      sessionStorage.clear();
      window.location.replace("index.html");
      throw new Error("Your session has expired. Please log in again.");
    }

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

async function loadStats() {
  const data = await apiRequest("/officer/stats");
  renderStats(data || {});
}

async function loadApplications() {
  const data = await apiRequest("/officer/applications");
  applications = normalizeApplications(data);
  renderSchemeBreakdown(applications);
  renderApplicationsTable();
}

function normalizeApplications(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.applications || data?.items || data?.queue || data?.rows || [];
}

function renderStats(stats) {
  const total = pickNumber(stats, ["totalApplications", "total", "totalCount", "count"]) ?? applications.length;
  const pending = pickNumber(stats, ["pendingReview", "pending", "totalPending", "pendingCount"]) ?? countByStatus(["submitted", "verification", "review"]);
  const overdue = pickNumber(stats, ["overdue", "overdueApplications", "overdueCount"]) ?? countOverdue();
  const approvedMonth = pickNumber(stats, ["approvedThisMonth", "approved_month", "monthlyApproved", "approvedCount"]) ?? countApprovedThisMonth();

  totalApplications.textContent = total;
  pendingReview.textContent = pending;
  overdueApplications.textContent = overdue;
  approvedThisMonth.textContent = approvedMonth;
  overdueCard.classList.toggle("has-alert", Number(overdue) > 0);

  const schemeCounts = stats.byScheme || stats.perScheme || stats.schemes || stats.schemeCounts;
  if (schemeCounts) {
    renderSchemeBreakdownFromStats(schemeCounts);
  }
}

function pickNumber(source, keys) {
  for (const key of keys) {
    if (Number.isFinite(Number(source?.[key]))) {
      return Number(source[key]);
    }
  }

  return null;
}

function renderSchemeBreakdownFromStats(schemeCounts) {
  const entries = Array.isArray(schemeCounts)
    ? schemeCounts.map((item) => [getSchemeName(item), Number(item.count ?? item.total ?? 0)])
    : Object.entries(schemeCounts);

  renderSchemeEntries(entries);
}

function renderSchemeBreakdown(items) {
  const counts = new Map();

  items.forEach((application) => {
    const scheme = getSchemeName(application);
    counts.set(scheme, (counts.get(scheme) || 0) + 1);
  });

  renderSchemeEntries([...counts.entries()]);
}

function renderSchemeEntries(entries) {
  const normalizedEntries = entries
    .map(([scheme, count]) => [formatValue(scheme || "Unknown Scheme"), Number(count) || 0])
    .sort(([a], [b]) => getSchemePriority(a) - getSchemePriority(b));

  schemeBreakdownList.innerHTML = "";

  if (!normalizedEntries.length) {
    schemeBreakdownList.innerHTML = '<div class="empty-state">No scheme data yet.</div>';
    return;
  }

  normalizedEntries.forEach(([scheme, count]) => {
    const item = document.createElement("div");
    item.className = "scheme-count";
    item.innerHTML = `<strong>${count}</strong><span>${escapeHtml(scheme)}</span>`;
    schemeBreakdownList.appendChild(item);
  });
}

function renderApplicationsTable() {
  const sortedApplications = [...applications].sort((a, b) => {
    if (sortMode === "days") {
      return getDaysWaiting(b) - getDaysWaiting(a);
    }

    return getSchemePriority(getSchemeName(a)) - getSchemePriority(getSchemeName(b))
      || getDaysWaiting(b) - getDaysWaiting(a);
  });

  sortToggleButton.textContent = sortMode === "priority" ? "Sort by Days Waiting" : "Sort by Priority";
  applicationsTableBody.innerHTML = "";
  applicationsTableWrap.hidden = sortedApplications.length === 0;
  emptyState.hidden = sortedApplications.length !== 0;

  sortedApplications.forEach((application) => {
    const row = document.createElement("tr");
    const id = getApplicationId(application);
    const trackingId = application.trackingId || application.tracking_id || "Not assigned";
    const name = application.name || application.applicantName || application.applicant_name || "Unnamed applicant";
    const scheme = getSchemeName(application);
    const status = getStatus(application);

    row.innerHTML = `
      <td>${escapeHtml(trackingId)}</td>
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(formatValue(scheme))}</td>
      <td>${getDaysWaiting(application)}</td>
      <td><span class="status-badge ${getStatusClass(status)}">${escapeHtml(formatValue(status))}</span></td>
      <td><button class="manage-button" type="button" data-application-id="${escapeHtml(id)}">Manage</button></td>
    `;

    applicationsTableBody.appendChild(row);
  });
}

function getApplicationId(application) {
  return application.id ?? application.applicationId ?? application.application_id ?? application.trackingId ?? application.tracking_id;
}

function getSchemeName(application) {
  return application.scheme || application.schemeName || application.scheme_name || application.schemeTitle || application.scheme_title || "Unknown Scheme";
}

function getStatus(application) {
  return application.stage || application.status || application.currentStage || application.current_stage || "pending";
}

function getDaysWaiting(application) {
  const directValue = application.daysWaiting ?? application.days_waiting ?? application.waitingDays ?? application.ageDays;

  if (Number.isFinite(Number(directValue))) {
    return Number(directValue);
  }

  const createdAt = application.createdAt || application.created_at || application.submittedAt || application.submitted_at;
  const createdTime = createdAt ? new Date(createdAt).getTime() : NaN;

  if (!Number.isFinite(createdTime)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - createdTime) / 86400000));
}

function getSchemePriority(scheme) {
  const normalized = String(scheme || "").toLowerCase();
  const index = SCHEME_PRIORITY.findIndex((item) => normalized.includes(item));
  return index === -1 ? SCHEME_PRIORITY.length : index;
}

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("reject") || normalized.includes("overdue")) {
    return "status-rejected";
  }

  if (normalized.includes("approve")) {
    return "status-approved";
  }

  if (normalized.includes("verif")) {
    return "status-verified";
  }

  if (normalized.includes("review")) {
    return "status-review";
  }

  return "status-pending";
}

function handleManageClick(event) {
  const button = event.target.closest(".manage-button");

  if (!button) {
    return;
  }

  currentApplication = applications.find((application) => String(getApplicationId(application)) === button.dataset.applicationId);

  if (!currentApplication) {
    showDashboardError("Could not find that application in the current list.");
    return;
  }

  openManageDialog(currentApplication);
}

function openManageDialog(application) {
  const trackingId = application.trackingId || application.tracking_id || "Application";
  manageTitle.textContent = `Application ${trackingId}`;
  stageSelect.value = normalizeStageValue(getStatus(application));
  documentName.value = "";
  clearManageMessage();

  const details = [
    ["Tracking ID", trackingId],
    ["Applicant", application.name || application.applicantName || application.applicant_name || "Unnamed applicant"],
    ["Scheme", formatValue(getSchemeName(application))],
    ["Days Waiting", getDaysWaiting(application)],
    ["Status", formatValue(getStatus(application))],
    ["Phone", application.phone || application.mobile || "Not provided"],
    ["Address", application.address || "Not provided"],
    ["Application ID", getApplicationId(application)],
  ];

  applicationDetails.innerHTML = details.map(([label, value]) => `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");

  if (typeof manageDialog.showModal === "function") {
    manageDialog.showModal();
  } else {
    manageDialog.setAttribute("open", "");
  }
}

function normalizeStageValue(status) {
  const normalized = String(status || "").toLowerCase().replace(/\s+/g, "_");
  const stageMap = {
    pending: "submitted",
    submitted: "submitted",
    under_review: "review",
    review: "review",
    verified: "verification",
    verification: "verification",
    approved: "approved",
    rejected: "rejected",
  };

  return stageMap[normalized] || "review";
}

async function handleStatusUpdate() {
  if (!currentApplication) {
    return;
  }

  const applicationId = getApplicationId(currentApplication);
  const nextStage = stageSelect.value;
  setButtonLoading(updateStageButton, true, "Updating...");
  clearManageMessage();

  try {
    await apiRequest(`/officer/applications/${encodeURIComponent(applicationId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ stage: nextStage }),
    });

    showManageMessage("Application status updated.");
    await refreshDashboard();
  } catch (error) {
    showManageMessage(error.message, true);
  } finally {
    setButtonLoading(updateStageButton, false);
  }
}

async function handleDocumentFlag() {
  if (!currentApplication) {
    return;
  }

  const applicationId = getApplicationId(currentApplication);
  const name = documentName.value.trim();

  if (!name) {
    showManageMessage("Enter the missing document name first.", true);
    return;
  }

  setButtonLoading(flagDocumentButton, true, "Flagging...");
  clearManageMessage();

  try {
    await apiRequest(`/officer/applications/${encodeURIComponent(applicationId)}/documents`, {
      method: "POST",
      body: JSON.stringify({ documentName: name, status: "missing" }),
    });

    showManageMessage("Missing document flagged.");
    documentName.value = "";
  } catch (error) {
    showManageMessage(error.message, true);
  } finally {
    setButtonLoading(flagDocumentButton, false);
  }
}

function handleLogout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

async function refreshDashboard() {
  await Promise.all([loadApplications(), loadStats()]);
}

async function initializeDashboard() {
  if (!checkAuth()) {
    return;
  }

  dashboardLoading.hidden = false;
  clearDashboardError();

  try {
    await refreshDashboard();
  } catch (error) {
    showDashboardError(error.message);
  } finally {
    dashboardLoading.hidden = true;
  }
}

function countByStatus(statuses) {
  return applications.filter((application) => statuses.includes(normalizeStageValue(getStatus(application)))).length;
}

function countOverdue() {
  return applications.filter((application) => getDaysWaiting(application) > 30 || String(getStatus(application)).toLowerCase().includes("overdue")).length;
}

function countApprovedThisMonth() {
  const now = new Date();

  return applications.filter((application) => {
    const status = String(getStatus(application)).toLowerCase();
    const updatedAt = application.updatedAt || application.updated_at || application.approvedAt || application.approved_at;
    const updatedDate = updatedAt ? new Date(updatedAt) : null;

    return status.includes("approved")
      && updatedDate
      && updatedDate.getMonth() === now.getMonth()
      && updatedDate.getFullYear() === now.getFullYear();
  }).length;
}

function setButtonLoading(button, isLoading, label = "Loading...") {
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = label;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

function showDashboardError(message) {
  dashboardAlert.textContent = message;
  dashboardAlert.hidden = false;
}

function clearDashboardError() {
  dashboardAlert.textContent = "";
  dashboardAlert.hidden = true;
}

function showManageMessage(message, isError = false) {
  manageMessage.textContent = message;
  manageMessage.classList.toggle("is-error", isError);
  manageMessage.hidden = false;
}

function clearManageMessage() {
  manageMessage.textContent = "";
  manageMessage.classList.remove("is-error");
  manageMessage.hidden = true;
}

function formatValue(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

logoutButton.addEventListener("click", handleLogout);
sortToggleButton.addEventListener("click", () => {
  sortMode = sortMode === "priority" ? "days" : "priority";
  renderApplicationsTable();
});
daysSortHeader.addEventListener("click", () => {
  sortMode = "days";
  renderApplicationsTable();
});
applicationsTableBody.addEventListener("click", handleManageClick);
updateStageButton.addEventListener("click", handleStatusUpdate);
flagDocumentButton.addEventListener("click", handleDocumentFlag);

initializeDashboard();
