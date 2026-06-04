/* ───────── Shared utilities ───────── */

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return value;
  }
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderUtilityCard(card) {
  return `
    <article class="utility-card">
      <p class="card-kicker">${escapeHtml(card.kicker)}</p>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.body)}</p>
      <a class="text-link" href="#agent">${escapeHtml(card.link)}</a>
    </article>
  `;
}

function setApiStatus(text, isLive) {
  apiStatusBadges.forEach((badge) => {
    badge.textContent = text;
    badge.classList.toggle("live", isLive);
    badge.classList.toggle("error", !isLive && text !== "演示数据");
  });
  if (liveSummary) {
    liveSummary.textContent = "";
    liveSummary.classList.toggle("live", isLive);
  }
}

/* ───────── Unified API fetch with retry ───────── */

const API_MAX_RETRIES = 2;
const API_RETRY_DELAY_MS = 800;

async function apiFetch(path, options = {}) {
  const { method, body, retries = API_MAX_RETRIES, timeoutMs = 15000 } = options;
  const url = `${API_BASE_URL}${path}`;
  const headers = { ...authHeaders() };
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: method || (body ? "POST" : "GET"),
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `API ${response.status}`);
      }

      return data;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, API_RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

async function postJson(path, payload) {
  return apiFetch(path, { method: "POST", body: payload });
}

function authHeaders() {
  const userName = localStorage.getItem("bar-user-name") || (getCurrentRole() === "admin" ? "管理员" : "店员");
  return {
    "X-User-Role": getCurrentRole(),
    "X-User-Name": encodeURIComponent(userName),
  };
}

/* ───────── Toast notification ───────── */

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ───────── Searchable combobox ───────── */

function initSearchableSelect(selectEl) {
  if (!selectEl || selectEl.dataset.comboboxInit === "true") return;
  selectEl.dataset.comboboxInit = "true";

  const wrapper = document.createElement("div");
  wrapper.className = "combobox";
  selectEl.parentNode.insertBefore(wrapper, selectEl);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "combobox-input";
  input.placeholder = selectEl.querySelector("option")?.textContent || "搜索...";
  input.autocomplete = "off";

  const dropdown = document.createElement("div");
  dropdown.className = "combobox-dropdown";
  dropdown.hidden = true;

  wrapper.appendChild(input);
  wrapper.appendChild(dropdown);
  selectEl.hidden = true;

  let highlightedIndex = -1;
  let options = [];

  function getOptions() {
    return Array.from(selectEl.options).filter(o => o.value !== "");
  }

  function renderOptions(filterText) {
    options = getOptions();
    const filtered = filterText
      ? options.filter(o => o.textContent.toLowerCase().includes(filterText.toLowerCase()))
      : options;

    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="combobox-no-results">无匹配结果</div>';
    } else {
      dropdown.innerHTML = filtered.map((o, i) => {
        const cls = [];
        if (i === highlightedIndex) cls.push("highlighted");
        if (o.selected) cls.push("selected");
        return `<div class="combobox-option ${cls.join(" ")}" data-combobox-value="${o.value}">${escapeHtml(o.textContent)}</div>`;
      }).join("");
    }
    dropdown.hidden = false;
    highlightedIndex = -1;
  }

  input.addEventListener("focus", () => renderOptions(input.value));
  input.addEventListener("input", () => renderOptions(input.value));

  input.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll(".combobox-option");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
      renderOptions(input.value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      renderOptions(input.value);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && items[highlightedIndex]) {
        items[highlightedIndex].click();
      }
    } else if (e.key === "Escape") {
      dropdown.hidden = true;
      input.blur();
    }
  });

  dropdown.addEventListener("click", (e) => {
    const optionEl = e.target.closest("[data-combobox-value]");
    if (!optionEl) return;
    const val = optionEl.dataset.comboboxValue;
    selectEl.value = val;
    input.value = optionEl.textContent.trim();
    dropdown.hidden = true;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  });

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      dropdown.hidden = true;
    }
  });

  // Set initial display value
  const selectedOpt = selectEl.selectedOptions[0];
  if (selectedOpt && selectedOpt.value) {
    input.value = selectedOpt.textContent;
  }

  // Update input display to match currently selected option
  function syncDisplay() {
    const selectedOpt = selectEl.selectedOptions[0];
    if (selectedOpt && selectedOpt.value) {
      input.value = selectedOpt.textContent;
    }
  }

  return { wrapper, input, dropdown, update: renderOptions, syncDisplay };
}

function syncComboboxDisplay(selectEl) {
  const wrapper = selectEl?.parentNode;
  if (!wrapper || !wrapper.classList.contains("combobox")) return;
  const input = wrapper.querySelector(".combobox-input");
  if (!input) return;
  const selectedOpt = selectEl.selectedOptions[0];
  if (selectedOpt && selectedOpt.value) {
    input.value = selectedOpt.textContent;
  }
}

/* ───────── Keyboard shortcuts ───────── */

function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          purchaseModal.hidden = false;
          loadReplenishmentPanel();
          break;
        case "b":
          e.preventDefault();
          openPOSModal();
          break;
        case "k":
          e.preventDefault();
          const searchInput = document.querySelector("[data-agent-input]");
          if (searchInput) { searchInput.focus(); searchInput.scrollIntoView({ behavior: "smooth" }); }
          break;
        case "r":
          e.preventDefault();
          openReportModal();
          break;
        case "s":
          e.preventDefault();
          openStorageModal();
          break;
        case "q":
          e.preventDefault();
          openSupplierQuotesModal();
          break;
        case "i":
          e.preventDefault();
          openInventoryAdjustmentModal();
          break;
      }
    }
  });
}

/* ───────── Expiring storage notification ───────── */

async function checkExpiringStorage(dashboardData) {
  try {
    const dashboard = dashboardData || await apiFetch("/api/dashboard");
    const storage = dashboard.customer_storage || dashboard.expiring_storage || [];
    const expiringSoon = storage.filter(s => s.days_until_expiry <= 7 && s.days_until_expiry >= 0);

    if (expiringSoon.length === 0) return;

    const existing = document.querySelector(".expiring-notification");
    if (existing) existing.remove();

    const names = expiringSoon.slice(0, 5).map(s =>
      `<li>${escapeHtml(s.customer_name)} · ${escapeHtml(s.product_name)} (${s.days_until_expiry}天)</li>`
    ).join("");
    const more = expiringSoon.length > 5 ? `<li>... 还有 ${expiringSoon.length - 5} 位客户</li>` : "";

    const notif = document.createElement("div");
    notif.className = "expiring-notification";
    notif.innerHTML = `
      <button class="expiring-close" type="button" aria-label="关闭">&times;</button>
      <h4>${expiringSoon.length} 位客户存酒即将到期</h4>
      <ul>${names}${more}</ul>
      <div class="expiring-actions">
        <button class="button primary small" type="button" data-goto-storage>查看存酒</button>
        <button class="button secondary small" type="button" data-dismiss-expiring>我知道了</button>
      </div>`;

    document.body.appendChild(notif);

    notif.querySelector(".expiring-close")?.addEventListener("click", () => notif.remove());
    notif.querySelector("[data-dismiss-expiring]")?.addEventListener("click", () => notif.remove());
    notif.querySelector("[data-goto-storage]")?.addEventListener("click", () => {
      notif.remove();
      document.querySelector(".nav-link:nth-child(3)")?.click();
    });

    setTimeout(() => { if (notif.parentNode) notif.remove(); }, 15000);
  } catch (_) { /* ignore */ }
}

/* ───────── Dashboard activity timeline ───────── */

async function loadActivityTimeline() {
  const panel = document.querySelector("[data-activity-timeline]");
  if (!panel) return;

  try {
    const data = await apiFetch("/api/operation-logs");
    const logs = (data.items || []).slice(0, 12);

    if (logs.length === 0) {
      panel.innerHTML = '<p style="color:var(--ink-muted);font-size:13px;margin:0;">暂无操作记录。</p>';
      return;
    }

    const actionLabels = {
      create: "新增",
      adjust: "调整",
      pickup: "取酒",
      batch_purchase: "批量采购",
      import: "导入",
      notify: "通知",
      approve: "审批",
    };

    panel.innerHTML = logs.map(l => {
      const time = (l.created_at || "").replace("T", " ").slice(5, 16);
      const action = actionLabels[l.action] || l.action;
      return `
        <div class="timeline-item">
          <span class="timeline-dot"></span>
          <span class="timeline-time">${escapeHtml(time)}</span>
          <span class="timeline-text">${escapeHtml(action)} · ${escapeHtml(l.details || l.target_type || "")}</span>
        </div>`;
    }).join("");
  } catch (_) {
    panel.innerHTML = '<p style="color:var(--ink-muted);font-size:13px;margin:0;">加载失败。</p>';
  }
}

/* ───────── Report comparison ───────── */

async function loadReportComparison() {
  const container = document.querySelector("[data-report-compare]");
  if (!container) return;

  try {
    const data = await apiFetch("/api/agent-reports");
    const reports = (data.items || []).slice(0, 4);

    if (reports.length < 1) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    const latest = reports[0];
    const metrics = latest.metrics || {};

    const cards = [
      { label: "采购金额", value: `¥${(metrics.purchase_amount || 0)}`, key: "purchase_amount" },
      { label: "入库数量", value: metrics.inbound_quantity || 0, key: "inbound_quantity" },
      { label: "出库数量", value: metrics.outbound_quantity || 0, key: "outbound_quantity" },
      { label: "损耗数量", value: metrics.loss_quantity || 0, key: "loss_quantity" },
      { label: "快缺货 SKU", value: metrics.low_stock_count || 0, key: "low_stock_count" },
      { label: "积压 SKU", value: metrics.overstock_count || 0, key: "overstock_count" },
    ];

    container.innerHTML = cards.map(c => {
      let changeHtml = "";
      if (reports.length >= 2) {
        const prev = reports[1].metrics || {};
        const prevVal = prev[c.key] || 0;
        const curVal = c.value;
        if (prevVal !== 0 && typeof curVal === "number") {
          const pct = ((curVal - prevVal) / Math.abs(prevVal) * 100).toFixed(0);
          const cls = pct > 0 ? "up" : "down";
          changeHtml = `<span class="compare-change ${cls}">${pct > 0 ? "+" : ""}${pct}%</span>`;
        }
      }
      return `
        <div class="report-compare-card">
          <span class="compare-value">${escapeHtml(String(c.value))}</span>
          <span class="compare-label">${c.label}</span>
          ${changeHtml}
        </div>`;
    }).join("");
  } catch (_) {
    container.hidden = true;
  }
}

/* ───────── Desktop notifications ───────── */

let notificationsEnabled = localStorage.getItem("bar-notifications") !== "off";

function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    notificationsEnabled = true;
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission().then(perm => {
      notificationsEnabled = perm === "granted";
      localStorage.setItem("bar-notifications", notificationsEnabled ? "on" : "off");
    });
  }
}

function sendNotification(title, body, tag) {
  if (!notificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag, icon: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#0066cc"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="18">🍸</text></svg>') });
  } catch (_) { /* ignore */ }
}

function checkAndNotifyLowStock(dashboard) {
  const metrics = dashboard.metrics || {};
  const lowStock = metrics.low_stock_count || 0;
  if (lowStock > 0) {
    sendNotification("库存不足提醒", `${lowStock} 款酒水库存低于安全值，建议尽快补货。`, "low-stock");
  }
}

function checkAndNotifyExpiring(storage) {
  const expiringSoon = storage.filter(s => s.days_until_expiry <= 7 && s.days_until_expiry >= 0);
  if (expiringSoon.length > 0) {
    sendNotification("存酒到期提醒", `${expiringSoon.length} 位客户存酒将在 7 天内到期。`, "expiring-storage");
  }
}

function toggleNotifications(enable) {
  notificationsEnabled = enable;
  localStorage.setItem("bar-notifications", enable ? "on" : "off");
  if (enable && ("Notification" in window) && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

/* ───────── Dashboard panel customization ───────── */

const DASHBOARD_LAYOUT_KEY = "bar-dashboard-layout";

function getDashboardLayout() {
  try {
    const saved = localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveDashboardLayout(layout) {
  localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(layout));
}

function initDashboardCustomization() {
  const heroCopy = document.querySelector(".hero-copy");
  if (!heroCopy) return;

  // Wrap each dashboard-grid in a sortable container
  const grids = heroCopy.querySelectorAll(".dashboard-grid");
  const layout = getDashboardLayout();

  grids.forEach((grid, gridIdx) => {
    grid.setAttribute("data-dashboard-grid", gridIdx);
    const panels = grid.querySelectorAll(".dashboard-panel");

    panels.forEach((panel, panelIdx) => {
      const id = `panel-${gridIdx}-${panelIdx}`;
      panel.setAttribute("data-panel-id", id);
      panel.style.position = "relative";

      // Visibility toggle button
      const toggle = document.createElement("button");
      toggle.className = "panel-toggle";
      toggle.type = "button";
      toggle.title = "隐藏/显示此面板";
      toggle.innerHTML = "&#9881;";
      toggle.style.cssText = "position:absolute;top:8px;right:8px;background:none;border:0;color:var(--ink-muted);cursor:pointer;font-size:14px;padding:4px;opacity:0;transition:opacity 0.2s;";
      panel.appendChild(toggle);

      panel.addEventListener("mouseenter", () => { toggle.style.opacity = "1"; });
      panel.addEventListener("mouseleave", () => { toggle.style.opacity = "0"; });

      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const content = panel.querySelector("h3")?.nextElementSibling;
        const isHidden = content?.style.display === "none";
        if (content) {
          content.style.display = isHidden ? "" : "none";
          toggle.style.opacity = isHidden ? "" : "1";
        }
        const panelId = panel.getAttribute("data-panel-id");
        const entry = layout.find(l => l.id === panelId);
        if (entry) entry.hidden = !isHidden;
        else layout.push({ id: panelId, hidden: !isHidden });
        saveDashboardLayout(layout);
      });

      // Restore visibility
      const saved = layout.find(l => l.id === id);
      if (saved && saved.hidden) {
        const content = panel.querySelector("h3")?.nextElementSibling;
        if (content) content.style.display = "none";
      }
    });
  });

  // Add notification settings toggle to shortcut panel
  const shortcutPanel = heroCopy.querySelector("[data-activity-timeline]")?.closest(".dashboard-grid")?.querySelector(".dashboard-panel:last-child");
  if (shortcutPanel) {
    const notifRow = document.createElement("div");
    notifRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--hairline);font-size:13px;";
    notifRow.innerHTML = `
      <span style="color:var(--ink-muted);">桌面通知</span>
      <button class="button secondary small" type="button" data-toggle-notifications style="min-height:28px;padding:4px 12px;font-size:12px;">
        ${notificationsEnabled ? "已开启" : "已关闭"}
      </button>`;
    shortcutPanel.appendChild(notifRow);

    shortcutPanel.querySelector("[data-toggle-notifications]")?.addEventListener("click", () => {
      const newState = !notificationsEnabled;
      toggleNotifications(newState);
      const btn = shortcutPanel.querySelector("[data-toggle-notifications]");
      if (btn) btn.textContent = newState ? "已开启" : "已关闭";
    });
  }
}

/* ───────── Auto-replenishment rules engine ───────── */

const RULES_STORAGE_KEY = "bar-replenishment-rules";

const DEFAULT_RULES = [
  { id: 1, name: "低库存自动补货", enabled: true, condition: "stock_below_safety", threshold: 0, action: "suggest_replenishment", priority: "high" },
  { id: 2, name: "库存积压促销提醒", enabled: true, condition: "overstock_ratio", threshold: 3, action: "suggest_promotion", priority: "medium" },
  { id: 3, name: "存酒到期提醒", enabled: true, condition: "expiring_storage", threshold: 7, action: "notify_expiring", priority: "high" },
  { id: 4, name: "供应商价格波动告警", enabled: false, condition: "price_volatility", threshold: 20, action: "alert_supplier", priority: "low" },
];

function getRules() {
  try {
    const saved = localStorage.getItem(RULES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_RULES;
  } catch { return DEFAULT_RULES; }
}

function saveRules(rules) {
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
}

function evaluateRules(dashboard) {
  const rules = getRules().filter(r => r.enabled);
  const alerts = [];
  const metrics = dashboard.metrics || {};
  const products = dashboard.products || [];
  const storage = dashboard.customer_storage || dashboard.expiring_storage || [];

  for (const rule of rules) {
    switch (rule.condition) {
      case "stock_below_safety": {
        const lowCount = metrics.low_stock_count || 0;
        if (lowCount > rule.threshold) {
          alerts.push({ ruleId: rule.id, ruleName: rule.name, message: `${lowCount} 款酒水库存不足，已触发自动补货建议`, priority: rule.priority, action: "open_purchase" });
        }
        break;
      }
      case "overstock_ratio": {
        const overCount = metrics.overstock_count || 0;
        if (overCount > 0) {
          alerts.push({ ruleId: rule.id, ruleName: rule.name, message: `${overCount} 款酒水库存积压，建议安排促销活动`, priority: rule.priority, action: "open_activities" });
        }
        break;
      }
      case "expiring_storage": {
        const expiring = storage.filter(s => s.days_until_expiry <= rule.threshold && s.days_until_expiry >= 0).length;
        if (expiring > 0) {
          alerts.push({ ruleId: rule.id, ruleName: rule.name, message: `${expiring} 位客户存酒在 ${rule.threshold} 天内到期`, priority: rule.priority, action: "goto_storage" });
        }
        break;
      }
      case "price_volatility": {
        break; // Needs supplier quote history
      }
    }
  }
  return alerts;
}

function openRulesModal() {
  const modal = document.querySelector("[data-rules-modal]");
  if (!modal) return;
  modal.hidden = false;
  renderRulesList();
}

function closeRulesModal() {
  document.querySelector("[data-rules-modal]").hidden = true;
}

function renderRulesList() {
  const list = document.querySelector("[data-rules-list]");
  if (!list) return;
  const rules = getRules();

  const conditionLabels = {
    stock_below_safety: "库存低于安全库存",
    overstock_ratio: "库存超过安全库存 N 倍",
    expiring_storage: "存酒 N 天内到期",
    price_volatility: "供应商价格波动超过 N%",
  };

  list.innerHTML = rules.map(r => `
    <div class="backup-item" data-rule-id="${r.id}">
      <div class="backup-item-info">
        <strong>${escapeHtml(r.name)}</strong>
        <span>条件：${conditionLabels[r.condition] || r.condition}${r.condition !== "stock_below_safety" ? ` · 阈值：${r.threshold}` : ""} · 优先级：${r.priority === "high" ? "高" : r.priority === "medium" ? "中" : "低"}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;white-space:nowrap;">
          <input type="checkbox" data-rule-enabled="${r.id}" ${r.enabled ? "checked" : ""}> 启用
        </label>
        <button class="button danger small" type="button" data-delete-rule="${r.id}">删除</button>
      </div>
    </div>`).join("");
}

function saveRulesFromUI() {
  const list = document.querySelector("[data-rules-list]");
  if (!list) return;
  const rules = getRules();

  list.querySelectorAll("[data-rule-id]").forEach(el => {
    const id = parseInt(el.dataset.ruleId);
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    const cb = el.querySelector(`[data-rule-enabled="${id}"]`);
    if (cb) rule.enabled = cb.checked;
  });

  saveRules(rules);
  document.querySelector("[data-rules-message]").textContent = "规则已保存。";
  document.querySelector("[data-rules-message]").className = "form-message success";
  setTimeout(() => {
    const msg = document.querySelector("[data-rules-message]");
    if (msg) msg.textContent = "";
  }, 2000);
}

function addRule() {
  const rules = getRules();
  const newId = Math.max(0, ...rules.map(r => r.id)) + 1;
  rules.push({
    id: newId,
    name: "新规则",
    enabled: true,
    condition: "stock_below_safety",
    threshold: 0,
    action: "suggest_replenishment",
    priority: "medium",
  });
  saveRules(rules);
  renderRulesList();
}

function bindRulesEvents() {
  document.querySelector("[data-save-rules]")?.addEventListener("click", saveRulesFromUI);
  document.querySelector("[data-add-rule]")?.addEventListener("click", addRule);

  document.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-delete-rule]");
    if (delBtn) {
      const id = parseInt(delBtn.dataset.deleteRule);
      const rules = getRules().filter(r => r.id !== id);
      saveRules(rules);
      renderRulesList();
    }
  });
}

/* ───────── Scheduled auto-backup ───────── */

const BACKUP_SCHEDULE_KEY = "bar-backup-schedule";
const BACKUP_LAST_RUN_KEY = "bar-backup-last-run";

function getBackupSchedule() {
  try {
    const saved = localStorage.getItem(BACKUP_SCHEDULE_KEY);
    return saved ? JSON.parse(saved) : { enabled: false, interval: "daily", time: "02:00", retention: 7 };
  } catch { return { enabled: false, interval: "daily", time: "02:00", retention: 7 }; }
}

function saveBackupSchedule(schedule) {
  localStorage.setItem(BACKUP_SCHEDULE_KEY, JSON.stringify(schedule));
}

async function checkAndRunScheduledBackup() {
  const schedule = getBackupSchedule();
  if (!schedule.enabled) return;

  const lastRun = localStorage.getItem(BACKUP_LAST_RUN_KEY) || "";
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const timeKey = now.toTimeString().slice(0, 5);

  // Already ran today
  if (lastRun === dateKey) return;

  // Check if it's time
  const [schedH, schedM] = (schedule.time || "02:00").split(":").map(Number);
  const [nowH, nowM] = timeKey.split(":").map(Number);

  const schedMin = schedH * 60 + schedM;
  const nowMin = nowH * 60 + nowM;

  // Run if within the window (±2 min) and not yet run today
  if (Math.abs(nowMin - schedMin) <= 2) {
    try {
      await apiFetch("/api/backup", { method: "POST" });
      localStorage.setItem(BACKUP_LAST_RUN_KEY, dateKey);
      console.log(`[Auto-backup] 完成: ${dateKey} ${timeKey}`);
    } catch (e) {
      console.error("[Auto-backup] 失败:", e.message);
    }
  }
}

let backupCheckTimer = null;

function startBackupScheduler() {
  stopBackupScheduler();
  backupCheckTimer = setInterval(checkAndRunScheduledBackup, 60000);
  checkAndRunScheduledBackup(); // Check on start
}

function stopBackupScheduler() {
  if (backupCheckTimer) {
    clearInterval(backupCheckTimer);
    backupCheckTimer = null;
  }
}

/* ───────── Role-based permissions ───────── */

const ROLE_KEY = "bar-user-role";
const ROLE_PASSWORD_KEY = "bar-admin-password";

function getCurrentRole() {
  return localStorage.getItem(ROLE_KEY) || "admin"; // Default admin for existing users
}

function setCurrentRole(role) {
  localStorage.setItem(ROLE_KEY, role);
}

function setCurrentUserName(name) {
  localStorage.setItem("bar-user-name", name || (getCurrentRole() === "admin" ? "管理员" : "店员"));
}

async function loginAsRole(role, password) {
  const payload = await apiFetch("/api/auth/login", {
    method: "POST",
    body: { username: role, password },
    retries: 0,
  });
  setCurrentRole(payload.user.role);
  setCurrentUserName(payload.user.display_name);
  return payload.user;
}

function isAdmin() {
  return getCurrentRole() === "admin";
}

function restrictByRole() {
  const role = getCurrentRole();
  const restrictedActions = [
    "data-open-purchase", "data-open-batch-purchase", "data-open-import",
    "data-open-backup", "data-open-approval", "data-open-audit",
    "data-open-inventory-adjustment", "data-open-supplier-quotes",
    "data-open-sale", "data-open-batch-outbound", "data-open-batch-adjust",
    "data-export-products", "data-export-suppliers", "data-export-sales-records",
    "data-export-purchase-orders", "data-export-inventory-records",
    "data-export-customer-storage", "data-export-pdf", "data-open-logs",
    "data-open-rules", "data-open-report", "data-open-setup",
  ];

  if (role === "staff") {
    restrictedActions.forEach(attr => {
      document.querySelectorAll(`[${attr}]`).forEach(el => {
        el.style.display = "none";
      });
    });
    // Staff can only see: POS, inventory view, storage view, agent
    // Hide procurement/analytics/charts/profit nav
    const allowedNav = ["采购", "库存", "存酒", "AI Agent"];
    document.querySelectorAll(".nav-link").forEach(link => {
      if (!allowedNav.includes(link.textContent.trim())) {
        link.style.display = "none";
      }
    });
  }

  // Show role badge
  const navUtility = document.querySelector(".nav-utility");
  if (navUtility) {
    navUtility.textContent = role === "admin" ? "管理员" : "店员";
    navUtility.style.cursor = "pointer";
    navUtility.title = "点击切换角色";
    navUtility.addEventListener("click", openRoleSwitchModal);
  }
}

function openRoleSwitchModal() {
  const existing = document.querySelector("[data-role-modal]");
  if (existing) { existing.hidden = false; return; }

  const isCurrentlyAdmin = isAdmin();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.dataset.roleModal = "";
  backdrop.innerHTML = `
    <section class="purchase-modal" role="dialog" style="max-width:400px;">
      <div class="modal-heading">
        <div>
          <p class="eyebrow blue">Role Switch</p>
          <h2>切换角色</h2>
        </div>
        <button class="icon-button" type="button" data-close-role aria-label="关闭">&times;</button>
      </div>
      <div style="display:grid;gap:14px;">
        <p class="form-message">当前角色：<strong>${isCurrentlyAdmin ? "管理员" : "店员"}</strong></p>
        <button class="button ${isCurrentlyAdmin ? 'secondary' : 'primary'}" type="button" data-switch-to="staff">
          ${isCurrentlyAdmin ? "切换到店员模式（需密码）" : "✓ 店员模式"}
        </button>
        <button class="button ${isCurrentlyAdmin ? 'primary' : 'secondary'}" type="button" data-switch-to="admin">
          ${isCurrentlyAdmin ? "✓ 管理员模式" : "切换到管理员（需密码）"}
        </button>
        <div data-login-row hidden style="display:grid;gap:6px;">
          <label style="font-size:13px;color:var(--ink-muted);" data-login-label>密码</label>
          <input type="password" data-login-password-input style="border:1px solid var(--hairline);border-radius:var(--radius-sm);font:inherit;min-height:40px;padding:8px 10px;">
          <button class="button primary small" type="button" data-confirm-login>确认</button>
        </div>
        <p class="form-message" data-role-message></p>
      </div>
    </section>`;

  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  backdrop.querySelector("[data-close-role]")?.addEventListener("click", () => backdrop.remove());

  let pendingRole = null;
  const showLogin = (role) => {
    pendingRole = role;
    const row = backdrop.querySelector("[data-login-row]");
    const label = backdrop.querySelector("[data-login-label]");
    const input = backdrop.querySelector("[data-login-password-input]");
    label.textContent = role === "admin" ? "管理员密码（默认: admin123）" : "店员密码（默认: staff123）";
    row.hidden = false;
    input.value = "";
    input.focus();
  };

  backdrop.querySelector("[data-switch-to='staff']")?.addEventListener("click", () => {
    if (!isCurrentlyAdmin) return;
    showLogin("staff");
  });

  backdrop.querySelector("[data-switch-to='admin']")?.addEventListener("click", () => {
    if (isCurrentlyAdmin) return;
    showLogin("admin");
  });

  backdrop.querySelector("[data-confirm-login]")?.addEventListener("click", async () => {
    const pwd = backdrop.querySelector("[data-login-password-input]")?.value || "";
    if (!pendingRole) return;
    try {
      await loginAsRole(pendingRole, pwd);
      location.reload();
    } catch (error) {
      const msg = backdrop.querySelector("[data-role-message]");
      msg.textContent = `登录失败：${error.message}`;
      msg.className = "form-message error";
    }
  });
}

/* ───────── Delete resource helper ───────── */

async function deleteResource(path, successMessage, messageEl, onSuccess) {
  if (messageEl) {
    messageEl.textContent = "正在删除...";
    messageEl.className = "form-message";
  }

  try {
    await apiFetch(path, { method: "DELETE" });
    if (messageEl) {
      messageEl.textContent = successMessage;
      messageEl.className = "form-message success";
    }
    if (onSuccess) await onSuccess();
  } catch (error) {
    if (messageEl) {
      messageEl.textContent = `删除失败：${error.message}`;
      messageEl.className = "form-message error";
    }
  }
}
