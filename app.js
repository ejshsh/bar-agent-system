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

let currentStorageRecords = [];

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
  renderPurchaseOptions(dashboard.products || [], dashboard.suppliers || []);
  renderInventory(dashboard);
  renderStorage(dashboard.customer_storage || dashboard.expiring_storage || []);
  renderSuppliers(dashboard.suppliers || []);
  renderAgentSuggestions(dashboard.agent_suggestions || []);
  renderActivities(dashboard.activity_suggestions || []);
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
  currentStorageRecords = records;
  storageList.innerHTML = records.map((item, index) => {
    const dotClass = index === 0 ? "urgent" : "";
    return `
      <article class="storage-item">
        <span class="status-dot ${dotClass}"></span>
        <div>
          <h3>${escapeHtml(item.customer_name)} · ${escapeHtml(item.product_name)}</h3>
          <p>剩余 ${formatNumber(item.remaining_quantity)}，${item.days_until_expiry} 天后到期，建议进入客户召回池。</p>
        </div>
        <div class="row-actions">
          <button class="button secondary small" type="button" data-pickup-storage="${item.id}">取酒</button>
          <button class="button secondary small" type="button" data-edit-storage="${item.id}">编辑</button>
          <button class="button danger small" type="button" data-delete-storage="${item.id}">删除</button>
        </div>
      </article>
    `;
  }).join("");
  bindStorageRowActions();
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
  liveSummary.classList.toggle("live", isLive);
}

function setLiveSummaryForDashboard(dashboard) {
  const metrics = dashboard.metrics || {};
  liveSummary.textContent = `已连接后端实时数据：快缺货 ${metrics.low_stock_count ?? 0}，库存积压 ${metrics.overstock_count ?? 0}，临期存酒 ${metrics.expiring_storage_count ?? 0}，AI 建议 ${metrics.agent_suggestion_count ?? 0}。`;
}

function setFallbackSummary() {
  liveSummary.textContent = "后端未连接，当前显示演示数据。请确认 PowerShell 正在运行 python -m backend.server。";
}

function bindPurchaseForm() {
  orderDateInput.value = new Date().toISOString().slice(0, 10);
  document.querySelectorAll("[data-mode-toggle]").forEach((input) => {
    input.addEventListener("change", syncPurchaseModePanels);
  });
  syncPurchaseModePanels();

  openPurchaseButton.addEventListener("click", () => {
    purchaseModal.hidden = false;
    purchaseMessage.textContent = "提交后会写入采购单、生成库存流水，并刷新首页指标。";
    purchaseMessage.className = "form-message";
  });

  closePurchaseButtons.forEach((button) => {
    button.addEventListener("click", closePurchaseModal);
  });

  purchaseModal.addEventListener("click", (event) => {
    if (event.target === purchaseModal) {
      closePurchaseModal();
    }
  });

  purchaseForm.addEventListener("submit", submitPurchaseOrder);
  deleteProductButton.addEventListener("click", deleteSelectedProduct);
  deleteSupplierButton.addEventListener("click", deleteSelectedSupplier);
  openStorageButton.addEventListener("click", () => openStorageModal());
  closeStorageButtons.forEach((button) => button.addEventListener("click", closeStorageModal));
  storageModal.addEventListener("click", (event) => {
    if (event.target === storageModal) {
      closeStorageModal();
    }
  });
  storageForm.addEventListener("submit", submitCustomerStorage);
  saleDateInput.value = new Date().toISOString().slice(0, 10);
  openSaleButton.addEventListener("click", openSaleModal);
  closeSaleButtons.forEach((button) => button.addEventListener("click", closeSaleModal));
  saleModal.addEventListener("click", (event) => {
    if (event.target === saleModal) {
      closeSaleModal();
    }
  });
  saleForm.addEventListener("submit", submitSalesRecord);
  pickupDateInput.value = new Date().toISOString().slice(0, 10);
  closePickupButtons.forEach((button) => button.addEventListener("click", closePickupModal));
  pickupModal.addEventListener("click", (event) => {
    if (event.target === pickupModal) {
      closePickupModal();
    }
  });
  pickupForm.addEventListener("submit", submitStoragePickup);
  inventoryAdjustmentDateInput.value = new Date().toISOString().slice(0, 10);
  document.querySelectorAll("[data-inventory-mode-toggle]").forEach((input) => {
    input.addEventListener("change", syncInventoryAdjustmentMode);
  });
  syncInventoryAdjustmentMode();
  openInventoryAdjustmentButton.addEventListener("click", openInventoryAdjustmentModal);
  closeInventoryAdjustmentButtons.forEach((button) => button.addEventListener("click", closeInventoryAdjustmentModal));
  inventoryAdjustmentModal.addEventListener("click", (event) => {
    if (event.target === inventoryAdjustmentModal) {
      closeInventoryAdjustmentModal();
    }
  });
  inventoryAdjustmentForm.addEventListener("submit", submitInventoryAdjustment);
  quoteDateInput.value = new Date().toISOString().slice(0, 10);
  openSupplierQuotesButton.addEventListener("click", openSupplierQuotesModal);
  closeSupplierQuotesButtons.forEach((button) => button.addEventListener("click", closeSupplierQuotesModal));
  supplierQuotesModal.addEventListener("click", (event) => {
    if (event.target === supplierQuotesModal) {
      closeSupplierQuotesModal();
    }
  });
  quoteProductSelect.addEventListener("change", loadSupplierQuoteComparison);
  refreshQuotesButton.addEventListener("click", loadSupplierQuoteComparison);
  supplierQuotesForm.addEventListener("submit", submitSupplierQuote);
}

function closePurchaseModal() {
  purchaseModal.hidden = true;
}

async function submitPurchaseOrder(event) {
  event.preventDefault();
  const formData = new FormData(purchaseForm);
  purchaseMessage.textContent = "正在提交入库...";
  purchaseMessage.className = "form-message";

  try {
    const productId = await resolveProductId(formData);
    const supplierId = await resolveSupplierId(formData);
    const payload = {
      product_id: productId,
      supplier_id: supplierId,
      quantity: Number(formData.get("quantity")),
      unit_price: Number(formData.get("unit_price")),
      order_date: String(formData.get("order_date"))
    };
    const response = await fetch(`${API_BASE_URL}/api/purchase-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response.json();
      throw new Error(errorPayload.message || `API returned ${response.status}`);
    }

    const result = await response.json();
    purchaseMessage.textContent = `入库成功：库存增加 ${formatNumber(result.inventory_record.quantity_change)}，当前库存 ${formatNumber(result.inventory_record.quantity_after)}。`;
    purchaseMessage.className = "form-message success";
    await loadDashboard();
  } catch (error) {
    purchaseMessage.textContent = `入库失败：${error.message}`;
    purchaseMessage.className = "form-message error";
  }
}

function syncPurchaseModePanels() {
  const productMode = purchaseForm.elements.product_mode.value;
  const supplierMode = purchaseForm.elements.supplier_mode.value;
  productExistingPanel.hidden = productMode !== "existing";
  productNewPanel.hidden = productMode !== "new";
  supplierExistingPanel.hidden = supplierMode !== "existing";
  supplierNewPanel.hidden = supplierMode !== "new";
}

async function resolveProductId(formData) {
  if (formData.get("product_mode") === "existing") {
    return Number(formData.get("product_id"));
  }

  const product = await postJson("/api/products", {
    name: String(formData.get("new_product_name") || "").trim(),
    category: String(formData.get("new_product_category") || "未分类").trim(),
    safety_stock: Number(formData.get("new_product_safety_stock") || 0),
    current_stock: 0,
    unit: String(formData.get("new_product_unit") || "瓶").trim()
  });
  return Number(product.product.id);
}

async function resolveSupplierId(formData) {
  if (formData.get("supplier_mode") === "existing") {
    return Number(formData.get("supplier_id"));
  }

  const supplier = await postJson("/api/suppliers", {
    name: String(formData.get("new_supplier_name") || "").trim(),
    average_delivery_days: Number(formData.get("new_supplier_delivery_days") || 3),
    price_stability_score: 80
  });
  return Number(supplier.supplier.id);
}

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = await response.json();
    throw new Error(errorPayload.message || `API returned ${response.status}`);
  }

  return response.json();
}

async function deleteSelectedProduct() {
  const option = productSelect.selectedOptions[0];
  if (!option || !confirm(`确认删除酒水「${option.textContent}」吗？`)) {
    return;
  }

  await deleteResource(`/api/products/${productSelect.value}`, "酒水已删除。");
}

async function deleteSelectedSupplier() {
  const option = supplierSelect.selectedOptions[0];
  if (!option || !confirm(`确认删除供应商「${option.textContent}」吗？`)) {
    return;
  }

  await deleteResource(`/api/suppliers/${supplierSelect.value}`, "供应商已删除。");
}

async function deleteResource(path, successMessage) {
  purchaseMessage.textContent = "正在删除...";
  purchaseMessage.className = "form-message";

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    purchaseMessage.textContent = successMessage;
    purchaseMessage.className = "form-message success";
    await loadDashboard();
  } catch (error) {
    purchaseMessage.textContent = `删除失败：${error.message}`;
    purchaseMessage.className = "form-message error";
  }
}

function bindStorageRowActions() {
  document.querySelectorAll("[data-pickup-storage]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = currentStorageRecords.find((item) => String(item.id) === button.dataset.pickupStorage);
      if (record) {
        openPickupModal(record);
      }
    });
  });

  document.querySelectorAll("[data-edit-storage]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = currentStorageRecords.find((item) => String(item.id) === button.dataset.editStorage);
      if (record) {
        openStorageModal(record);
      }
    });
  });

  document.querySelectorAll("[data-delete-storage]").forEach((button) => {
    button.addEventListener("click", () => deleteCustomerStorage(button.dataset.deleteStorage));
  });
}

function openStorageModal(record) {
  storageModal.hidden = false;
  storageForm.reset();
  storageMessage.textContent = "保存后会刷新客户存酒提醒和 dashboard 指标。";
  storageMessage.className = "form-message";

  if (record) {
    storageTitle.textContent = "编辑客户存酒";
    storageIdInput.value = record.id;
    storageForm.elements.customer_name.value = record.customer_name;
    storageForm.elements.product_name.value = record.product_name;
    storageForm.elements.remaining_quantity.value = record.remaining_quantity;
    storageForm.elements.days_until_expiry.value = record.days_until_expiry;
  } else {
    storageTitle.textContent = "新增客户存酒";
    storageIdInput.value = "";
    storageForm.elements.remaining_quantity.value = "1";
    storageForm.elements.days_until_expiry.value = "30";
  }
}

function closeStorageModal() {
  storageModal.hidden = true;
}

async function submitCustomerStorage(event) {
  event.preventDefault();
  const formData = new FormData(storageForm);
  const storageId = String(formData.get("storage_id") || "");
  const payload = {
    customer_name: String(formData.get("customer_name") || "").trim(),
    product_name: String(formData.get("product_name") || "").trim(),
    remaining_quantity: Number(formData.get("remaining_quantity")),
    days_until_expiry: Number(formData.get("days_until_expiry"))
  };

  storageMessage.textContent = "正在保存客户存酒...";
  storageMessage.className = "form-message";

  try {
    const path = storageId ? `/api/customer-storage/${storageId}` : "/api/customer-storage";
    const method = storageId ? "PUT" : "POST";
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response.json();
      throw new Error(errorPayload.message || `API returned ${response.status}`);
    }

    storageMessage.textContent = storageId ? "客户存酒已更新。" : "客户存酒已新增。";
    storageMessage.className = "form-message success";
    await loadDashboard();
  } catch (error) {
    storageMessage.textContent = `保存失败：${error.message}`;
    storageMessage.className = "form-message error";
  }
}

async function deleteCustomerStorage(storageId) {
  const record = currentStorageRecords.find((item) => String(item.id) === String(storageId));
  const name = record ? `${record.customer_name} · ${record.product_name}` : "这条客户存酒";
  if (!confirm(`确认删除「${name}」吗？`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/customer-storage/${storageId}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    await loadDashboard();
  } catch (error) {
    alert(`删除失败：${error.message}`);
  }
}

function openPickupModal(record) {
  pickupModal.hidden = false;
  pickupForm.reset();
  pickupStorageIdInput.value = record.id;
  pickupDateInput.value = new Date().toISOString().slice(0, 10);
  pickupForm.elements.quantity.max = record.remaining_quantity;
  pickupForm.elements.quantity.value = Math.min(1, Number(record.remaining_quantity) || 1);
  pickupSummary.textContent = `${record.customer_name} · ${record.product_name}，当前剩余 ${formatNumber(record.remaining_quantity)}。`;
  pickupMessage.textContent = "提交后会扣减客户剩余存酒量，并刷新临期提醒。";
  pickupMessage.className = "form-message";
}

function closePickupModal() {
  pickupModal.hidden = true;
}

async function submitStoragePickup(event) {
  event.preventDefault();
  const formData = new FormData(pickupForm);
  const storageId = String(formData.get("storage_id") || "");
  const payload = {
    quantity: Number(formData.get("quantity")),
    picked_up_at: String(formData.get("picked_up_at"))
  };

  pickupMessage.textContent = "正在核销取酒...";
  pickupMessage.className = "form-message";

  try {
    const response = await fetch(`${API_BASE_URL}/api/customer-storage/${storageId}/pickup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response.json();
      throw new Error(errorPayload.message || `API returned ${response.status}`);
    }

    const result = await response.json();
    pickupMessage.textContent = `取酒成功：剩余 ${formatNumber(result.customer_storage.remaining_quantity)}。`;
    pickupMessage.className = "form-message success";
    await loadDashboard();
  } catch (error) {
    pickupMessage.textContent = `取酒失败：${error.message}`;
    pickupMessage.className = "form-message error";
  }
}

function openSaleModal() {
  saleModal.hidden = false;
  saleMessage.textContent = "提交后会写入销售消耗、生成库存流水，并刷新首页指标。";
  saleMessage.className = "form-message";
}

function closeSaleModal() {
  saleModal.hidden = true;
}

async function submitSalesRecord(event) {
  event.preventDefault();
  const formData = new FormData(saleForm);
  const payload = {
    product_id: Number(formData.get("product_id")),
    quantity: Number(formData.get("quantity")),
    sale_date: String(formData.get("sale_date"))
  };

  saleMessage.textContent = "正在提交出库...";
  saleMessage.className = "form-message";

  try {
    const response = await fetch(`${API_BASE_URL}/api/sales-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response.json();
      throw new Error(errorPayload.message || `API returned ${response.status}`);
    }

    const result = await response.json();
    saleMessage.textContent = `出库成功：库存减少 ${formatNumber(Math.abs(result.inventory_record.quantity_change))}，当前库存 ${formatNumber(result.inventory_record.quantity_after)}。`;
    saleMessage.className = "form-message success";
    await loadDashboard();
  } catch (error) {
    saleMessage.textContent = `出库失败：${error.message}`;
    saleMessage.className = "form-message error";
  }
}

function openInventoryAdjustmentModal() {
  inventoryAdjustmentModal.hidden = false;
  inventoryAdjustmentDateInput.value = new Date().toISOString().slice(0, 10);
  inventoryAdjustmentMessage.textContent = "提交后会生成库存调整流水，并刷新首页指标。";
  inventoryAdjustmentMessage.className = "form-message";
}

function closeInventoryAdjustmentModal() {
  inventoryAdjustmentModal.hidden = true;
}

function syncInventoryAdjustmentMode() {
  const mode = inventoryAdjustmentForm.elements.adjustment_type.value;
  countPanel.hidden = mode !== "count";
  lossPanel.hidden = mode !== "loss";
  inventoryAdjustmentForm.elements.reason.value = mode === "count" ? "月度盘点" : "破损";
}

async function submitInventoryAdjustment(event) {
  event.preventDefault();
  const formData = new FormData(inventoryAdjustmentForm);
  const adjustmentType = String(formData.get("adjustment_type"));
  const payload = {
    product_id: Number(formData.get("product_id")),
    adjustment_type: adjustmentType,
    reason: String(formData.get("reason") || "").trim(),
    occurred_at: String(formData.get("occurred_at"))
  };

  if (adjustmentType === "count") {
    payload.actual_quantity = Number(formData.get("actual_quantity"));
  } else {
    payload.quantity = Number(formData.get("quantity"));
  }

  inventoryAdjustmentMessage.textContent = "正在提交库存调整...";
  inventoryAdjustmentMessage.className = "form-message";

  try {
    const response = await fetch(`${API_BASE_URL}/api/inventory-adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response.json();
      throw new Error(errorPayload.message || `API returned ${response.status}`);
    }

    const result = await response.json();
    inventoryAdjustmentMessage.textContent = `调整成功：库存变化 ${formatNumber(result.inventory_record.quantity_change)}，当前库存 ${formatNumber(result.inventory_record.quantity_after)}。`;
    inventoryAdjustmentMessage.className = "form-message success";
    await loadDashboard();
  } catch (error) {
    inventoryAdjustmentMessage.textContent = `调整失败：${error.message}`;
    inventoryAdjustmentMessage.className = "form-message error";
  }
}

function openSupplierQuotesModal() {
  supplierQuotesModal.hidden = false;
  quoteDateInput.value = new Date().toISOString().slice(0, 10);
  supplierQuotesMessage.textContent = "提交报价后会刷新同款酒水的供应商对比。";
  supplierQuotesMessage.className = "form-message";
  loadSupplierQuoteComparison();
}

function closeSupplierQuotesModal() {
  supplierQuotesModal.hidden = true;
}

async function submitSupplierQuote(event) {
  event.preventDefault();
  const formData = new FormData(supplierQuotesForm);
  const payload = {
    product_id: Number(formData.get("product_id")),
    supplier_id: Number(formData.get("supplier_id")),
    unit_price: Number(formData.get("unit_price")),
    delivery_days: Number(formData.get("delivery_days")),
    quoted_at: String(formData.get("quoted_at"))
  };

  supplierQuotesMessage.textContent = "正在提交报价...";
  supplierQuotesMessage.className = "form-message";

  try {
    const response = await fetch(`${API_BASE_URL}/api/supplier-price-quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = await response.json();
      throw new Error(errorPayload.message || `API returned ${response.status}`);
    }

    supplierQuotesMessage.textContent = "报价已记录。";
    supplierQuotesMessage.className = "form-message success";
    await loadSupplierQuoteComparison();
  } catch (error) {
    supplierQuotesMessage.textContent = `报价失败：${error.message}`;
    supplierQuotesMessage.className = "form-message error";
  }
}

async function loadSupplierQuoteComparison() {
  const productId = quoteProductSelect.value;
  if (!productId) {
    return;
  }

  quoteResults.innerHTML = "<p class=\"form-message\">正在读取报价对比...</p>";

  try {
    const response = await fetch(`${API_BASE_URL}/api/supplier-price-quotes?product_id=${productId}`);
    if (!response.ok) {
      const errorPayload = await response.json();
      throw new Error(errorPayload.message || `API returned ${response.status}`);
    }

    const comparison = await response.json();
    if (!comparison.items.length) {
      quoteResults.innerHTML = "<p class=\"form-message\">当前酒水还没有供应商报价。</p>";
      return;
    }

    quoteResults.innerHTML = `
      <div class="quote-comparison">
        ${comparison.items.map(renderQuoteComparisonRow).join("")}
      </div>
      <p class="form-message success">推荐：${escapeHtml(comparison.recommendation.supplier_name)}，报价 ${formatNumber(comparison.recommendation.unit_price)}，交付 ${formatNumber(comparison.recommendation.delivery_days)} 天。</p>
    `;
  } catch (error) {
    quoteResults.innerHTML = `<p class="form-message error">读取报价失败：${escapeHtml(error.message)}</p>`;
  }
}

function renderQuoteComparisonRow(item) {
  const tags = [
    item.is_lowest_price ? "最低价" : "",
    item.is_fastest_delivery ? "最快交付" : ""
  ].filter(Boolean).join(" / ");

  return `
    <article class="quote-row">
      <strong>${escapeHtml(item.supplier_name)}</strong>
      <span>报价 ${formatNumber(item.unit_price)}</span>
      <span>交付 ${formatNumber(item.delivery_days)} 天</span>
      <span>${tags || "备选"}</span>
    </article>
  `;
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
    setLiveSummaryForDashboard(dashboard);
    setApiStatus("实时数据", true);
  } catch (error) {
    setApiStatus("演示数据", false);
    setFallbackSummary();
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
bindPurchaseForm();
loadDashboard();
