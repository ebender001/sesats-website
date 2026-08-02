(function () {
  const REPORT_SECTIONS = [
    ["reports-workflow", "Workflow"], ["reports-question-bank", "Question Bank"], ["reports-editorial", "Editorial"],
    ["reports-ai", "AI Usage"], ["reports-activity-log", "Activity Log"], ["reports-audit-log", "Audit Log"],
  ];
  const DEFAULT_DAYS = 90;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const number = (value) => new Intl.NumberFormat("en-US").format(Number(value) || 0);
  const dateLabel = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—";
  const shortDate = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)) : "—";
  const toInputDate = (date) => new Date(date).toISOString().slice(0, 10);
  const daysAgo = (days) => toInputDate(Date.now() - days * 86400000);
  const stageTone = (stage) => ({ draft: "slate", submitted: "blue", in_review: "amber", returned: "red", approved: "green", other: "slate" })[stage] || "slate";

  function emptyState(message) { return `<div class="workflow-empty">${escapeHtml(message)}</div>`; }
  function reportTabs(active) {
    return `<nav class="workflow-report-tabs" aria-label="Report navigation">${REPORT_SECTIONS.map(([section, label]) => `<a href="#${section}" class="workflow-report-tab ${section === active ? "active" : ""}">${label}</a>`).join("")}</nav>`;
  }
  function selectOptions(values, label, selected = "") {
    return [`<option value="">${label}</option>`, ...(values || []).map((item) => {
      const value = typeof item === "object" ? item.value : item;
      const text = typeof item === "object" ? item.text : item;
      return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(text)}</option>`;
    })].join("");
  }
  function renderFilters(data, filters) {
    const options = data.filterOptions || {};
    return `<section class="workflow-filter-card" aria-label="Workflow report filters">
      <form id="workflow-filter-form" class="workflow-filter-grid">
        <label>Date range <span class="workflow-date-pair"><input type="date" name="dateStart" value="${escapeHtml(filters.dateStart)}" aria-label="Start date"><input type="date" name="dateEnd" value="${escapeHtml(filters.dateEnd)}" aria-label="End date"></span></label>
        <label>Institution <select name="institution" disabled title="Institution is not yet stored on Question records"><option>All institutions</option></select></label>
        <label>Specialty <select name="specialty">${selectOptions(options.specialties, "All specialties", filters.specialty)}</select></label>
        <label>Topic <select name="topic">${selectOptions(options.topics, "All topics", filters.topic)}</select></label>
        <label>Author <select name="author">${selectOptions(options.authors, "All authors", filters.author)}</select></label>
        <label>Reviewer <select name="reviewer">${selectOptions(options.reviewers, "All reviewers", filters.reviewer)}</select></label>
        <label>Workflow status <select name="status">${selectOptions([["draft", "Draft"], ["submitted", "Submitted"], ["in_review", "In Review"], ["returned", "Returned"], ["approved", "Approved"]].map(([value, text]) => ({ value, text })), "All statuses", filters.status)}</select></label>
        <div class="workflow-filter-actions"><button class="button button-primary" type="submit">Apply filters</button><button class="button button-secondary" type="button" data-workflow-clear>Clear</button><button class="button button-secondary" type="button" data-workflow-export>Export CSV</button></div>
      </form>
      <p class="workflow-updated">Last updated ${escapeHtml(dateLabel(data.generatedAt))}</p>
    </section>`;
  }
  function renderKpis(data) {
    const summary = data.summary || {};
    const definitions = [
      ["draft", "Drafts", summary.drafts, "Still in authoring progress", "✎"], ["submitted", "Awaiting Review", summary.awaitingReview, "Awaiting assignment or decision", "◔"],
      ["in_review", "In Review", summary.inReview, "Active reviewer work", "◌"], ["returned", "Returned for Revision", summary.returnedForRevision, "Needs author follow-up", "↺"],
      ["approved", "Approved", summary.approved, "Ready for publication", "✓"], ["", "Median Review Time", `${Number(summary.medianReviewTimeDays || 0).toFixed(1)}d`, "From submission to review", "◷"],
    ];
    return `<section class="workflow-kpi-grid">${definitions.map(([stage, label, value, copy, icon]) => `<button type="button" class="workflow-kpi-card" data-workflow-stage="${stage}" ${stage ? "" : "disabled"}><span class="workflow-kpi-icon workflow-tone-${stageTone(stage)}">${icon}</span><span><span class="workflow-kpi-label">${label}</span><strong>${escapeHtml(value)}</strong><small>${copy}</small></span></button>`).join("")}</section>`;
  }
  function renderStageChart(rows) {
    const usable = rows.filter((row) => row.stage !== "other");
    if (!usable.some((row) => row.count)) return emptyState("No workflow activity matches the selected filters.");
    return `<div class="workflow-stage-chart" role="img" aria-label="Question counts and percentages by workflow stage">${usable.map((row) => `<button type="button" class="workflow-stage-row" data-workflow-stage="${escapeHtml(row.stage)}" title="Filter questions by ${escapeHtml(row.label)}"><span>${escapeHtml(row.label)}</span><span class="workflow-stage-track"><i class="workflow-tone-${stageTone(row.stage)}" style="width:${Math.max(3, row.percentage)}%"></i></span><b>${number(row.count)}</b><em>${number(row.percentage)}%</em></button>`).join("")}</div>`;
  }
  function renderTrend(rows) {
    if (!rows.length) return emptyState("No workflow activity was recorded in this period.");
    const max = Math.max(1, ...rows.flatMap((row) => [row.submitted, row.completed, row.returned, row.approved]));
    return `<div class="workflow-trend" role="img" aria-label="Workflow activity over time. Submitted, completed reviews, returned, and approved questions."><div class="workflow-legend"><span class="submitted">Submitted</span><span class="completed">Reviews completed</span><span class="returned">Returned</span><span class="approved">Approved</span></div><div class="workflow-trend-bars">${rows.map((row) => `<div class="workflow-trend-group" title="${escapeHtml(row.date)}: ${row.submitted} submitted, ${row.completed} completed, ${row.returned} returned, ${row.approved} approved"><div><i class="submitted" style="height:${Math.max(2, row.submitted / max * 100)}%"></i><i class="completed" style="height:${Math.max(2, row.completed / max * 100)}%"></i><i class="returned" style="height:${Math.max(2, row.returned / max * 100)}%"></i><i class="approved" style="height:${Math.max(2, row.approved / max * 100)}%"></i></div><small>${escapeHtml(shortDate(row.date))}</small></div>`).join("")}</div></div>`;
  }
  function panel(title, subtitle, body, className = "") { return `<article class="workflow-panel ${className}"><header><h3>${title}</h3><p>${subtitle}</p></header>${body}</article>`; }
  function renderTurnaround(turnaround, overdueDays) {
    return `<div class="workflow-turnaround-grid"><div><span>Median first review</span><strong>${Number(turnaround.medianFirstReviewDays || 0).toFixed(1)} days</strong></div><div><span>Final decision</span><strong>${Number(turnaround.medianDecisionDays || 0).toFixed(1)} days</strong></div><div><span>Within ${overdueDays}-day target</span><strong>${number(turnaround.completedWithinTarget)}%</strong></div><div><span>Currently overdue</span><strong>${number(turnaround.currentlyOverdue)}</strong></div></div>`;
  }
  function renderBottlenecks(rows) {
    return `<div class="workflow-table-shell"><table class="workflow-table"><thead><tr><th>Stage</th><th>Current</th><th>Median days</th><th>Oldest</th><th>Overdue</th></tr></thead><tbody>${rows.map((row) => `<tr class="${row.overdue ? "workflow-bottleneck" : ""}"><td>${escapeHtml(row.label)}</td><td>${number(row.count)}</td><td>${row.medianDays}d</td><td>${row.oldestDays}d</td><td>${number(row.overdue)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function renderAttention(rows) {
    if (!rows.length) return emptyState("No questions currently require workflow attention.");
    return `<div class="workflow-table-shell"><table class="workflow-table workflow-attention-table"><thead><tr><th>Question</th><th>Specialty</th><th>Status</th><th>Author</th><th>Reviewer</th><th>Days</th><th>Attention reason</th><th>Last activity</th><th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr data-workflow-question="${escapeHtml(row.objectId)}" tabindex="0"><td><strong>${escapeHtml(row.idLabel)}</strong><span>${escapeHtml(row.title)}</span></td><td>${escapeHtml(row.specialty)}</td><td><span class="workflow-status workflow-tone-${stageTone(row.stage)}">${escapeHtml(row.status)}</span></td><td>${escapeHtml(row.author)}</td><td>${escapeHtml(row.reviewer)}</td><td>${number(row.daysInStatus)}</td><td>${escapeHtml(row.attentionReason)}</td><td>${escapeHtml(dateLabel(row.lastActivity))}</td><td><button class="workflow-action" type="button" data-workflow-open="${escapeHtml(row.objectId)}">View question</button></td></tr>`).join("")}</tbody></table></div>`;
  }
  function renderWorkload(rows) {
    if (!rows.length) return emptyState("No reviewer assignments match the selected filters.");
    return `<div class="workflow-table-shell"><table class="workflow-table"><thead><tr><th>Reviewer</th><th>Assigned</th><th>In progress</th><th>Overdue</th><th>Completed</th><th>Median turnaround</th><th>Acceptance rate <abbr title="Descriptive only; rates vary with question quality and assignment type.">ⓘ</abbr></th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.reviewer)}</td><td>${number(row.assigned)}</td><td>${number(row.inProgress)}</td><td>${number(row.overdue)}</td><td>${number(row.completed)}</td><td>${Number(row.medianTurnaround).toFixed(1)}d</td><td>${row.acceptanceRate === null ? "—" : `${row.acceptanceRate}%`}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function renderActivity(rows) {
    if (!rows.length) return emptyState("No recent workflow activity.");
    return `<ol class="workflow-activity">${rows.map((row) => `<li><span class="workflow-activity-dot"></span><div><strong>${escapeHtml(row.user)}</strong> ${escapeHtml(row.action)}<a href="?editQuestionId=${encodeURIComponent(row.objectId)}#questions-list">${escapeHtml(row.question)}</a><small>${escapeHtml(dateLabel(row.timestamp))}${row.status ? ` · ${escapeHtml(row.status)}` : ""}</small></div></li>`).join("")}</ol>`;
  }
  function renderReport(root, data, filters) {
    root.innerHTML = `${reportTabs("reports-workflow")}${renderFilters(data, filters)}${renderKpis(data)}<section class="workflow-two-column">${panel("Questions by Workflow Stage", "Click a stage to filter questions requiring attention.", renderStageChart(data.workflowStages || []))}${panel("Workflow Activity Over Time", "Submitted questions, completed reviews, returns, and approvals.", renderTrend(data.activityTrend || []))}</section><section class="workflow-two-column">${panel("Review Turnaround", `Target: ${data.overdueDays}-day review window.`, renderTurnaround(data.turnaround || {}, data.overdueDays))}${panel("Workflow Bottlenecks", "Warnings are based on age and overdue volume, not count alone.", renderBottlenecks(data.bottlenecks || []))}</section>${panel("Questions Requiring Attention", "Items requiring assignment, review, revision, or content completion.", renderAttention(data.attentionQuestions || []))}<section class="workflow-two-column">${panel("Reviewer Workload", "Acceptance rate is descriptive, not a performance judgment.", renderWorkload(data.reviewerWorkload || []))}${panel("Recent Workflow Activity", "A compact workflow summary; the full Activity Log is available separately.", renderActivity(data.recentActivity || []))}</section>`;
    bindInteractions(root, data, filters);
  }
  function getFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return { dateStart: params.get("reportStart") || daysAgo(DEFAULT_DAYS - 1), dateEnd: params.get("reportEnd") || toInputDate(new Date()), specialty: params.get("reportSpecialty") || "", topic: params.get("reportTopic") || "", author: params.get("reportAuthor") || "", reviewer: params.get("reportReviewer") || "", status: params.get("reportStatus") || "" };
  }
  function saveFilters(filters) {
    const url = new URL(window.location.href);
    const entries = { reportStart: filters.dateStart, reportEnd: filters.dateEnd, reportSpecialty: filters.specialty, reportTopic: filters.topic, reportAuthor: filters.author, reportReviewer: filters.reviewer, reportStatus: filters.status };
    Object.entries(entries).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    window.history.replaceState({}, "", url);
  }
  async function load(root, filters) {
    root.innerHTML = `<section class="workflow-loading-card"><div class="workflow-skeleton workflow-skeleton-title"></div><div class="workflow-skeleton-grid"><span></span><span></span><span></span><span></span></div></section>`;
    try {
      const data = await window.back4app.runCloudFunction("getWorkflowReport", { dateStart: filters.dateStart, dateEnd: filters.dateEnd, filters });
      renderReport(root, data, filters);
    } catch (error) {
      console.error("Unable to load workflow report.", error);
      root.innerHTML = `${reportTabs("reports-workflow")}<section class="workflow-error"><h3>Unable to load the workflow report</h3><p>Try again in a moment. Your filters have been preserved.</p><button class="button button-primary" type="button" data-workflow-retry>Retry</button></section>`;
      root.querySelector("[data-workflow-retry]")?.addEventListener("click", () => load(root, filters));
    }
  }
  function exportCsv(data) {
    const rows = [["Workflow Report", "Generated", data.generatedAt], [], ["KPI", "Value"], ...Object.entries(data.summary || {}).map(([key, value]) => [key, value]), [], ["Questions Requiring Attention"], ["Question ID", "Title", "Specialty", "Status", "Author", "Reviewer", "Days in status", "Attention reason"], ...(data.attentionQuestions || []).map((row) => [row.idLabel, row.title, row.specialty, row.status, row.author, row.reviewer, row.daysInStatus, row.attentionReason]), [], ["Reviewer Workload"], ["Reviewer", "Assigned", "In progress", "Overdue", "Completed", "Median turnaround", "Acceptance rate"], ...(data.reviewerWorkload || []).map((row) => [row.reviewer, row.assigned, row.inProgress, row.overdue, row.completed, row.medianTurnaround, row.acceptanceRate ?? ""])];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = "sesats-workflow-report.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  function bindInteractions(root, data, filters) {
    root.querySelector("#workflow-filter-form")?.addEventListener("submit", (event) => { event.preventDefault(); const next = { ...filters }; new FormData(event.currentTarget).forEach((value, key) => { next[key] = String(value); }); saveFilters(next); load(root, next); });
    root.querySelector("[data-workflow-clear]")?.addEventListener("click", () => { const next = { dateStart: daysAgo(DEFAULT_DAYS - 1), dateEnd: toInputDate(new Date()), specialty: "", topic: "", author: "", reviewer: "", status: "" }; saveFilters(next); load(root, next); });
    root.querySelector("[data-workflow-export]")?.addEventListener("click", () => exportCsv(data));
    root.querySelectorAll("[data-workflow-stage]").forEach((button) => button.addEventListener("click", () => { const stage = button.dataset.workflowStage; if (!stage) return; const next = { ...filters, status: stage }; saveFilters(next); load(root, next); }));
    root.querySelectorAll("[data-workflow-open]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); window.navigateToQuestionEditor?.(button.dataset.workflowOpen); }));
    root.querySelectorAll("[data-workflow-question]").forEach((row) => row.addEventListener("click", () => window.navigateToQuestionEditor?.(row.dataset.workflowQuestion)));
  }
  window.bindWorkflowReportPage = async function (section) {
    const root = document.getElementById("workflow-report-root"); if (!root) return;
    if (section && section !== "reports" && section !== "reports-workflow") { root.innerHTML = `${reportTabs(section)}${panel("Coming soon", "This report is being prepared. Workflow reporting is available now.", "<p class=\"workflow-coming-copy\">Use the Workflow report to monitor editorial flow and review turnaround.</p>")}`; return; }
    load(root, getFiltersFromUrl());
  };
})();
