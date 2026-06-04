/* ───────── Dashboard rendering ───────── */

function renderDashboard(dashboard) {
  currentDashboardData = dashboard;
  updateAlertBar(dashboard);
  renderMetrics(dashboard.metrics);
  renderTodayMetrics(dashboard.metrics, dashboard.today);
  renderHealthBar(dashboard);
  renderAIBrief(dashboard);
  renderBudgetPanel(dashboard);
  renderPurchaseOptions(dashboard.products || [], dashboard.suppliers || []);
  renderInventory(dashboard);
  renderStorage(dashboard.customer_storage || dashboard.expiring_storage || []);
  renderSuppliers(dashboard.suppliers || []);
  renderAgentSuggestions(dashboard.agent_suggestions || []);
  renderActivities(dashboard.activity_suggestions || []);
  updateReplenishmentBadge();
  loadActivityTimeline();
  checkExpiringStorage(dashboard);
  checkAndNotifyLowStock(dashboard);
  const storage = dashboard.customer_storage || dashboard.expiring_storage || [];
  checkAndNotifyExpiring(storage);
}

function renderPurchaseOptions(products, suppliers) {
  if (products.length > 0) {
    const options = products.map((item) => (
      `<option value="${item.id}">${escapeHtml(item.name)}</option>`
    )).join("");
    productSelect.innerHTML = options;
    saleProductSelect.innerHTML = options;
    inventoryProductSelect.innerHTML = options;
    quoteProductSelect.innerHTML = options;
  }

  if (suppliers.length > 0) {
    const options = suppliers.map((item) => (
      `<option value="${item.id}">${escapeHtml(item.name)}</option>`
    )).join("");
    supplierSelect.innerHTML = options;
    quoteSupplierSelect.innerHTML = options;
  }

  // Initialize searchable combobox for all product/supplier selects
  initSearchableSelect(productSelect);
  initSearchableSelect(supplierSelect);
  initSearchableSelect(saleProductSelect);
  initSearchableSelect(inventoryProductSelect);
  initSearchableSelect(quoteProductSelect);
  initSearchableSelect(quoteSupplierSelect);
}

function renderMetrics(metrics) {
  Object.entries(metrics || {}).forEach(([key, value]) => {
    const node = document.querySelector(`[data-metric="${key}"]`);
    if (node) {
      node.textContent = value;
    }
  });
}

function renderTodayMetrics(metrics, today) {
  const metricMap = {
    today_revenue: (today && today.sales_revenue) ? `¥${formatNumber(today.sales_revenue)}` : "0",
    today_sales: (today && today.sales_count != null) ? String(today.sales_count) : "0",
    low_stock_count: (metrics && metrics.low_stock_count != null) ? String(metrics.low_stock_count) : "0",
    expiring_storage_count: (metrics && metrics.expiring_storage_count != null) ? String(metrics.expiring_storage_count) : "0",
  };
  Object.entries(metricMap).forEach(([key, value]) => {
    const node = document.querySelector(`[data-metric="${key}"]`);
    if (node) {
      node.textContent = value;
    }
  });
}

function renderDashboardTrend(trendData) {
  const canvas = document.getElementById("chart-dashboard-trend");
  if (!canvas) { return; }
  if (dashboardTrendChart) { dashboardTrendChart.destroy(); dashboardTrendChart = null; }
  const labels = trendData.map(d => d.date.slice(5));
  const revenues = trendData.map(d => d.revenue);
  dashboardTrendChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "日营收 (¥)",
        data: revenues,
        borderColor: "#0066cc",
        backgroundColor: "rgba(0,102,204,0.06)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: "#0066cc",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 10 }, maxTicksLimit: 7 } },
        y: { ticks: { font: { size: 10 }, callback: v => `¥${v}` } },
      },
    },
  });
}

/* ───────── Revenue forecast ───────── */

function renderForecastSummary(forecastData) {
  const summary = forecastData.summary || {};
  const smaEl = document.querySelector('[data-forecast="sma_total"]');
  const lrEl = document.querySelector('[data-forecast="lr_total"]');
  if (smaEl) smaEl.textContent = `¥${formatNumber(summary.sma_total || 0)}`;
  if (lrEl) lrEl.textContent = `¥${formatNumber(summary.lr_total || 0)}`;
}

function renderForecastChart(forecastData) {
  const canvas = document.getElementById("chart-forecast");
  if (!canvas) return;
  if (window._forecastChart) { window._forecastChart.destroy(); window._forecastChart = null; }

  const historical = forecastData.historical || [];
  const smaForecast = forecastData.sma_forecast || [];
  const lrForecast = forecastData.lr_forecast || [];
  if (!historical.length && !smaForecast.length) return;

  const allDates = [...historical.map(d => d.date), ...smaForecast.map(d => d.date)];
  const labels = allDates.map(d => d.slice(5));
  const histLen = historical.length;
  const foreLen = smaForecast.length;

  const histData = historical.map(d => d.revenue);
  const histPadded = [...histData, ...Array(foreLen).fill(null)];
  const smaPadded = [...Array(histLen).fill(null), ...smaForecast.map(d => d.revenue)];
  const lrPadded = [...Array(histLen).fill(null), ...lrForecast.map(d => d.revenue)];

  window._forecastChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "历史营收",
          data: histPadded,
          borderColor: "#0066cc",
          backgroundColor: "rgba(0,102,204,0.06)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: "#0066cc",
        },
        {
          label: "SMA 预测",
          data: smaPadded,
          borderColor: "#ff9500",
          backgroundColor: "rgba(255,149,0,0.06)",
          borderWidth: 2,
          borderDash: [6, 3],
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: "#ff9500",
        },
        {
          label: "回归预测",
          data: lrPadded,
          borderColor: "#34c759",
          backgroundColor: "rgba(52,199,89,0.06)",
          borderWidth: 2,
          borderDash: [3, 3],
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: "#34c759",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ¥${ctx.parsed.y.toFixed(0)}` } },
      },
      scales: {
        x: { ticks: { font: { size: 10 }, maxTicksLimit: 10 } },
        y: { ticks: { font: { size: 10 }, callback: v => `¥${v}` } },
      },
    },
  });
}

async function loadRevenueForecast() {
  try {
    const data = await apiFetch("/api/revenue-forecast");
    renderForecastChart(data);
    renderForecastSummary(data);
  } catch (_) { /* silent */ }
}

/* ───────── Budget dashboard panel ───────── */

function renderBudgetPanel(dashboard) {
  const panel = document.querySelector("[data-budget-dashboard-panel]");
  if (!panel) return;
  const budget = dashboard.budget;
  if (!budget || budget.budget <= 0) {
    panel.innerHTML = `<p style="color:var(--ink-muted);font-size:13px;">暂无预算。 <a href="#" data-open-budget style="font-size:13px;">设置预算</a></p>`;
    panel.querySelector("[data-open-budget]")?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("[data-budget-modal]").hidden = false;
    });
    return;
  }
  const pct = budget.percent_used;
  const barColor = pct >= 95 ? "#dc2626" : pct >= 80 ? "#f59e0b" : "var(--primary)";
  panel.innerHTML = `
    <div style="margin-bottom:8px;">
      <span style="font-size:24px;font-weight:600;">${pct}%</span>
      <span style="color:var(--ink-muted);font-size:13px;margin-left:8px;">已使用</span>
    </div>
    <div style="height:8px;background:var(--hairline);border-radius:4px;overflow:hidden;margin-bottom:8px;">
      <div style="height:100%;width:${Math.min(pct, 100)}%;background:${barColor};border-radius:4px;transition:width 0.3s;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--ink-muted);">
      <span>已用 ¥${formatNumber(budget.spent)}</span>
      <span>预算 ¥${formatNumber(budget.budget)}</span>
    </div>
    ${budget.alert === "critical" ? '<p style="margin:6px 0 0;font-size:12px;color:#dc2626;">严重超预算</p>' : ""}
    ${budget.alert === "warning" ? '<p style="margin:6px 0 0;font-size:12px;color:#f59e0b;">预算即将用完</p>' : ""}`;
}

function renderDailyReport(report) {
  const el = document.querySelector("[data-daily-report]");
  if (!el) { return; }
  if (!report) {
    el.innerHTML = `<p style="margin:0;color:var(--ink-muted);">今日暂无报告，<button class="text-link" type="button" data-generate-today-report style="font-size:14px;border:0;background:none;cursor:pointer;padding:0;">点击生成</button></p>`;
    el.className = "ai-brief";
    return;
  }
  const m = report.metrics || {};
  el.innerHTML = `
    <p style="margin:0 0 6px;font-size:13px;color:var(--ink-muted);">${report.period} · 已生成</p>
    <p style="margin:0;font-size:13px;line-height:1.7;">
      采购 ¥${m.purchase_amount || 0} · 出库 ${m.outbound_quantity || 0} · 损耗 ${m.loss_quantity || 0}<br>
      缺货 ${m.low_stock_count || 0} SKU · 积压 ${m.overstock_count || 0} SKU
    </p>`;
  el.className = "ai-brief";
}

function renderHealthBar(dashboard) {
  const bar = document.querySelector("[data-health-bar]");
  if (!bar) return;
  const metrics = dashboard.metrics || {};
  const low = metrics.low_stock_count || 0;
  const over = metrics.overstock_count || 0;
  const total = (dashboard.products || []).length || 1;
  const normal = Math.max(0, total - low - over);

  bar.innerHTML = `
    <div class="health-segment low" style="flex:${low};">
      <span class="health-label">缺货 ${low}</span>
    </div>
    <div class="health-segment normal" style="flex:${normal};">
      <span class="health-label">正常 ${normal}</span>
    </div>
    <div class="health-segment over" style="flex:${over};">
      <span class="health-label">积压 ${over}</span>
    </div>`;

  const details = document.querySelector("[data-health-details]");
  if (details) {
    const totalProducts = (dashboard.products || []).length;
    details.innerHTML = `
      <div class="health-detail-row"><span class="health-dot low"></span> 缺货预警：${low} 款 SKU 低于安全库存</div>
      <div class="health-detail-row"><span class="health-dot normal"></span> 库存正常：${normal} 款 SKU</div>
      <div class="health-detail-row"><span class="health-dot over"></span> 库存积压：${over} 款 SKU 周转过慢</div>
      <div class="health-detail-row" style="margin-top:2px;color:var(--ink-muted);">共 ${totalProducts} 款酒水在库</div>`;
  }
}

function renderAIBrief(dashboard) {
  const el = document.querySelector("[data-ai-brief]");
  if (!el) return;
  const suggestions = dashboard.agent_suggestions || [];
  if (suggestions.length === 0) {
    el.innerHTML = `<p style="margin:0;color:var(--ink-muted);">暂无特别建议，当前经营数据平稳。</p>`;
    el.className = "ai-brief";
    return;
  }
  const top = suggestions.slice(0, 3);
  const lines = top.map((s) => {
    return `<p style="margin:0 0 8px;"><strong>${escapeHtml(s.title)}</strong> — ${escapeHtml(s.summary || "")}</p>`;
  }).join("");
  el.innerHTML = lines;
  el.className = "ai-brief";
}

/* ───────── Alert bar ───────── */

function updateAlertBar(dashboard) {
  const bar = document.querySelector('[data-alert-bar]');
  const content = document.querySelector('[data-alert-content]');
  const metrics = dashboard.metrics || {};
  const alerts = [];

  // Built-in alerts
  if (metrics.low_stock_count > 0) {
    alerts.push(`<span class="alert-badge">${metrics.low_stock_count}</span> 款酒水库存不足，建议尽快补货`);
  }
  if (metrics.overstock_count > 0) {
    alerts.push(`<span class="alert-badge">${metrics.overstock_count}</span> 款酒水库存积压，适合做促销活动`);
  }
  if (metrics.expiring_storage_count > 0) {
    alerts.push(`<span class="alert-badge info">${metrics.expiring_storage_count}</span> 位客户存酒即将到期`);
  }

  // Rule engine alerts
  const ruleAlerts = evaluateRules(dashboard);
  ruleAlerts.forEach(ra => {
    const badgeClass = ra.priority === "high" ? "danger" : ra.priority === "medium" ? "" : "info";
    alerts.push(`<span class="alert-badge ${badgeClass}">规则</span> ${escapeHtml(ra.message)}`);
  });

  if (alerts.length) {
    content.innerHTML = alerts.map(a => `<span>${a}</span>`).join('');
    bar.hidden = false;
  } else {
    bar.hidden = true;
  }
}

function setLiveSummaryForDashboard(dashboard) {
  if (!liveSummary) { return; }
  const metrics = dashboard.metrics || {};
  liveSummary.textContent = `已连接后端实时数据：快缺货 ${metrics.low_stock_count ?? 0}，库存积压 ${metrics.overstock_count ?? 0}，临期存酒 ${metrics.expiring_storage_count ?? 0}，AI 建议 ${metrics.agent_suggestion_count ?? 0}。`;
}

function setFallbackSummary(error) {
  if (!liveSummary) { return; }
  const message = getConnectionErrorMessage(error);
  liveSummary.textContent = `后端未连接，当前显示演示数据。错误：${message}`;
}

/* ───────── Dashboard data loading ───────── */

async function loadDashboard() {
  setApiStatus("连接中...", false);

  try {
    const dashboard = await apiFetch("/api/dashboard");
    renderDashboard(dashboard);
    currentReplenishmentData = dashboard.replenishment || [];
    loadSalesTrend();
    loadRevenueForecast();
    loadTodaysReport();
    setLiveSummaryForDashboard(dashboard);
    setApiStatus("实时数据", true);
    if (lastRefreshEl) {
      const now = new Date();
      lastRefreshEl.textContent = `更新于 ${now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    }
    removeOfflineBanner();
  } catch (error) {
    console.error("Dashboard API connection failed:", error);
    setApiStatus("后端未连接", false);
    setFallbackSummary(error);
    showOfflineDashboard(error);
  }
}

function getConnectionErrorMessage(error) {
  if (!error) {
    return "未知错误";
  }
  return error.message || String(error);
}

function showOfflineDashboard(error) {
  const message = getConnectionErrorMessage(error);
  const brief = document.querySelector("[data-ai-brief]");
  if (brief) {
    brief.innerHTML = `<p style="margin:0;">后端服务未启动或无法连接。错误：<code style="background:var(--parchment);padding:2px 6px;border-radius:4px;">${escapeHtml(message)}</code></p>`;
    brief.className = "ai-brief offline";
  }
  if (lastRefreshEl) {
    lastRefreshEl.textContent = "连接失败";
  }
  const grid = document.querySelector(".dashboard-grid");
  if (grid && !document.querySelector(".dashboard-offline")) {
    const banner = document.createElement("div");
    banner.className = "dashboard-offline";
    banner.textContent = `后端服务未连接 — ${message}`;
    grid.insertAdjacentElement("afterend", banner);
  }
}

function removeOfflineBanner() {
  const banner = document.querySelector(".dashboard-offline");
  if (banner) {
    banner.remove();
  }
}

let dashboardRefreshTimer = null;

function startDashboardAutoRefresh() {
  stopDashboardAutoRefresh();
  dashboardRefreshTimer = setInterval(loadDashboard, 30000);
}

function stopDashboardAutoRefresh() {
  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer);
    dashboardRefreshTimer = null;
  }
}

async function loadSalesTrend() {
  try {
    const data = await apiFetch("/api/recent-sales-trend");
    renderDashboardTrend(data.items || []);
  } catch (_) { /* ignore */ }
}

async function loadTodaysReport() {
  try {
    const report = await apiFetch("/api/todays-report");
    renderDailyReport(report);
  } catch (_) {
    renderDailyReport(null);
  }
}

async function generateTodayReportFromDashboard() {
  const el = document.querySelector("[data-daily-report]");
  if (el) el.innerHTML = '<p class="form-message">生成中...</p>';
  try {
    const report = await apiFetch("/api/agent-reports", {
      method: "POST",
      body: { created_at: new Date().toISOString() },
    });
    await apiFetch("/api/agent-reports/save", {
      method: "POST",
      body: {
        title: report.title,
        period: report.period,
        content: report.content,
        metrics: report.metrics,
        created_at: new Date().toISOString(),
      },
    });
    renderDailyReport(report);
  } catch (err) {
    if (el) el.innerHTML = `<p style="margin:0;color:#bf4800;">生成失败：${err.message}</p>`;
  }
}
