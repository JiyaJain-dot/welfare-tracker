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
const DASHBOARD_ICONS = {
  oldAge: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5v1l3.6 1.2A3.5 3.5 0 0 1 20 16v2h-2v-2a1.5 1.5 0 0 0-1-1.4L13 13.3V21h-2v-7.7l-4 1.3A1.5 1.5 0 0 0 6 16v2H4v-2a3.5 3.5 0 0 1 2.4-3.3L10 11.5v-1A4 4 0 0 1 12 3Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>',
  accessibility: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-6 7 5-1.5a3.7 3.7 0 0 1 2 0L18 10l-.6 1.9-4.4-1.3V14h2.3l2.4 5-1.8.9-1.9-3.9h-4l-1.9 3.9-1.8-.9 2.4-5H11v-3.4l-4.4 1.3L6 10Z"/></svg>',
  family: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm7.5 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM9 12c3.3 0 6 1.8 6 4v2H3v-2c0-2.2 2.7-4 6-4Zm7.5.5c2.5 0 4.5 1.4 4.5 3.2V18h-4v-2c0-1-.5-2-1.4-2.8.3-.4.6-.7.9-.7Z"/></svg>',
  graduation: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 10 5-10 5L2 8l10-5Zm-6 8.1 6 3 6-3V16c0 1.7-2.7 3-6 3s-6-1.3-6-3v-4.9Zm14-.1h2v6h-2v-6Z"/></svg>',
  ration: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 4h16V7H4v2Zm2 4v2h6v-2H6Zm9 0v2h3v-2h-3Z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 4a1.5 1.5 0 0 0-.5 2.9V18h1v-1.1A1.5 1.5 0 0 0 12 14Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 4a6.5 6.5 0 0 1 5.1 10.5l4 4-1.4 1.4-4-4A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 16.6 4.9 12l1.4-1.4 3.2 3.2 8.2-8.2 1.4 1.4-9.6 9.6Z"/></svg>',
  warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3Zm1 13h-2v2h2v-2Zm0-7h-2v5h2V9Z"/></svg>',
};
const SCHEME_CARDS = [
  { label: "Old Age Pension", icon: "oldAge", matches: ["old age pension", "old-age pension"] },
  { label: "Disability Pension", icon: "accessibility", matches: ["differently-abled pension", "disability pension", "disabled pension"] },
  { label: "Widow Pension", icon: "family", matches: ["widow pension"] },
  { label: "Scholarship", icon: "graduation", matches: ["scholarship", "scholarships"] },
  { label: "Ration Card Benefit", icon: "ration", matches: ["ration card", "ration"] },
];
const SCHEME_GROUPS = [
  {
    id: "welfare",
    label: "Welfare Tracker",
    icon: "oldAge",
    sourceClass: "source-welfare",
    schemes: SCHEME_CARDS.slice(0, 4),
  },
  {
    id: "ration",
    label: "Ration Card System",
    icon: "ration",
    sourceClass: "source-ration",
    schemes: SCHEME_CARDS.slice(4),
  },
];

let officerToken = null;
let applications = [];
let currentApplication = null;
let sortMode = "priority";
let latestSchemeEntries = [];
const expandedSchemeGroups = {
  welfare: false,
  ration: false,
};
const pendingConsentRequests = new Set();
let activePanelTab = "details";
let activityHistoryLoaded = false;
let activityHistoryCache = null;
let lastFocusedManageButton = null;

const dashboardAlert = document.getElementById("dashboardAlert");
const dashboardLoading = document.getElementById("dashboardLoading");
const pageBreadcrumb = document.getElementById("pageBreadcrumb");
const dashboardTitle = document.getElementById("dashboardTitle");
const pageDescription = document.getElementById("pageDescription");
const dashboardView = document.getElementById("dashboardView");
const applicationsView = document.getElementById("applicationsView");
const dashboardNavLink = document.getElementById("dashboardNavLink");
const applicationsNavLink = document.getElementById("applicationsNavLink");
const officerIdentity = document.getElementById("officerIdentity");
const sidebarOfficerName = document.getElementById("sidebarOfficerName");
const sidebarAvatar = document.getElementById("sidebarAvatar");
const headerAvatar = document.getElementById("headerAvatar");
const ssoOfficerName = document.getElementById("ssoOfficerName");
const ssoAvatar = document.getElementById("ssoAvatar");
const ssoSessionReference = document.getElementById("ssoSessionReference");
const welfareVerifiedAt = document.getElementById("welfareVerifiedAt");
const rationVerifiedAt = document.getElementById("rationVerifiedAt");
const logoutButton = document.getElementById("logoutButton");
const sortToggleButton = document.getElementById("sortToggleButton");
const daysSortHeader = document.getElementById("daysSortHeader");
const refreshButton = document.getElementById("refreshButton");
const applicationSearch = document.getElementById("applicationSearch");
const statusFilter = document.getElementById("statusFilter");
const schemeFilter = document.getElementById("schemeFilter");
const sourceFilter = document.getElementById("sourceFilter");
const customSelectDropdowns = document.querySelectorAll("[data-select-dropdown]");
const sortDropdown = document.querySelector("[data-sort-dropdown]");
const applicationsTableBody = document.getElementById("applicationsTableBody");
const applicationsTableWrap = document.getElementById("applicationsTableWrap");
const emptyState = document.getElementById("emptyState");
const schemeBreakdownList = document.getElementById("schemeBreakdownList");
const totalApplications = document.getElementById("totalApplications");
const pendingReview = document.getElementById("pendingReview");
const overdueApplications = document.getElementById("overdueApplications");
const approvedThisMonth = document.getElementById("approvedThisMonth");
const overdueCard = document.getElementById("overdueCard");
const activityPanel = document.getElementById("activityPanel");
const manageTitle = document.getElementById("manageTitle");
const panelTrackingId = document.getElementById("panelTrackingId");
const panelSourceBadge = document.getElementById("panelSourceBadge");
const panelStatusBadge = document.getElementById("panelStatusBadge");
const closePanelButton = document.getElementById("closePanelButton");
const detailsTabButton = document.getElementById("detailsTabButton");
const activityTabButton = document.getElementById("activityTabButton");
const detailsTabPanel = document.getElementById("detailsTabPanel");
const activityTabPanel = document.getElementById("activityTabPanel");
const activityLogLoading = document.getElementById("activityLogLoading");
const activityLogError = document.getElementById("activityLogError");
const activityLogEmpty = document.getElementById("activityLogEmpty");
const activityRetryButton = document.getElementById("activityRetryButton");
const activityTimeline = document.getElementById("activityTimeline");
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
  const initials = getInitials(label);

  officerIdentity.textContent = label;
  sidebarOfficerName.textContent = label;
  sidebarAvatar.textContent = initials;
  headerAvatar.textContent = initials;
  ssoOfficerName.textContent = label;
  ssoAvatar.textContent = initials;
  ssoSessionReference.textContent = `Session ref: ${getSessionReference(officerToken)}`;
  welfareVerifiedAt.textContent = `Last verified: ${formatSessionVerifiedTime()}`;
  rationVerifiedAt.textContent = `Last verified: ${formatSessionVerifiedTime()}`;
}

function readJsonFromSession(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

function getCurrentView() {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "applications" ? "applications" : "dashboard";
}

function renderCurrentView() {
  const isApplicationsView = getCurrentView() === "applications";

  dashboardView.hidden = isApplicationsView;
  applicationsView.hidden = !isApplicationsView;

  pageBreadcrumb.textContent = isApplicationsView ? "Officer Portal / Applications" : "Officer Portal / Dashboard";
  dashboardTitle.textContent = isApplicationsView ? "Applications" : "Review Dashboard";
  pageDescription.textContent = isApplicationsView
    ? "Search, filter, and manage priority applications across connected systems."
    : "Monitor scheme queues, consent status, and applications needing officer action.";

  dashboardNavLink.classList.toggle("is-active", !isApplicationsView);
  applicationsNavLink.classList.toggle("is-active", isApplicationsView);
  applicationsNavLink.classList.toggle("is-expanded", isApplicationsView);
  applicationsNavLink.setAttribute("aria-expanded", String(isApplicationsView));
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

    if (response.status === 401 || response.status === 403) {
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
  populateFilters();
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
  latestSchemeEntries = entries;
  const normalizedEntries = entries.map(([scheme, count]) => [String(scheme || ""), Number(count) || 0]);

  schemeBreakdownList.innerHTML = "";

  SCHEME_GROUPS.forEach((group) => {
    const schemeCounts = group.schemes.map((card) => ({
      ...card,
      count: getSchemeCount(normalizedEntries, card.matches),
    }));
    const totalCount = schemeCounts.reduce((total, card) => total + card.count, 0);
    const isExpanded = expandedSchemeGroups[group.id];
    const schemeLabel = group.schemes.length === 1 ? "1 scheme" : `${group.schemes.length} schemes`;
    const item = document.createElement("article");
    item.className = `scheme-group-card ${isExpanded ? "is-expanded" : ""}`;
    item.innerHTML = `
      <button class="scheme-group-toggle" type="button" data-scheme-group="${escapeHtml(group.id)}" aria-expanded="${isExpanded}">
        <span class="scheme-icon" aria-hidden="true">${getDashboardIcon(group.icon)}</span>
        <span class="scheme-group-copy">
          <strong>${escapeHtml(group.label)}</strong>
          <small>${totalCount} applications across ${schemeLabel}</small>
          <span class="source-badge ${group.sourceClass}">${escapeHtml(group.label)}</span>
        </span>
        <span class="scheme-group-action">
          <span>${isExpanded ? "Hide schemes" : "Show schemes"}</span>
          <span class="scheme-group-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 9 5 5 5-5 1.4 1.4L12 16.8l-6.4-6.4L7 9Z"/></svg></span>
        </span>
      </button>
      <div class="scheme-group-details">
        <div class="scheme-card-row scheme-card-row-nested">
          ${schemeCounts.map((card) => `
            <article class="scheme-card">
              <span class="scheme-icon" aria-hidden="true">${getDashboardIcon(card.icon)}</span>
              <span class="scheme-card-copy">
                <strong>${escapeHtml(card.label)}</strong>
                <small>${card.count} applications</small>
              </span>
            </article>
          `).join("")}
        </div>
      </div>
    `;
    schemeBreakdownList.appendChild(item);
  });
}

function getSchemeCount(entries, matches) {
  return entries.reduce((total, [scheme, value]) => {
    return total + (schemeMatches(scheme, matches) ? value : 0);
  }, 0);
}

function handleSchemeGroupToggle(event) {
  const toggle = event.target.closest("[data-scheme-group]");

  if (!toggle) {
    return;
  }

  const groupId = toggle.dataset.schemeGroup;
  expandedSchemeGroups[groupId] = !expandedSchemeGroups[groupId];
  renderSchemeEntries(latestSchemeEntries);
}

function renderApplicationsTable() {
  const visibleApplications = getFilteredApplications().sort((a, b) => {
    if (sortMode === "days") {
      return getDaysWaiting(b) - getDaysWaiting(a);
    }

    return getSchemePriority(getSchemeName(a)) - getSchemePriority(getSchemeName(b))
      || getDaysWaiting(b) - getDaysWaiting(a);
  });

  syncSortDropdown();
  applicationsTableBody.innerHTML = "";
  applicationsTableWrap.hidden = visibleApplications.length === 0;
  emptyState.hidden = visibleApplications.length !== 0;
  emptyState.textContent = applications.length === 0 ? "No applications yet." : "No applications match the selected filters.";

  visibleApplications.forEach((application) => {
    const row = document.createElement("tr");
    const id = getApplicationId(application);
    const trackingId = application.trackingId || application.tracking_id || "Not assigned";
    const name = getApplicantName(application);
    const scheme = getSchemeName(application);
    const status = getStatus(application);
    const source = getSourceSystem(application);
    const isMasked = hasPendingConsent(application);
    const actionMarkup = isMasked ? getConsentActionMarkup(application) : getManageActionMarkup(id);

    row.innerHTML = `
      <td>${escapeHtml(trackingId)}</td>
      <td>${isMasked ? `<span class="masked-applicant">${getDashboardIcon("lock")} Pending consent</span>` : escapeHtml(name)}</td>
      <td>${escapeHtml(formatValue(scheme))}</td>
      <td><span class="source-badge ${getSourceClass(source)}">${escapeHtml(source)}</span></td>
      <td>${getDaysWaiting(application)}</td>
      <td><span class="status-badge ${getStatusClass(status)}">${escapeHtml(formatValue(status))}</span></td>
      <td>${getConsentCell(application)}</td>
      <td>${actionMarkup}</td>
    `;

    applicationsTableBody.appendChild(row);
  });
}

function getManageActionMarkup(id) {
  return `<button class="manage-button" type="button" data-application-id="${escapeHtml(id)}">Manage</button>`;
}

function getConsentActionMarkup(application) {
  const id = getApplicationId(application);
  const isPending = pendingConsentRequests.has(String(id));
  const label = isPending ? "Requesting..." : "Request Consent";
  const disabledAttribute = isPending ? " disabled" : "";

  return `<button class="manage-button consent-request-button" type="button" data-consent-id="${escapeHtml(id)}"${disabledAttribute}>${label}</button>`;
}

function getFilteredApplications() {
  const searchTerm = applicationSearch.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;
  const selectedScheme = schemeFilter.value;
  const selectedSource = sourceFilter.value;

  return applications.filter((application) => {
    const searchHaystack = [
      getApplicantName(application),
      application.trackingId,
      application.tracking_id,
      getPhone(application),
    ].join(" ").toLowerCase();
    const matchesSearch = !searchTerm || searchHaystack.includes(searchTerm);
    const matchesStatus = !selectedStatus || getStatus(application) === selectedStatus;
    const matchesScheme = !selectedScheme || getSchemeName(application) === selectedScheme;
    const matchesSource = !selectedSource || getSourceSystem(application) === selectedSource;

    return matchesSearch && matchesStatus && matchesScheme && matchesSource;
  });
}

function populateFilters() {
  syncSelectOptions(statusFilter, getDistinctValues(applications.map(getStatus)), "All Status");
  syncSelectOptions(schemeFilter, getDistinctValues(applications.map(getSchemeName)).sort((a, b) => getSchemePriority(a) - getSchemePriority(b)), "All Schemes");
  syncSelectOptions(sourceFilter, getDistinctValues(applications.map(getSourceSystem)), "All Sources");
  syncAllCustomDropdowns();
}

function syncSelectOptions(select, values, defaultLabel) {
  const previousValue = select.value;
  select.innerHTML = `<option value="">${escapeHtml(defaultLabel)}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = formatValue(value);
    select.appendChild(option);
  });

  select.value = values.includes(previousValue) ? previousValue : "";
}

function syncAllCustomDropdowns() {
  customSelectDropdowns.forEach((dropdown) => {
    const select = document.getElementById(dropdown.dataset.selectDropdown);
    syncCustomDropdown(dropdown, select);
  });
}

function syncCustomDropdown(dropdown, select) {
  const trigger = dropdown.querySelector(".custom-dropdown-trigger");
  const menu = dropdown.querySelector(".custom-dropdown-menu");

  if (!select || !trigger || !menu) {
    return;
  }

  const selectedOption = select.options[select.selectedIndex] || select.options[0];
  trigger.textContent = selectedOption?.textContent || "Select";
  menu.innerHTML = "";

  Array.from(select.options).forEach((option) => {
    const button = document.createElement("button");
    button.className = "custom-dropdown-option";
    button.type = "button";
    button.role = "option";
    button.dataset.value = option.value;
    button.textContent = option.textContent;
    button.setAttribute("aria-selected", String(option.value === select.value));
    menu.appendChild(button);
  });
}

function handleCustomDropdownClick(event) {
  const trigger = event.target.closest(".custom-dropdown-trigger");
  const option = event.target.closest(".custom-dropdown-option");

  if (trigger) {
    const dropdown = trigger.closest(".custom-dropdown");
    toggleDropdown(dropdown);
    return;
  }

  if (!option) {
    return;
  }

  const dropdown = option.closest(".custom-dropdown");

  if (dropdown?.dataset.selectDropdown) {
    selectCustomOption(dropdown, option.dataset.value);
    return;
  }

  if (dropdown?.dataset.sortDropdown !== undefined) {
    selectSortOption(dropdown, option.dataset.sortMode);
  }
}

function handleCustomDropdownKeydown(event) {
  const dropdown = event.target.closest(".custom-dropdown");

  if (!dropdown) {
    return;
  }

  const options = Array.from(dropdown.querySelectorAll(".custom-dropdown-option"));
  const activeIndex = options.indexOf(document.activeElement);

  if (event.key === "Escape") {
    closeDropdown(dropdown);
    dropdown.querySelector(".custom-dropdown-trigger")?.focus();
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    const trigger = event.target.closest(".custom-dropdown-trigger");

    if (trigger) {
      event.preventDefault();
      toggleDropdown(dropdown);
    }
    return;
  }

  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    return;
  }

  event.preventDefault();

  if (!dropdown.classList.contains("is-open")) {
    openDropdown(dropdown);
    focusDropdownOption(options, event.key === "ArrowUp" ? options.length - 1 : 0);
    return;
  }

  const direction = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = activeIndex === -1
    ? 0
    : (activeIndex + direction + options.length) % options.length;

  focusDropdownOption(options, nextIndex);
}

function handleCustomDropdownOutsideClick(event) {
  if (event.target.closest(".custom-dropdown")) {
    return;
  }

  closeAllDropdowns();
}

function toggleDropdown(dropdown) {
  if (!dropdown) {
    return;
  }

  if (dropdown.classList.contains("is-open")) {
    closeDropdown(dropdown);
  } else {
    openDropdown(dropdown);
  }
}

function openDropdown(dropdown) {
  closeAllDropdowns(dropdown);
  dropdown.classList.add("is-open");
  dropdown.querySelector(".custom-dropdown-trigger")?.setAttribute("aria-expanded", "true");
}

function closeDropdown(dropdown) {
  dropdown.classList.remove("is-open");
  dropdown.querySelector(".custom-dropdown-trigger")?.setAttribute("aria-expanded", "false");
}

function closeAllDropdowns(exceptDropdown = null) {
  document.querySelectorAll(".custom-dropdown.is-open").forEach((dropdown) => {
    if (dropdown !== exceptDropdown) {
      closeDropdown(dropdown);
    }
  });
}

function focusDropdownOption(options, index) {
  options[index]?.focus();
}

function selectCustomOption(dropdown, value) {
  const select = document.getElementById(dropdown.dataset.selectDropdown);

  if (!select) {
    return;
  }

  select.value = value;
  syncCustomDropdown(dropdown, select);
  closeDropdown(dropdown);
  dropdown.querySelector(".custom-dropdown-trigger")?.focus();
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectSortOption(dropdown, nextSortMode) {
  if (!nextSortMode || sortMode === nextSortMode) {
    closeDropdown(dropdown);
    return;
  }

  sortMode = nextSortMode;
  syncSortDropdown();
  closeDropdown(dropdown);
  dropdown.querySelector(".custom-dropdown-trigger")?.focus();
  renderApplicationsTable();
}

function syncSortDropdown() {
  if (!sortDropdown || !sortToggleButton) {
    return;
  }

  sortToggleButton.textContent = sortMode === "priority" ? "Sort: Priority" : "Sort: Days Waiting";
  sortDropdown.querySelectorAll("[data-sort-mode]").forEach((option) => {
    option.setAttribute("aria-selected", String(option.dataset.sortMode === sortMode));
  });
}

function getDistinctValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getApplicationId(application) {
  return application.id ?? application.applicationId ?? application.application_id ?? application.trackingId ?? application.tracking_id;
}

function getApplicantName(application) {
  return application.name || application.applicantName || application.applicant_name || application.applicant?.name || "Unnamed applicant";
}

function getPhone(application) {
  return application.phone
    || application.phoneNumber
    || application.phone_number
    || application.mobile
    || application.mobileNumber
    || application.mobile_number
    || application.mobileNo
    || application.mobile_no
    || application.applicantPhone
    || application.applicant_phone
    || application.applicant?.phone
    || "";
}

function getSchemeName(application) {
  return application.scheme || application.schemeName || application.scheme_name || application.schemeTitle || application.scheme_title || "Unknown Scheme";
}

function getStatus(application) {
  return application.stage || application.status || application.currentStage || application.current_stage || "pending";
}

function getSourceSystem(application) {
  return application.source_system || application.sourceSystem || "Welfare Tracker";
}

function hasPendingConsent(application) {
  const consentGranted = application.consent_granted ?? application.consentGranted;
  return getSourceSystem(application) === "Ration Card System" && consentGranted === false;
}

function getConsentCell(application) {
  if (hasPendingConsent(application)) {
    return `<span class="consent-lock" aria-label="Pending consent">${getDashboardIcon("lock")}</span>`;
  }

  return '<span class="consent-empty" aria-hidden="true">-</span>';
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

function getPriority(application) {
  if (application.priority) {
    return String(application.priority).toUpperCase();
  }

  // TODO: Confirm priority values with the backend once the API exposes a canonical field.
  const daysWaiting = getDaysWaiting(application);

  if (daysWaiting > 12) {
    return "HIGH";
  }

  if (daysWaiting >= 6) {
    return "MEDIUM";
  }

  return "NORMAL";
}

function getSchemePriority(scheme) {
  const normalized = String(scheme || "").toLowerCase();
  const index = SCHEME_PRIORITY.findIndex((item) => normalized.includes(item));
  return index === -1 ? SCHEME_PRIORITY.length : index;
}

function schemeMatches(scheme, matches) {
  const normalized = String(scheme || "").toLowerCase();
  return matches.some((match) => normalized.includes(match));
}

function getDashboardIcon(name) {
  return DASHBOARD_ICONS[name] || "";
}

function getPriorityClass(priority) {
  const normalized = String(priority || "").toLowerCase();

  if (normalized.includes("high")) {
    return "priority-high";
  }

  if (normalized.includes("medium")) {
    return "priority-medium";
  }

  return "priority-normal";
}

function getSourceClass(source) {
  return getSourceSystem({ source_system: source }) === "Ration Card System" ? "source-ration" : "source-welfare";
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

  if (!button || button.classList.contains("consent-request-button")) {
    return;
  }

  lastFocusedManageButton = button;
  currentApplication = applications.find((application) => String(getApplicationId(application)) === button.dataset.applicationId);

  if (!currentApplication) {
    showDashboardError("Could not find that application in the current list.");
    return;
  }

  openActivityPanel(currentApplication);
}

async function handleConsentRequest(event) {
  const button = event.target.closest(".consent-request-button");

  if (!button) {
    return;
  }

  const applicationId = button.dataset.consentId;

  if (!applicationId || pendingConsentRequests.has(applicationId)) {
    return;
  }

  const application = applications.find((item) => String(getApplicationId(item)) === applicationId);
  const trackingId = application?.trackingId || application?.tracking_id || applicationId;

  pendingConsentRequests.add(applicationId);
  setButtonLoading(button, true, "Requesting...");
  clearDashboardError();

  try {
    await apiRequest(`/officer/applications/${encodeURIComponent(applicationId)}/consent`, {
      method: "POST",
    });
    pendingConsentRequests.delete(applicationId);
    await loadApplications();
    showDashboardSuccess(`Consent granted for ${trackingId}.`);
  } catch (error) {
    pendingConsentRequests.delete(applicationId);
    showDashboardError("Couldn't request consent. Try again.");
    renderApplicationsTable();
  }
}

function openActivityPanel(application) {
  const trackingId = application.trackingId || application.tracking_id || "Application";
  const status = getStatus(application);
  const source = getSourceSystem(application);

  manageTitle.textContent = getApplicantName(application);
  panelTrackingId.textContent = trackingId;
  panelSourceBadge.className = `source-badge ${getSourceClass(source)}`;
  panelSourceBadge.textContent = source;
  panelStatusBadge.className = `status-badge ${getStatusClass(status)}`;
  panelStatusBadge.textContent = formatValue(status);
  stageSelect.value = normalizeStageValue(getStatus(application));
  documentName.value = "";
  clearManageMessage();
  resetActivitySession();
  setActivePanelTab("details");

  const details = [
    ["Tracking ID", trackingId],
    ["Applicant", hasPendingConsent(application) ? "Pending consent" : getApplicantName(application)],
    ["Scheme", formatValue(getSchemeName(application))],
    ["Source", getSourceSystem(application)],
    ["Consent", hasPendingConsent(application) ? "Pending" : "Available"],
    ["Days Waiting", getDaysWaiting(application)],
    ["Status", formatValue(getStatus(application))],
    ["Phone", hasPendingConsent(application) ? "Pending consent" : (getPhone(application) || "Not provided")],
    ["Address", hasPendingConsent(application) ? "Pending consent" : (application.address || "Not provided")],
    ["Submitted", formatDateTime(application.submittedAt || application.submitted_at || application.createdAt || application.created_at)],
    ["Application ID", getApplicationId(application)],
  ];

  applicationDetails.innerHTML = details.map(([label, value]) => `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");

  activityPanel.classList.add("is-open");
  activityPanel.setAttribute("aria-hidden", "false");
  closePanelButton.focus();
}

function closeActivityPanel() {
  activityPanel.classList.remove("is-open");
  activityPanel.setAttribute("aria-hidden", "true");
  currentApplication = null;
  resetActivitySession();

  if (lastFocusedManageButton && document.contains(lastFocusedManageButton)) {
    lastFocusedManageButton.focus();
  }
}

function resetActivitySession() {
  activePanelTab = "details";
  activityHistoryLoaded = false;
  activityHistoryCache = null;
  setActivityLogState("idle");
}

function setActivePanelTab(tabName) {
  activePanelTab = tabName;
  const isActivity = tabName === "activity";

  detailsTabButton.classList.toggle("is-active", !isActivity);
  activityTabButton.classList.toggle("is-active", isActivity);
  detailsTabButton.setAttribute("aria-selected", String(!isActivity));
  activityTabButton.setAttribute("aria-selected", String(isActivity));
  detailsTabPanel.classList.toggle("is-active", !isActivity);
  activityTabPanel.classList.toggle("is-active", isActivity);
  detailsTabPanel.hidden = isActivity;
  activityTabPanel.hidden = !isActivity;

  if (isActivity) {
    loadActivityHistory();
  }
}

async function loadActivityHistory({ force = false } = {}) {
  if (!currentApplication) {
    return;
  }

  if (activityHistoryLoaded && !force) {
    renderActivityTimeline(activityHistoryCache);
    return;
  }

  const applicationId = getApplicationId(currentApplication);
  setActivityLogState("loading");

  try {
    const history = await apiRequest(`/officer/applications/${encodeURIComponent(applicationId)}/history`);
    if (!currentApplication || String(getApplicationId(currentApplication)) !== String(applicationId)) {
      return;
    }

    activityHistoryCache = normalizeActivityHistory(history);
    activityHistoryLoaded = true;
    renderActivityTimeline(activityHistoryCache);
  } catch (error) {
    if (!currentApplication || String(getApplicationId(currentApplication)) !== String(applicationId)) {
      return;
    }

    activityHistoryCache = null;
    activityHistoryLoaded = false;
    setActivityLogState("error");
  }
}

function normalizeActivityHistory(history) {
  const items = Array.isArray(history)
    ? history
    : history?.history || history?.items || history?.rows || [];

  return [...items].sort((a, b) => {
    const firstTime = new Date(a.changed_at || a.changedAt || 0).getTime();
    const secondTime = new Date(b.changed_at || b.changedAt || 0).getTime();

    return firstTime - secondTime;
  });
}

function renderActivityTimeline(history) {
  activityTimeline.innerHTML = "";

  if (!history.length) {
    setActivityLogState("empty");
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement("li");
    const stage = entry.stage || entry.status || "Stage updated";
    const changedBy = entry.changed_by || entry.changedBy || "System";
    const changedAt = formatDateTime(entry.changed_at || entry.changedAt);
    const note = entry.note;
    const stageClass = getTimelineStageClass(stage);

    item.className = `timeline-item ${stageClass}`;

    item.innerHTML = `
      <span class="timeline-marker" aria-hidden="true">${getTimelineStageIcon(stage)}</span>
      <div class="timeline-card">
        <strong><span class="timeline-stage-icon" aria-hidden="true">${getTimelineStageIcon(stage)}</span>${escapeHtml(formatValue(stage))}</strong>
        <span>${escapeHtml(changedBy)} · ${escapeHtml(changedAt)}</span>
        ${note ? `<p>${escapeHtml(note)}</p>` : ""}
      </div>
    `;
    activityTimeline.appendChild(item);
  });

  setActivityLogState("timeline");
}

function setActivityLogState(state) {
  const showLoading = state === "loading";
  const showError = state === "error";
  const showEmpty = state === "empty";
  const showTimeline = state === "timeline";

  activityLogLoading.hidden = !showLoading;
  activityLogError.hidden = !showError;
  activityLogEmpty.hidden = !showEmpty;
  activityTimeline.hidden = !showTimeline;

  if (!showTimeline) {
    activityTimeline.innerHTML = "";
  }
}

function handlePanelTabClick(event) {
  const button = event.target.closest("[data-panel-tab]");

  if (!button) {
    return;
  }

  setActivePanelTab(button.dataset.panelTab);
}

function handlePanelOutsideClick(event) {
  if (!activityPanel.classList.contains("is-open")) {
    return;
  }

  const clickedInsidePanel = event.target.closest(".activity-panel-inner");
  const clickedManageButton = event.target.closest(".manage-button");

  if (!clickedInsidePanel && !clickedManageButton) {
    closeActivityPanel();
  }
}

function handlePanelEscape(event) {
  if (event.key === "Escape" && activityPanel.classList.contains("is-open")) {
    closeActivityPanel();
  }
}

function getTimelineStageClass(stage) {
  const normalized = String(stage || "").toLowerCase();

  if (normalized.includes("reject")) {
    return "timeline-rejected";
  }

  if (normalized.includes("approve")) {
    return "timeline-approved";
  }

  if (normalized.includes("verif") || normalized.includes("review")) {
    return "timeline-review";
  }

  return "timeline-submitted";
}

function getTimelineStageIcon(stage) {
  const stageClass = getTimelineStageClass(stage);

  if (stageClass === "timeline-approved") {
    return getDashboardIcon("check");
  }

  if (stageClass === "timeline-rejected") {
    return getDashboardIcon("warning");
  }

  if (stageClass === "timeline-review") {
    return getDashboardIcon("search");
  }

  return getDashboardIcon("ration");
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
  clearDashboardError();
  await Promise.all([loadApplications(), loadStats()]);
}

async function initializeDashboard() {
  if (!checkAuth()) {
    return;
  }

  renderCurrentView();
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
  dashboardAlert.classList.remove("is-success");
  dashboardAlert.hidden = false;
}

function clearDashboardError() {
  dashboardAlert.textContent = "";
  dashboardAlert.classList.remove("is-success");
  dashboardAlert.hidden = true;
}

function showDashboardSuccess(message) {
  dashboardAlert.textContent = message;
  dashboardAlert.classList.add("is-success");
  dashboardAlert.hidden = false;
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

function formatDateTime(value) {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getInitials(value) {
  return String(value || "Officer")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "O";
}

function getSessionReference(token) {
  if (!token) {
    return "active";
  }

  const compactToken = String(token).replace(/[^a-zA-Z0-9]/g, "");
  const suffix = compactToken.slice(-6).toUpperCase();

  return suffix ? `SSO-${suffix}` : "active";
}

function formatSessionVerifiedTime() {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
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
daysSortHeader.addEventListener("click", () => {
  sortMode = "days";
  renderApplicationsTable();
});
refreshButton.addEventListener("click", initializeDashboard);
applicationSearch.addEventListener("input", renderApplicationsTable);
statusFilter.addEventListener("change", () => {
  syncAllCustomDropdowns();
  renderApplicationsTable();
});
schemeFilter.addEventListener("change", () => {
  syncAllCustomDropdowns();
  renderApplicationsTable();
});
sourceFilter.addEventListener("change", () => {
  syncAllCustomDropdowns();
  renderApplicationsTable();
});
schemeBreakdownList.addEventListener("click", handleSchemeGroupToggle);
applicationsTableBody.addEventListener("click", handleConsentRequest);
applicationsTableBody.addEventListener("click", handleManageClick);
detailsTabButton.addEventListener("click", handlePanelTabClick);
activityTabButton.addEventListener("click", handlePanelTabClick);
closePanelButton.addEventListener("click", closeActivityPanel);
activityRetryButton.addEventListener("click", () => loadActivityHistory({ force: true }));
document.addEventListener("click", handlePanelOutsideClick);
document.addEventListener("keydown", handlePanelEscape);
document.addEventListener("click", handleCustomDropdownClick);
document.addEventListener("click", handleCustomDropdownOutsideClick);
document.addEventListener("keydown", handleCustomDropdownKeydown);
updateStageButton.addEventListener("click", handleStatusUpdate);
flagDocumentButton.addEventListener("click", handleDocumentFlag);

initializeDashboard();
