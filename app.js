/* ───────── Global state ───────── */

const API_BASE_URL = "http://127.0.0.1:8000";

const navLinks = document.querySelectorAll(".nav-link");
const agentQuestions = document.querySelectorAll(".agent-question");
const agentTitle = document.querySelector("#agent-title");
const agentBody = document.querySelector("#agent-body");
const agentAction = document.querySelector("#agent-action");
const activitySummary = document.querySelector("#activity-summary");
const apiStatusBadges = document.querySelectorAll("[data-api-status]");
const lastRefreshEl = document.querySelector("[data-last-refresh]");
const inventoryAlerts = document.querySelector("[data-inventory-alerts]");
const storageList = document.querySelector("[data-storage-list]");
const activityList = document.querySelector("[data-activity-list]");
const supplierTable = document.querySelector("[data-supplier-table]");
const liveSummary = document.querySelector("[data-live-summary]");
const purchaseModal = document.querySelector("[data-purchase-modal]");
const openPurchaseButton = document.querySelector("[data-open-purchase]");
const closePurchaseButtons = document.querySelectorAll("[data-close-purchase]");
const purchaseForm = document.querySelector("[data-purchase-form]");
const purchaseMessage = document.querySelector("[data-purchase-message]");
const productSelect = document.querySelector("[data-product-select]");
const supplierSelect = document.querySelector("[data-supplier-select]");
const orderDateInput = document.querySelector("[data-order-date]");
const productExistingPanel = document.querySelector("[data-product-existing]");
const productNewPanel = document.querySelector("[data-product-new]");
const supplierExistingPanel = document.querySelector("[data-supplier-existing]");
const supplierNewPanel = document.querySelector("[data-supplier-new]");
const deleteProductButton = document.querySelector("[data-delete-product]");
const deleteSupplierButton = document.querySelector("[data-delete-supplier]");
const storageModal = document.querySelector("[data-storage-modal]");
const openStorageButton = document.querySelector("[data-open-storage]");
const closeStorageButtons = document.querySelectorAll("[data-close-storage]");
const storageForm = document.querySelector("[data-storage-form]");
const storageTitle = document.querySelector("[data-storage-title]");
const storageMessage = document.querySelector("[data-storage-message]");
const storageIdInput = document.querySelector("[data-storage-id]");
const saleModal = document.querySelector("[data-sale-modal]");
const openSaleButton = document.querySelector("[data-open-sale]");
const closeSaleButtons = document.querySelectorAll("[data-close-sale]");
const saleForm = document.querySelector("[data-sale-form]");
const saleProductSelect = document.querySelector("[data-sale-product-select]");
const saleDateInput = document.querySelector("[data-sale-date]");
const saleMessage = document.querySelector("[data-sale-message]");
const pickupModal = document.querySelector("[data-pickup-modal]");
const closePickupButtons = document.querySelectorAll("[data-close-pickup]");
const pickupForm = document.querySelector("[data-pickup-form]");
const pickupStorageIdInput = document.querySelector("[data-pickup-storage-id]");
const pickupSummary = document.querySelector("[data-pickup-summary]");
const pickupDateInput = document.querySelector("[data-pickup-date]");
const pickupMessage = document.querySelector("[data-pickup-message]");
const inventoryAdjustmentModal = document.querySelector("[data-inventory-adjustment-modal]");
const openInventoryAdjustmentButton = document.querySelector("[data-open-inventory-adjustment]");
const closeInventoryAdjustmentButtons = document.querySelectorAll("[data-close-inventory-adjustment]");
const inventoryAdjustmentForm = document.querySelector("[data-inventory-adjustment-form]");
const inventoryProductSelect = document.querySelector("[data-inventory-product-select]");
const inventoryAdjustmentDateInput = document.querySelector("[data-inventory-adjustment-date]");
const inventoryAdjustmentMessage = document.querySelector("[data-inventory-adjustment-message]");
const countPanel = document.querySelector("[data-count-panel]");
const lossPanel = document.querySelector("[data-loss-panel]");
const supplierQuotesModal = document.querySelector("[data-supplier-quotes-modal]");
const openSupplierQuotesButton = document.querySelector("[data-open-supplier-quotes]");
const closeSupplierQuotesButtons = document.querySelectorAll("[data-close-supplier-quotes]");
const supplierQuotesForm = document.querySelector("[data-supplier-quotes-form]");
const quoteProductSelect = document.querySelector("[data-quote-product-select]");
const quoteSupplierSelect = document.querySelector("[data-quote-supplier-select]");
const quoteDateInput = document.querySelector("[data-quote-date]");
const supplierQuotesMessage = document.querySelector("[data-supplier-quotes-message]");
const quoteResults = document.querySelector("[data-quote-results]");
const refreshQuotesButton = document.querySelector("[data-refresh-quotes]");
const reportModal = document.querySelector("[data-report-modal]");
const openReportButton = document.querySelector("[data-open-report]");
const closeReportButtons = document.querySelectorAll("[data-close-report]");
const reportContent = document.querySelector("[data-report-content]");
const reportGenerateArea = document.querySelector("[data-report-tab-content='generate']");
const reportHistoryArea = document.querySelector("[data-report-tab-content='history']");
const reportTabs = document.querySelectorAll("[data-report-tab]");
const generateReportBtn = document.querySelector("[data-generate-report-btn]");
const saveReportButton = document.querySelector("[data-save-report]");
const reportSaveMessage = document.querySelector("[data-report-save-message]");
const reportActions = document.querySelector("[data-report-actions]");
const reportList = document.querySelector("[data-report-list]");
const staffWorkspaceModal = document.querySelector("[data-staff-workspace-modal]");
const openStaffWorkspaceButton = document.querySelector("[data-open-staff-workspace]");
const closeStaffWorkspaceButtons = document.querySelectorAll("[data-close-staff-workspace]");
const agentInput = document.querySelector("[data-agent-input]");
const agentAskButton = document.querySelector("[data-agent-ask]");
const agentResult = document.querySelector("[data-agent-result]");
const agentAnswerBody = document.querySelector("[data-agent-answer-body]");
const inventorySearch = document.querySelector("[data-inventory-search]");
const inventoryFilterStock = document.querySelector("[data-inventory-filter-stock]");
const inventoryFilterCategory = document.querySelector("[data-inventory-filter-category]");
const storageSearch = document.querySelector("[data-storage-search]");
const storageFilterExpiry = document.querySelector("[data-storage-filter-expiry]");

let currentStorageRecords = [];
let selectedStorageIds = new Set();
let currentDashboardData = null;
let dashboardTrendChart = null;
let currentReplenishmentData = [];
let currentReportData = null;
let inventoryFullData = { lowStock: [], overstock: [] };

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
  },
  cost: {
    title: "本月采购成本分析中",
    body: "系统正在计算本月采购数据，请生成经营报告或向 Agent 提问以获取详细信息。",
    action: "生成经营报告"
  },
  loss: {
    title: "损耗情况分析中",
    body: "系统正在统计本月损耗数据，生成报告后将展示详细分析。",
    action: "生成经营报告"
  }
};

let activitySummaries = {
  clearance: "当前方案建议将荔枝味预调酒与热销啤酒组合，控制折扣后毛利率不低于 42%，目标是在 14 天内消化 40% 积压库存。",
  recall: "当前方案建议邀请 23 位临期存酒客户参加会员夜，优先触达剩余酒量较多且 45 天内未到店客户。",
  bundle: "当前方案建议用高毛利威士忌搭配小食和调酒券，保持桌均消费提升，同时避免直接打折损伤价格感。",
  new: "当前方案建议围绕龙舌兰新品设计试饮主题夜，搭配限时首杯价和二次到店券，积累新品销售数据。"
};

/* ───────── Navigation ───────── */

function bindNavigation() {
  const allSections = ["hero", "procurement", "inventory", "storage", "suppliers", "agent", "activities", "charts", "profit"];
  const sectionMap = {
    "采购": "procurement",
    "库存": "inventory",
    "存酒": "storage",
    "供应商": "suppliers",
    "AI Agent": "agent",
    "活动建议": "activities",
    "数据看板": "charts",
    "利润": "profit",
  };

  allSections.forEach((id) => {
    if (id !== "hero") {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    }
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.forEach((item) => item.classList.remove("active"));
      link.classList.add("active");

      const sectionId = sectionMap[link.textContent.trim()];
      if (!sectionId) return;

      allSections.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      });

      const target = document.getElementById(sectionId);
      if (target) {
        target.hidden = false;
        target.scrollIntoView({ behavior: "smooth" });
      }

      if (sectionId === "charts") loadChartData();
      if (sectionId === "procurement") loadProcurementData();
      if (sectionId === "profit") loadProfitData();
    });
  });

  const brandLink = document.querySelector(".brand");
  if (brandLink) {
    brandLink.addEventListener("click", (event) => {
      event.preventDefault();
      navLinks.forEach((item) => item.classList.remove("active"));
      allSections.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = (id !== "hero");
      });
      const heroEl = document.getElementById("hero");
      if (heroEl) heroEl.scrollIntoView({ behavior: "smooth" });
      loadDashboard();
    });
  }
}

/* ───────── Init ───────── */

bindNavigation();
bindAgentQuestions();
bindActivityCards();
bindPurchaseForm();
bindReportsAndQA();
bindExtraActions();
bindImportEvents();
bindProcurementFilters();
bindDropdown();
bindFilters();
bindCustomerContactButtons();
bindNewFeatureButtons();
loadDashboard();
startDashboardAutoRefresh();
checkSetupNeeded();
initKeyboardShortcuts();
initDashboardCustomization();
requestNotificationPermission();

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

restrictByRole();
startBackupScheduler();
