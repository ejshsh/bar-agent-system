const API_BASE_URL = "http://127.0.0.1:8000";

const navLinks = document.querySelectorAll(".nav-link");
const agentQuestions = document.querySelectorAll(".agent-question");
const agentTitle = document.querySelector("#agent-title");
const agentBody = document.querySelector("#agent-body");
const agentAction = document.querySelector("#agent-action");
const activitySummary = document.querySelector("#activity-summary");
const apiStatus = document.querySelector("[data-api-status]");
const inventoryAlerts = document.querySelector("[data-inventory-alerts]");
const storageList = document.querySelector("[data-storage-list]");
const activityList = document.querySelector("[data-activity-list]");
const supplierTable = document.querySelector("[data-supplier-table]");

let agentAnswers = {
  replenishment: {
    title: "建议优先补货 6 个 SKU",
    body: "威士忌和啤酒类消耗速度高于安全库存模型预期，其中百龄坛 12 年、科罗娜、金汤力基酒最需要优先处理。",
    action: "生成采购单草稿"
  },
  storage: {
    title: "23 位客户存酒进入提醒窗口",
    body: "其中 8 位客户在 7 天内到期，皇家礼炮、香槟套餐和麦卡伦 12 年适合搭配会员夜做召回。",
    action: "生成客户召回名单"
  },
  supplier: {
    title: "港岛酒业价格最稳定",
    body: "近 60 天价格波动率为 4.8%，平均交付 2.1 天，适合作为威士忌和香槟品类的优先供应商。",
    action: "查看供应商对比"
  },
  promotion: {
    title: "4 类酒水适合本周促销",
    body: "低周转预调酒、临期精酿、高毛利威士忌和龙舌兰新品都有明确活动机会，可以分成清库存和拉新两类策略。",
    action: "生成活动建议"
  }
};

let activitySummaries = {
  clearance: "当前方案建议将荔枝味预调酒与热销啤酒组合，控制折扣后毛利率不低于 42%，目标是在 14 天内消化 40% 积压库存。",
  recall: "当前方案建议邀请 23 位临期存酒客户参加会员夜，优先触达剩余酒量较多且 45 天内未到店客户。",
  bundle: "当前方案建议用高毛利威士忌搭配小食和调酒券，保持桌均消费提升，同时避免直接打折损伤价格感。",
  new: "当前方案建议围绕龙舌兰新品设计试饮主题夜，搭配限时首杯价和二次到店券，积累新品销售数据。"
};

function bindNavigation() {
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

function bindAgentQuestions() {
  document.querySelectorAll(".agent-question").forEach((question) => {
    question.addEventListener("click", () => {
      const key = question.dataset.question;
      const answer = agentAnswers[key];

      if (!answer) {
        return;
      }

      document.querySelectorAll(".agent-question").forEach((item) => item.classList.remove("active"));
      question.classList.add("active");
      renderAgentAnswer(answer);
    });
  });
}

function bindActivityCards() {
  document.querySelectorAll(".activity-card").forEach((card) => {
    card.addEventListener("click", () => {
      const key = card.dataset.activity;
      const summary = activitySummaries[key];

      if (!summary) {
        return;
      }

      document.querySelectorAll(".activity-card").forEach((item) => item.classList.remove("selected"));
      card.classList.add("selected");
      activitySummary.textContent = summary;
    });
  });
}

function renderAgentAnswer(answer) {
  agentTitle.textContent = answer.title;
  agentBody.textContent = answer.body;
  agentAction.textContent = answer.action;
}

function renderDashboard(dashboard) {
  renderMetrics(dashboard.metrics);
  renderInventory(dashboard);
  renderStorage(dashboard.expiring_storage || []);
  renderSuppliers(dashboard.suppliers || []);
  renderAgentSuggestions(dashboard.agent_suggestions || []);
  renderActivities(dashboard.activity_suggestions || []);
}

function renderMetrics(metrics) {
  Object.entries(metrics || {}).forEach(([key, value]) => {
    const node = document.querySelector(`[data-metric="${key}"]`);
    if (node) {
      node.textContent = value;
    }
  });
}

function renderInventory(dashboard) {
  const lowStock = dashboard.inventory_alerts?.low_stock || [];
  const overstock = dashboard.inventory_alerts?.overstock || [];
  const replenishment = dashboard.replenishment || [];
  const cards = [
    ...lowStock.slice(0, 2).map((item) => ({
      kicker: "快缺货",
      title: item.name,
      body: `当前库存 ${formatNumber(item.current_stock)} ${item.unit || ""}，安全库存 ${formatNumber(item.safety_stock)}，建议优先补货。`,
      link: "生成采购建议"
    })),
    ...overstock.slice(0, 1).map((item) => ({
      kicker: "库存积压",
      title: item.name,
      body: `当前库存 ${formatNumber(item.current_stock)} ${item.unit || ""}，高于安全库存，适合做组合活动。`,
      link: "查看活动方案"
    }))
  ];

  if (cards.length === 0 && replenishment.length > 0) {
    cards.push({
      kicker: "补货建议",
      title: replenishment[0].product_name,
      body: `建议采购 ${replenishment[0].suggested_quantity}，原因：${replenishment[0].reason}`,
      link: "生成采购单"
    });
  }

  inventoryAlerts.innerHTML = cards.map(renderUtilityCard).join("");
}

function renderStorage(records) {
  storageList.innerHTML = records.map((item, index) => {
    const dotClass = index === 0 ? "urgent" : "";
    return `
      <article class="storage-item">
        <span class="status-dot ${dotClass}"></span>
        <div>
          <h3>${escapeHtml(item.customer_name)} · ${escapeHtml(item.product_name)}</h3>
          <p>剩余 ${formatNumber(item.remaining_quantity)}，${item.days_until_expiry} 天后到期，建议进入客户召回池。</p>
        </div>
        <button class="button secondary small" type="button">通知</button>
      </article>
    `;
  }).join("");
}

function renderSuppliers(suppliers) {
  const rows = suppliers.map((item, index) => `
    <div class="supplier-row" role="row">
      <span>${escapeHtml(item.name)}</span>
      <span>${formatNumber(item.price_stability_score)}%</span>
      <span>${formatNumber(item.average_delivery_days)} 天</span>
      <span class="${index === 0 ? "blue-text" : ""}">${index === 0 ? "优先采购" : "备选"}</span>
    </div>
  `).join("");

  supplierTable.innerHTML = `
    <div class="supplier-row header" role="row">
      <span>供应商</span>
      <span>稳定性</span>
      <span>平均交付</span>
      <span>建议</span>
    </div>
    ${rows}
  `;
}

function renderAgentSuggestions(suggestions) {
  suggestions.forEach((item) => {
    if (!item.question_key) {
      return;
    }
    agentAnswers[item.question_key] = {
      title: item.title,
      body: item.summary,
      action: item.action
    };
  });

  const activeQuestion = document.querySelector(".agent-question.active");
  const activeKey = activeQuestion?.dataset.question || "replenishment";
  if (agentAnswers[activeKey]) {
    renderAgentAnswer(agentAnswers[activeKey]);
  }
}

function renderActivities(suggestions) {
  if (suggestions.length === 0) {
    return;
  }

  activitySummaries = suggestions.reduce((accumulator, item) => {
    accumulator[item.activity_key] = item.summary;
    return accumulator;
  }, {});

  activityList.innerHTML = suggestions.map((item, index) => `
    <button class="activity-card ${index === 0 ? "selected" : ""}" type="button" data-activity="${escapeHtml(item.activity_key)}">
      <span>${escapeHtml(item.title)}</span>
      <strong>${escapeHtml(item.summary).slice(0, 18)}</strong>
    </button>
  `).join("");
  activitySummary.textContent = suggestions[0].summary;
  bindActivityCards();
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
  apiStatus.textContent = text;
  apiStatus.classList.toggle("live", isLive);
}

async function loadDashboard() {
  setApiStatus("连接数据中", false);

  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard`);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    const dashboard = await response.json();
    renderDashboard(dashboard);
    setApiStatus("实时数据", true);
  } catch (error) {
    setApiStatus("演示数据", false);
  }
}

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

bindNavigation();
bindAgentQuestions();
bindActivityCards();
loadDashboard();
