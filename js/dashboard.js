(function () {
  const DASHBOARD_BAR_COLORS = [
    "linear-gradient(135deg, #3b82f6, #2563eb)",
    "linear-gradient(135deg, #f8b84d, #f59e0b)",
    "linear-gradient(135deg, #f27d72, #ef4444)",
    "linear-gradient(135deg, #52c7b8, #14b8a6)",
    "linear-gradient(135deg, #9b8df3, #8b5cf6)",
    "linear-gradient(135deg, #7f93b8, #64748b)",
  ];

  const DASHBOARD_DONUT_COLORS = [
    "#2563eb",
    "#4f8cff",
    "#42b883",
    "#f7ad3a",
    "#8b5cf6",
    "#f26d85",
  ];

  function escapeDashboardHtml(value) {
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

  function formatDashboardNumber(value) {
    return new Intl.NumberFormat("en-US").format(Number(value) || 0);
  }

  function formatDashboardKpiValue(value) {
    if (typeof value === "string") {
      return value || "—";
    }

    return formatDashboardNumber(value);
  }

  function formatDashboardDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function renderDashboardLoadingState(root) {
    root.innerHTML = `
      <div class="dashboard-loading-card">
        <div class="dashboard-loading-title">Loading dashboard metrics...</div>
        <p>Pulling question bank KPIs, charts, and editorial activity from Back4App.</p>
      </div>
    `;
  }

  function renderDashboardErrorState(root, message) {
    root.innerHTML = `
      <div class="dashboard-loading-card dashboard-loading-card-error">
        <div class="dashboard-loading-title">Unable to load dashboard</div>
        <p>${escapeDashboardHtml(message || "Please try again in a moment.")}</p>
      </div>
    `;
  }

  function renderDashboardEmptyState(root) {
    root.innerHTML = `
      <div class="dashboard-loading-card">
        <div class="dashboard-loading-title">No dashboard data yet</div>
        <p>Add questions or seed development data to populate the editorial command center.</p>
      </div>
    `;
  }

  function getKpiDefinitions(metrics) {
    const kpis = metrics?.kpis || {};

    return [
      {
        key: "totalQuestions",
        label: "Total Questions",
        value: kpis.totalQuestions,
        subtitle: "All active and archived questions",
        icon: "◫",
        iconTone: "blue",
      },
      {
        key: "publishedQuestions",
        label: "Published Questions",
        value: kpis.publishedQuestions,
        subtitle: "Visible or publication-ready content",
        icon: "✓",
        iconTone: "green",
      },
      {
        key: "draftQuestions",
        label: "Draft Questions",
        value: kpis.draftQuestions,
        subtitle: "Still in authoring progress",
        icon: "✎",
        iconTone: "blue",
      },
      {
        key: "needsReviewQuestions",
        label: "Needs Review",
        value: kpis.needsReviewQuestions,
        subtitle: "Waiting for editorial review",
        icon: "◔",
        iconTone: "amber",
      },
      {
        key: "revisionRequestedQuestions",
        label: "Revision Requested",
        value: kpis.revisionRequestedQuestions,
        subtitle: "Returned to authors for revision",
        icon: "↺",
        iconTone: "orange",
      },
      {
        key: "approvedQuestions",
        label: "Approved / Ready",
        value: kpis.approvedQuestions,
        subtitle: "Approved and ready to publish",
        icon: "☑",
        iconTone: "green",
      },
      {
        key: "archivedQuestions",
        label: "Archived Questions",
        value: kpis.archivedQuestions,
        subtitle: "Inactive but retained for history",
        icon: "▣",
        iconTone: "slate",
      },
      {
        key: "questionsWithoutReferences",
        label: "Without References",
        value: kpis.questionsWithoutReferences,
        subtitle: "Questions missing linked citations",
        icon: "⌷",
        iconTone: "red",
      },
      {
        key: "questionsWithMedia",
        label: "With Media",
        value: kpis.questionsWithMedia,
        subtitle: "Questions with linked media assets",
        icon: "⌁",
        iconTone: "purple",
      },
      {
        key: "totalReferences",
        label: "Total References",
        value: kpis.totalReferences,
        subtitle: "All reference rows in scope",
        icon: "⋈",
        iconTone: "blue",
      },
      {
        key: "referenceYearRange",
        label: "Reference Year Range",
        value: kpis.referenceYearRange,
        subtitle: "Earliest to latest reference publication year",
        icon: "◷",
        iconTone: "blue",
      },
      {
        key: "institutions",
        label: "Institutions",
        value: kpis.institutions,
        subtitle: "Institution records in scope",
        icon: "⌂",
        iconTone: "blue",
      },
      {
        key: "pendingInvitations",
        label: "Pending Invitations",
        value: kpis.pendingInvitations,
        subtitle: "Outstanding invites awaiting response",
        icon: "⊕",
        iconTone: "blue",
      },
      {
        key: "modifiedLast30Days",
        label: "Modified Recently",
        value: kpis.modifiedLast30Days,
        subtitle: "Updated in the selected date window",
        icon: "◔",
        iconTone: "slate",
      },
    ];
  }

  function renderKpiCards(metrics) {
    const definitions = getKpiDefinitions(metrics);

    return `
      <section class="dashboard-kpi-grid">
        ${definitions
          .map(
            (kpi) => `
              <article class="dashboard-kpi-card">
                <div class="dashboard-kpi-icon-circle dashboard-kpi-icon-${escapeDashboardHtml(
                  kpi.iconTone
                )}" aria-hidden="true">${escapeDashboardHtml(kpi.icon)}</div>
                <div class="dashboard-kpi-copy">
                  <div class="dashboard-kpi-label">${escapeDashboardHtml(kpi.label)}</div>
                  <div class="dashboard-kpi-value">${escapeDashboardHtml(
                    formatDashboardKpiValue(kpi.value)
                  )}</div>
                  <div class="dashboard-kpi-subtitle">${escapeDashboardHtml(kpi.subtitle)}</div>
                </div>
              </article>
            `
          )
          .join("")}
      </section>
    `;
  }

  function renderEmptyChart(message) {
    return `<div class="dashboard-chart-empty">${escapeDashboardHtml(message)}</div>`;
  }

  function renderBarChart(data, labelKey, valueKey) {
    const rows = Array.isArray(data) ? data.filter((item) => Number(item?.[valueKey]) > 0) : [];
    if (!rows.length) {
      return renderEmptyChart("No chart data available.");
    }

    const maxValue = Math.max(...rows.map((item) => Number(item[valueKey]) || 0), 1);

    return `
      <div class="dashboard-bar-chart">
        ${rows
          .map((item, index) => {
            const label = item[labelKey] || "Unspecified";
            const value = Number(item[valueKey]) || 0;
            const width = Math.max(6, Math.round((value / maxValue) * 100));
            const fill = DASHBOARD_BAR_COLORS[index % DASHBOARD_BAR_COLORS.length];

            return `
              <div class="dashboard-bar-row">
                <div class="dashboard-bar-label">${escapeDashboardHtml(label)}</div>
                <div class="dashboard-bar-track">
                  <div class="dashboard-bar-fill" style="width: ${width}%; background: ${fill};"></div>
                </div>
                <div class="dashboard-bar-value">${formatDashboardNumber(value)}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderVerticalBarChart(data, labelKey, valueKey) {
    const rows = Array.isArray(data) ? data.filter((item) => Number(item?.[valueKey]) > 0) : [];
    if (!rows.length) {
      return renderEmptyChart("No chart data available.");
    }

    const maxValue = Math.max(...rows.map((item) => Number(item[valueKey]) || 0), 1);

    return `
      <div class="dashboard-vertical-bar-chart">
        ${rows
          .map((item, index) => {
            const label = item[labelKey] || "Unspecified";
            const value = Number(item[valueKey]) || 0;
            const height = Math.max(10, Math.round((value / maxValue) * 100));
            const fill = DASHBOARD_BAR_COLORS[index % DASHBOARD_BAR_COLORS.length];

            return `
              <div class="dashboard-vertical-bar-item">
                <div class="dashboard-vertical-bar-value">${formatDashboardNumber(value)}</div>
                <div class="dashboard-vertical-bar-track">
                  <div class="dashboard-vertical-bar-fill" style="height: ${height}%; background: ${fill};"></div>
                </div>
                <div class="dashboard-vertical-bar-label">${escapeDashboardHtml(label)}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderLineChart(data, labelKey, valueKey) {
    const points = Array.isArray(data) ? data : [];
    if (!points.length || points.every((point) => Number(point?.[valueKey]) === 0)) {
      return renderEmptyChart("No monthly trend data available.");
    }

    const width = 640;
    const height = 220;
    const padding = 20;
    const maxValue = Math.max(...points.map((point) => Number(point?.[valueKey]) || 0), 1);
    const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

    const coordinates = points.map((point, index) => {
      const value = Number(point?.[valueKey]) || 0;
      const x = padding + stepX * index;
      const y = height - padding - (value / maxValue) * (height - padding * 2);
      return { x, y, label: point?.[labelKey] || "", value };
    });

    const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
    const areaPath = [
      `M ${coordinates[0].x} ${height - padding}`,
      ...coordinates.map((point) => `L ${point.x} ${point.y}`),
      `L ${coordinates[coordinates.length - 1].x} ${height - padding}`,
      "Z",
    ].join(" ");

    return `
      <div class="dashboard-line-chart">
        <svg viewBox="0 0 ${width} ${height}" class="dashboard-line-chart-svg" aria-hidden="true">
          <defs>
            <linearGradient id="dashboard-line-area-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.24"></stop>
              <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.03"></stop>
            </linearGradient>
          </defs>
          <path d="${areaPath}" fill="url(#dashboard-line-area-gradient)"></path>
          <polyline points="${polyline}" fill="none" stroke="#174b93" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
          ${coordinates
            .map(
              (point) => `
                <circle cx="${point.x}" cy="${point.y}" r="4" fill="#00285f"></circle>
              `
            )
            .join("")}
        </svg>
        <div class="dashboard-line-chart-labels">
          ${coordinates
            .map(
              (point) => `
                <div class="dashboard-line-chart-label">
                  <span>${escapeDashboardHtml(point.label)}</span>
                  <strong>${formatDashboardNumber(point.value)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderDonutChart(data, labelKey, valueKey) {
    const rows = Array.isArray(data) ? data.filter((item) => Number(item?.[valueKey]) > 0) : [];
    if (!rows.length) {
      return renderEmptyChart("No chart data available.");
    }

    const total = rows.reduce((sum, item) => sum + (Number(item?.[valueKey]) || 0), 0);
    let runningOffset = 0;

    const slices = rows
      .map((item, index) => {
        const value = Number(item?.[valueKey]) || 0;
        const strokeLength = (value / total) * 100;
        const slice = `
          <circle
            class="dashboard-donut-slice"
            r="15.915"
            cx="21"
            cy="21"
            fill="transparent"
            stroke="${DASHBOARD_DONUT_COLORS[index % DASHBOARD_DONUT_COLORS.length]}"
            stroke-width="8"
            stroke-dasharray="${strokeLength} ${100 - strokeLength}"
            stroke-dashoffset="${25 - runningOffset}"
          ></circle>
        `;
        runningOffset += strokeLength;
        return slice;
      })
      .join("");

    return `
      <div class="dashboard-donut-layout">
        <svg viewBox="0 0 42 42" class="dashboard-donut-chart" aria-hidden="true">
          <circle r="15.915" cx="21" cy="21" fill="transparent" stroke="#e6edf7" stroke-width="8"></circle>
          ${slices}
          <text x="21" y="20" text-anchor="middle" class="dashboard-donut-total">${formatDashboardNumber(total)}</text>
          <text x="21" y="25" text-anchor="middle" class="dashboard-donut-caption">items</text>
        </svg>
        <div class="dashboard-donut-legend">
          ${rows
            .map((item, index) => {
              const label = item?.[labelKey] || "Unspecified";
              const value = Number(item?.[valueKey]) || 0;
              return `
                <div class="dashboard-donut-legend-row">
                  <span class="dashboard-donut-swatch" style="background:${DASHBOARD_DONUT_COLORS[index % DASHBOARD_DONUT_COLORS.length]}"></span>
                  <span>${escapeDashboardHtml(label)}</span>
                  <strong>${formatDashboardNumber(value)}</strong>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderChartCard(title, subtitle, bodyMarkup) {
    return `
      <article class="dashboard-panel-card">
        <div class="dashboard-panel-header">
          <h3>${escapeDashboardHtml(title)}</h3>
          <p>${escapeDashboardHtml(subtitle)}</p>
        </div>
        ${bodyMarkup}
      </article>
    `;
  }

  function renderCharts(metrics) {
    const charts = metrics?.charts || {};

    return `
      <section class="dashboard-chart-grid">
        ${renderChartCard(
          "Questions by Status",
          "Editorial workflow distribution",
          renderBarChart(charts.questionsByStatus, "status", "count")
        )}
        ${renderChartCard(
          "Questions by Specialty",
          "Coverage across specialties",
          renderDonutChart(charts.questionsBySpecialty, "specialty", "count")
        )}
        ${renderChartCard(
          "Questions by Difficulty",
          "Balance of easy through expert content",
          renderVerticalBarChart(charts.questionsByDifficulty, "difficulty", "count")
        )}
        ${renderChartCard(
          "Reference Year Distribution",
          "Reference publication year mix",
          renderBarChart(charts.referenceYearDistribution, "year", "count")
        )}
        ${renderChartCard(
          "Media by Type",
          "Breakdown of linked media assets",
          renderDonutChart(charts.mediaByType, "mediaType", "count")
        )}
        ${renderChartCard(
          "Questions Created by Month",
          "Twelve-month content creation trend",
          renderLineChart(charts.questionsCreatedByMonth, "month", "count")
        )}
      </section>
    `;
  }

  function renderActionButton(label, questionId) {
    if (!questionId) {
      return `<span class="dashboard-table-action dashboard-table-action-disabled">${escapeDashboardHtml(label)}</span>`;
    }

    return `<button type="button" class="dashboard-table-action" data-dashboard-question-id="${escapeDashboardHtml(questionId)}">${escapeDashboardHtml(label)}</button>`;
  }

  function renderTableCard(title, subtitle, columns, rows, rowRenderer, emptyMessage) {
    const hasRows = Array.isArray(rows) && rows.length > 0;

    return `
      <article class="dashboard-panel-card">
        <div class="dashboard-panel-header">
          <h3>${escapeDashboardHtml(title)}</h3>
          <p>${escapeDashboardHtml(subtitle)}</p>
        </div>
        ${
          hasRows
            ? `
              <div class="dashboard-table-shell">
                <table class="dashboard-table">
                  <thead>
                    <tr>
                      ${columns.map((column) => `<th>${escapeDashboardHtml(column)}</th>`).join("")}
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.map(rowRenderer).join("")}
                  </tbody>
                </table>
              </div>
            `
            : `<div class="dashboard-chart-empty">${escapeDashboardHtml(emptyMessage)}</div>`
        }
      </article>
    `;
  }

  function renderTables(metrics) {
    const tables = metrics?.tables || {};

    return `
      <section class="dashboard-table-grid">
        ${renderTableCard(
          "Recently Edited Questions",
          "Most recent question updates inside the selected time window",
          ["Question", "Specialty", "Topic", "Status", "Last Edited", "Editor", "Action"],
          tables.recentlyEditedQuestions || [],
          (row) => `
            <tr>
              <td>${escapeDashboardHtml(row.question || "Untitled question")}</td>
              <td>${escapeDashboardHtml(row.specialty || "—")}</td>
              <td>${escapeDashboardHtml(row.topic || "—")}</td>
              <td>${escapeDashboardHtml(row.status || "—")}</td>
              <td>${escapeDashboardHtml(formatDashboardDate(row.lastEditedDate))}</td>
              <td>${escapeDashboardHtml(row.lastEditedBy || "—")}</td>
              <td>${renderActionButton("Open", row.objectId)}</td>
            </tr>
          `,
          "No recently edited questions found."
        )}
        ${renderTableCard(
          "Review Queue",
          "Questions needing review, revision, or publication follow-up",
          ["Question", "Status", "Specialty", "Days Waiting", "Assigned Reviewer", "Action"],
          tables.reviewQueue || [],
          (row) => `
            <tr>
              <td>${escapeDashboardHtml(row.question || "Untitled question")}</td>
              <td>${escapeDashboardHtml(row.status || "—")}</td>
              <td>${escapeDashboardHtml(row.specialty || "—")}</td>
              <td>${formatDashboardNumber(row.daysWaiting)}</td>
              <td>${escapeDashboardHtml(row.assignedReviewer || "Unassigned")}</td>
              <td>${renderActionButton("Review", row.objectId)}</td>
            </tr>
          `,
          "No questions are currently in the review queue."
        )}
        ${renderTableCard(
          "Content Gaps",
          "Quick counts of missing content elements that need editorial attention",
          ["Gap", "Count"],
          tables.contentGaps || [],
          (row) => `
            <tr>
              <td>${escapeDashboardHtml(row.label || "Gap")}</td>
              <td>${formatDashboardNumber(row.count)}</td>
            </tr>
          `,
          "No content gaps found."
        )}
        ${renderTableCard(
          "Recent Activity",
          "Recent changes from question edit history",
          ["Date", "Editor", "Question", "Change Summary", "Previous Status", "New Status"],
          tables.recentActivity || [],
          (row) => `
            <tr>
              <td>${escapeDashboardHtml(formatDashboardDate(row.date))}</td>
              <td>${escapeDashboardHtml(row.editor || "—")}</td>
              <td>${escapeDashboardHtml(row.question || "Untitled question")}</td>
              <td>${escapeDashboardHtml(row.changeSummary || "Edited question content.")}</td>
              <td>${escapeDashboardHtml(row.previousStatus || "—")}</td>
              <td>${escapeDashboardHtml(row.newStatus || "—")}</td>
            </tr>
          `,
          "No recent activity found."
        )}
      </section>
    `;
  }

  function bindDashboardActions(root) {
    root.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-dashboard-question-id]");
      if (!actionButton) {
        return;
      }

      const questionId = actionButton.dataset.dashboardQuestionId;
      if (!questionId) {
        return;
      }

      if (typeof window.navigateToQuestionEditor === "function") {
        window.navigateToQuestionEditor(questionId);
      }
    });
  }

  async function loadDashboardMetrics() {
    return window.back4app.runCloudFunction("getDashboardMetrics", {
      includeSeedData: true,
      dateRangeDays: 30,
    });
  }

  window.bindDashboardPage = async function bindDashboardPage() {
    const root = document.getElementById("dashboard-root");
    if (!root) {
      return;
    }

    renderDashboardLoadingState(root);

    try {
      const metrics = await loadDashboardMetrics();
      if (!metrics?.kpis || Number(metrics.kpis.totalQuestions || 0) === 0) {
        renderDashboardEmptyState(root);
        return;
      }

      root.innerHTML = `
        ${renderKpiCards(metrics)}
        ${renderCharts(metrics)}
        ${renderTables(metrics)}
      `;

      bindDashboardActions(root);
    } catch (error) {
      console.error("Unable to load dashboard metrics.", error);
      renderDashboardErrorState(
        root,
        error?.message || "The dashboard metrics cloud function did not return successfully."
      );
    }
  };
})();
