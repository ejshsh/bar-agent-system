/* ───────── Purchase modal ───────── */

function bindPurchaseForm() {
  orderDateInput.value = new Date().toISOString().slice(0, 10);

  openPurchaseButton.addEventListener("click", () => {
    purchaseModal.hidden = false;
    purchaseMessage.textContent = "";
    purchaseMessage.className = "form-message";
    const safetyInput = purchaseForm.elements.new_product_safety_stock;
    if (safetyInput) {
      safetyInput.value = String(currentAppSettings.default_safety_stock || 10);
    }
    loadReplenishmentPanel();
    loadBudgetStatusBar();
  });

  // Toggle new product fields
  document.querySelector("[data-show-new-product]")?.addEventListener("click", () => {
    const panel = document.querySelector("[data-product-new]");
    panel.hidden = !panel.hidden;
  });

  // Toggle new supplier fields
  document.querySelector("[data-show-new-supplier]")?.addEventListener("click", () => {
    const panel = document.querySelector("[data-supplier-new]");
    panel.hidden = !panel.hidden;
  });

  closePurchaseButtons.forEach((button) => {
    button.addEventListener("click", closePurchaseModal);
  });

  purchaseModal.addEventListener("click", (event) => {
    if (event.target === purchaseModal) closePurchaseModal();
  });

  purchaseForm.addEventListener("submit", submitPurchaseOrder);
  openStorageButton.addEventListener("click", () => openStorageModal());
  closeStorageButtons.forEach((button) => button.addEventListener("click", closeStorageModal));
  storageModal.addEventListener("click", (event) => {
    if (event.target === storageModal) closeStorageModal();
  });
  storageForm.addEventListener("submit", submitCustomerStorage);
  saleDateInput.value = new Date().toISOString().slice(0, 10);
  openSaleButton.addEventListener("click", openSaleModal);
  closeSaleButtons.forEach((button) => button.addEventListener("click", closeSaleModal));
  saleModal.addEventListener("click", (event) => {
    if (event.target === saleModal) closeSaleModal();
  });
  saleForm.addEventListener("submit", submitSalesRecord);
  pickupDateInput.value = new Date().toISOString().slice(0, 10);
  closePickupButtons.forEach((button) => button.addEventListener("click", closePickupModal));
  pickupModal.addEventListener("click", (event) => {
    if (event.target === pickupModal) closePickupModal();
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
    if (event.target === inventoryAdjustmentModal) closeInventoryAdjustmentModal();
  });
  inventoryAdjustmentForm.addEventListener("submit", submitInventoryAdjustment);
  quoteDateInput.value = new Date().toISOString().slice(0, 10);
  openSupplierQuotesButton.addEventListener("click", openSupplierQuotesModal);
  closeSupplierQuotesButtons.forEach((button) => button.addEventListener("click", closeSupplierQuotesModal));
  supplierQuotesModal.addEventListener("click", (event) => {
    if (event.target === supplierQuotesModal) closeSupplierQuotesModal();
  });
  quoteProductSelect.addEventListener("change", loadSupplierQuoteComparison);
  refreshQuotesButton.addEventListener("click", loadSupplierQuoteComparison);
  supplierQuotesForm.addEventListener("submit", submitSupplierQuote);
}

function closePurchaseModal() {
  purchaseModal.hidden = true;
}

/* ───────── Replenishment panel ───────── */

async function loadReplenishmentPanel() {
  const panel = document.querySelector("[data-replenishment-panel]");
  const cards = document.querySelector("[data-replenishment-cards]");
  const count = document.querySelector("[data-replenishment-count]");
  const actions = document.querySelector("[data-replenishment-actions]");

  try {
    const dashboard = await apiFetch("/api/dashboard");
    const suggestions = dashboard.replenishment || [];
    currentReplenishmentData = suggestions;

    if (suggestions.length === 0) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    count.textContent = `${suggestions.length} 款建议补货`;
    actions.hidden = false;

    cards.innerHTML = suggestions.map((r, i) => `
      <div class="replenishment-card" data-replenishment-card="${i}">
        <div class="replenishment-card-info">
          <strong>${escapeHtml(r.product_name)}</strong>
          <span>当前库存 ${r.current_stock ?? '?'}${r.unit || ''} · 安全库存 ${r.safety_stock ?? '?'} · ${escapeHtml(r.reason || '')}</span>
        </div>
        <span class="replenishment-card-urgency">建议采购 ${r.suggested_quantity}</span>
        <button class="button primary small" type="button" data-fill-replenishment="${i}">填入表单</button>
      </div>`).join("");

    // Bind card clicks to fill form
    cards.querySelectorAll("[data-fill-replenishment]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.fillReplenishment);
        fillPurchaseFromSuggestion(suggestions[idx]);
        // Highlight selected card
        cards.querySelectorAll(".replenishment-card").forEach(c => c.classList.remove("selected"));
        btn.closest(".replenishment-card").classList.add("selected");
      });
    });

    // Bind card click (not button) to also fill
    cards.querySelectorAll("[data-replenishment-card]").forEach(card => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.dataset.replenishmentCard);
        fillPurchaseFromSuggestion(suggestions[idx]);
        cards.querySelectorAll(".replenishment-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
      });
    });

    // Batch purchase all button
    document.querySelector("[data-batch-purchase-all]")?.addEventListener("click", () => {
      openBatchPurchaseModal();
    });
  } catch (_) {
    panel.hidden = true;
  }
}

function fillPurchaseFromSuggestion(suggestion) {
  if (suggestion.product_id && productSelect) {
    const opt = productSelect.querySelector(`option[value="${suggestion.product_id}"]`);
    if (opt) {
      productSelect.value = suggestion.product_id;
      syncComboboxDisplay(productSelect);
    }
  }
  if (suggestion.suggested_quantity) {
    purchaseForm.elements.quantity.value = suggestion.suggested_quantity;
  }
  purchaseMessage.textContent = `已填入：${suggestion.product_name}，建议采购 ${suggestion.suggested_quantity}`;
  purchaseMessage.className = "form-message success";
}

async function submitPurchaseOrder(event) {
  event.preventDefault();
  const submitBtn = document.querySelector('[data-purchase-submit]');
  submitBtn.disabled = true;
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
    const result = await apiFetch("/api/purchase-orders", { method: "POST", body: payload });
    let successMsg = `入库成功：库存增加 ${formatNumber(result.inventory_record.quantity_change)}，当前库存 ${formatNumber(result.inventory_record.quantity_after)}。`;
    if (result.budget_warning) {
      purchaseMessage.innerHTML = successMsg + `<br><span style="color:#dc2626;">预算警告：本次采购后将超出预算 ¥${formatNumber(result.budget_warning.overspend)}（已用 ${result.budget_warning.percent_used}%）</span>`;
      purchaseMessage.className = "form-message error";
    } else {
      purchaseMessage.textContent = successMsg;
      purchaseMessage.className = "form-message success";
    }
    purchaseForm.reset();
    orderDateInput.value = new Date().toISOString().slice(0, 10);
    document.querySelector("[data-product-new]").hidden = true;
    document.querySelector("[data-supplier-new]").hidden = true;
    loadReplenishmentPanel();
    updateReplenishmentBadge();
    await loadDashboard();
  } catch (error) {
    purchaseMessage.textContent = `入库失败：${error.message}`;
    purchaseMessage.className = "form-message error";
  } finally {
    submitBtn.disabled = false;
  }
}

async function resolveProductId(formData) {
  const newName = String(formData.get("new_product_name") || "").trim();
  if (newName) {
    const product = await postJson("/api/products", {
      name: newName,
      category: String(formData.get("new_product_category") || "未分类").trim(),
      safety_stock: Number(formData.get("new_product_safety_stock") || 10),
      current_stock: 0,
      unit: "瓶"
    });
    return Number(product.product.id);
  }
  return Number(formData.get("product_id"));
}

async function resolveSupplierId(formData) {
  const newName = String(formData.get("new_supplier_name") || "").trim();
  if (newName) {
    const supplier = await postJson("/api/suppliers", {
      name: newName,
      average_delivery_days: Number(formData.get("new_supplier_delivery_days") || 3),
      price_stability_score: 80
    });
    return Number(supplier.supplier.id);
  }
  return Number(formData.get("supplier_id"));
}

/* ───────── Storage modal ───────── */

function openStorageModal(record) {
  storageModal.hidden = false;
  storageForm.reset();
  storageMessage.textContent = "保存后会刷新客户存酒提醒和 dashboard 指标。";
  storageMessage.className = "form-message";

  if (record) {
    storageTitle.textContent = "编辑客户存酒";
    storageIdInput.value = record.id;
    storageForm.elements.customer_name.value = record.customer_name;
    storageForm.elements.phone.value = record.phone || '';
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
    phone: String(formData.get("phone") || "").trim(),
    product_name: String(formData.get("product_name") || "").trim(),
    remaining_quantity: Number(formData.get("remaining_quantity")),
    days_until_expiry: Number(formData.get("days_until_expiry"))
  };

  storageMessage.textContent = "正在保存客户存酒...";
  storageMessage.className = "form-message";

  try {
    const path = storageId ? `/api/customer-storage/${storageId}` : "/api/customer-storage";
    await apiFetch(path, { method: storageId ? "PUT" : "POST", body: payload });
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
  if (!confirm(`确认删除「${name}」吗？`)) return;

  try {
    await apiFetch(`/api/customer-storage/${storageId}`, { method: "DELETE" });
    await loadDashboard();
  } catch (error) {
    showToast(`删除失败：${error.message}`, "error");
  }
}

/* ───────── Pickup modal ───────── */

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
    const result = await apiFetch(`/api/customer-storage/${storageId}/pickup`, { method: "POST", body: payload });
    pickupMessage.textContent = `取酒成功：剩余 ${formatNumber(result.customer_storage.remaining_quantity)}。`;
    pickupMessage.className = "form-message success";
    await loadDashboard();
  } catch (error) {
    pickupMessage.textContent = `取酒失败：${error.message}`;
    pickupMessage.className = "form-message error";
  }
}

/* ───────── Sale modal ───────── */

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
    unit_price: Number(formData.get("unit_price") || 0),
    sale_date: String(formData.get("sale_date"))
  };

  saleMessage.textContent = "正在提交出库...";
  saleMessage.className = "form-message";

  try {
    const result = await apiFetch("/api/sales-records", { method: "POST", body: payload });
    saleMessage.textContent = `出库成功：库存减少 ${formatNumber(Math.abs(result.inventory_record.quantity_change))}，当前库存 ${formatNumber(result.inventory_record.quantity_after)}。`;
    saleMessage.className = "form-message success";
    await loadDashboard();
  } catch (error) {
    saleMessage.textContent = `出库失败：${error.message}`;
    saleMessage.className = "form-message error";
  }
}

/* ───────── Inventory adjustment modal ───────── */

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
    const result = await apiFetch("/api/inventory-adjustments", { method: "POST", body: payload });
    inventoryAdjustmentMessage.textContent = `调整成功：库存变化 ${formatNumber(result.inventory_record.quantity_change)}，当前库存 ${formatNumber(result.inventory_record.quantity_after)}。`;
    inventoryAdjustmentMessage.className = "form-message success";
    await loadDashboard();
  } catch (error) {
    inventoryAdjustmentMessage.textContent = `调整失败：${error.message}`;
    inventoryAdjustmentMessage.className = "form-message error";
  }
}

/* ───────── Supplier quotes modal ───────── */

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
    await apiFetch("/api/supplier-price-quotes", { method: "POST", body: payload });
    supplierQuotesMessage.textContent = "报价已记录。";
    supplierQuotesMessage.className = "form-message success";
    await loadSupplierQuoteComparison();
  } catch (error) {
    supplierQuotesMessage.textContent = `报价失败：${error.message}`;
    supplierQuotesMessage.className = "form-message error";
  }
}

/* ───────── Supplier quote comparison ───────── */

let quoteChartInstance = null;

async function loadSupplierQuoteComparison() {
  const productId = quoteProductSelect.value;
  if (!productId) return;

  quoteResults.innerHTML = "<p class=\"form-message\">正在读取报价对比...</p>";

  try {
    const comparison = await apiFetch(`/api/supplier-price-quotes?product_id=${productId}`);
    const chartContainer = document.querySelector('[data-quote-chart-container]');

    if (!comparison.items.length) {
      quoteResults.innerHTML = "<p class=\"form-message\">当前酒水还没有供应商报价。</p>";
      chartContainer.hidden = true;
      return;
    }

    quoteResults.innerHTML = `
      <div class="quote-comparison">
        ${comparison.items.map(renderQuoteComparisonRow).join("")}
      </div>
      <p class="form-message success">推荐：${escapeHtml(comparison.recommendation.supplier_name)}，报价 ${formatNumber(comparison.recommendation.unit_price)}，交付 ${formatNumber(comparison.recommendation.delivery_days)} 天。</p>
    `;

    renderQuoteChart(comparison.items);
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

function renderQuoteChart(items) {
  if (quoteChartInstance) { quoteChartInstance.destroy(); quoteChartInstance = null; }

  const ctx = document.getElementById('chart-supplier-quote-comparison');
  if (!ctx) return;

  const chartContainer = document.querySelector('[data-quote-chart-container]');
  chartContainer.hidden = false;

  const colors = items.map((_, i) => i === 0 ? '#0066cc' : '#c0c0c0');
  const defaultFont = { family: "'SF Pro Text', system-ui, sans-serif", size: 12 };

  quoteChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: items.map(i => i.supplier_name),
      datasets: [
        { label: '报价 (¥)', data: items.map(i => i.unit_price), backgroundColor: colors, borderRadius: 4, yAxisID: 'y' },
        { label: '交付 (天)', data: items.map(i => i.delivery_days), backgroundColor: colors.map(() => 'rgba(0, 102, 204, 0.3)'), borderRadius: 4, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position: 'bottom', labels: { ...defaultFont, padding: 12 } } },
      scales: {
        x: { ticks: defaultFont },
        y: { position: 'left', ticks: { ...defaultFont, callback: v => `¥${v}` } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { ...defaultFont, callback: v => `${v}天` } },
      }
    }
  });
}

/* ───────── Report modal ───────── */

function switchReportTab(tabName) {
  reportTabs.forEach(t => t.classList.toggle("active", t.dataset.reportTab === tabName));
  reportGenerateArea.hidden = tabName !== "generate";
  reportHistoryArea.hidden = tabName !== "history";
  if (tabName === "history") { loadReportList(); loadReportComparison(); }
  if (tabName === "generate") {
    reportContent.hidden = true;
    reportActions.hidden = true;
    reportSaveMessage.hidden = true;
  }
}

function openReportModal() {
  reportModal.hidden = false;
  switchReportTab("generate");
  reportGenerateArea.hidden = false;
  reportContent.hidden = true;
  reportActions.hidden = true;
  reportSaveMessage.hidden = true;
  currentReportData = null;
}

function closeReportModal() {
  reportModal.hidden = true;
}

async function generateReport() {
  reportContent.hidden = false;
  reportContent.innerHTML = '<div class="report-loading">正在分析经营数据，生成报告...</div>';
  reportActions.hidden = true;
  reportSaveMessage.hidden = true;

  try {
    const report = await apiFetch("/api/agent-reports", {
      method: "POST",
      body: { created_at: new Date().toISOString().slice(0, 10) }
    });
    currentReportData = report;
    renderReport(report);
    reportActions.hidden = false;
  } catch (error) {
    reportContent.innerHTML = `<p class="form-message error">生成报告失败：${escapeHtml(error.message)}</p>`;
  }
}

async function saveCurrentReport() {
  if (!currentReportData) return;

  saveReportButton.disabled = true;
  saveReportButton.textContent = "保存中...";
  reportSaveMessage.hidden = false;
  reportSaveMessage.textContent = "正在保存报告...";
  reportSaveMessage.className = "form-message";

  try {
    await apiFetch("/api/agent-reports/save", { method: "POST", body: currentReportData });
    reportSaveMessage.textContent = "报告已保存至历史记录";
    reportSaveMessage.className = "form-message success";
    currentReportData = null;
    saveReportButton.disabled = false;
    saveReportButton.textContent = "保存报告";
  } catch (error) {
    reportSaveMessage.textContent = `保存失败：${error.message}`;
    reportSaveMessage.className = "form-message error";
    saveReportButton.disabled = false;
    saveReportButton.textContent = "保存报告";
  }
}

function renderReport(report) {
  const metrics = report.metrics || {};
  const metricsHtml = `
    <div class="report-metrics-bar" style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:20px; padding:12px 16px; background:var(--parchment); border-radius:var(--radius-sm);">
      <span><strong>周期</strong> ${escapeHtml(metrics.period || "—")}</span>
      <span><strong>采购金额</strong> ¥${escapeHtml(String(metrics.purchase_amount || 0))}</span>
      <span><strong>入库</strong> ${escapeHtml(String(metrics.inbound_quantity || 0))}</span>
      <span><strong>出库</strong> ${escapeHtml(String(metrics.outbound_quantity || 0))}</span>
      <span><strong>损耗</strong> ${escapeHtml(String(metrics.loss_quantity || 0))}</span>
      <span><strong>快缺货</strong> ${escapeHtml(String(metrics.low_stock_count || 0))}</span>
      <span><strong>积压</strong> ${escapeHtml(String(metrics.overstock_count || 0))}</span>
      <span><strong>临期存酒</strong> ${escapeHtml(String(metrics.expiring_storage_count || 0))}</span>
    </div>`;

  const contentHtml = report.content.split("\n").map(line => {
    if (line.startsWith("## ")) return `<h3>${escapeHtml(line.slice(3))}</h3>`;
    if (line.startsWith("### ")) return `<h4 style="font-size:16px; margin:16px 0 8px; color:var(--primary);">${escapeHtml(line.slice(4))}</h4>`;
    if (line.startsWith("- **")) {
      const match = line.match(/^- \*\*(.+?)\*\*(.*)/);
      if (match) return `<p style="margin:4px 0;">• <strong>${escapeHtml(match[1])}</strong>${escapeHtml(match[2])}</p>`;
    }
    if (line.startsWith("- ")) return `<p style="margin:4px 0;">• ${escapeHtml(line.slice(2))}</p>`;
    if (/^\d+\.\s/.test(line)) return `<p style="margin:4px 0;">${escapeHtml(line)}</p>`;
    if (line.trim() === "") return "<br>";
    return `<p style="margin:6px 0;">${escapeHtml(line)}</p>`;
  }).join("");

  reportContent.innerHTML = metricsHtml + contentHtml;
}

async function loadReportList() {
  reportList.innerHTML = '<p class="form-message">正在加载历史报告...</p>';

  try {
    const data = await apiFetch("/api/agent-reports");

    if (!data.items.length) {
      reportList.innerHTML = '<p class="form-message">暂无保存的报告。切换到「生成报告」创建一份吧。</p>';
      return;
    }

    reportList.innerHTML = data.items.map(report => `
      <div class="report-list-item">
        <div class="report-list-main" data-load-report="${report.id}">
          <h4>${escapeHtml(report.title)}</h4>
          <p class="report-list-meta">周期：${escapeHtml(report.period)} ｜ ${escapeHtml(report.created_at)} ｜ 采购 ¥${report.metrics?.purchase_amount || 0} ｜ 快缺货 ${report.metrics?.low_stock_count || 0} ｜ 临期 ${report.metrics?.expiring_storage_count || 0}</p>
        </div>
        <button class="button danger small" type="button" data-delete-report="${report.id}">删除</button>
      </div>
    `).join("");

    document.querySelectorAll("[data-load-report]").forEach(el => {
      el.addEventListener("click", () => loadAndShowReportFromHistory(el.dataset.loadReport));
    });

    document.querySelectorAll("[data-delete-report]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const reportId = btn.dataset.deleteReport;
        if (!confirm("确认删除这份报告吗？")) return;
        try {
          await apiFetch(`/api/agent-reports/${reportId}`, { method: "DELETE" });
          loadReportList();
        } catch (err) {
          showToast("删除失败：" + err.message, "error");
        }
      });
    });
  } catch (error) {
    reportList.innerHTML = `<p class="form-message error">加载历史报告失败：${escapeHtml(error.message)}</p>`;
  }
}

async function loadAndShowReportFromHistory(reportId) {
  try {
    const report = await apiFetch(`/api/agent-reports/${reportId}`);
    switchReportTab("generate");
    reportContent.hidden = false;
    reportActions.hidden = true;
    reportSaveMessage.hidden = true;
    currentReportData = null;
    renderReport(report);
  } catch (error) {
    showToast(`加载报告失败：${error.message}`, "error");
  }
}

/* ───────── POS quick sale ───────── */

let posSelectedProductId = null;

function openPOSModal() {
  posSelectedProductId = null;
  document.querySelector('[data-pos-checkout]').hidden = true;
  document.querySelector('[data-pos-modal]').hidden = false;
  document.querySelector('[data-pos-message]').textContent = '点击商品卡片选择，调整数量后确认出库。';
  document.querySelector('[data-pos-message]').className = 'form-message';
  loadPOSProducts();
}

function closePOSModal() {
  document.querySelector('[data-pos-modal]').hidden = true;
}

async function loadPOSProducts() {
  const grid = document.querySelector('[data-pos-products]');
  try {
    const data = await apiFetch("/api/products");
    const products = data.items || [];

    if (!products.length) {
      grid.innerHTML = '<p class="form-message">暂无可用商品。</p>';
      return;
    }

    grid.innerHTML = products.map(p => `
      <button class="pos-product-card" type="button" data-pos-product="${p.id}">
        <strong>${escapeHtml(p.name)}</strong>
        <span>库存 ${formatNumber(p.current_stock)} ${escapeHtml(p.unit || '')}</span>
      </button>
    `).join('');

    document.querySelectorAll('[data-pos-product]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pos-product-card').forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
        posSelectedProductId = Number(btn.dataset.posProduct);
        const name = btn.querySelector('strong').textContent;
        const stockText = btn.querySelector('span').textContent;
        document.querySelector('[data-pos-selected-name]').textContent = name;
        document.querySelector('[data-pos-selected-stock]').textContent = stockText;
        document.querySelector('[data-pos-qty]').value = 1;
        document.querySelector('[data-pos-checkout]').hidden = false;
        document.querySelector('[data-pos-message]').textContent = `已选 ${name}，调整数量后确认出库。`;
        document.querySelector('[data-pos-message]').className = 'form-message';
      });
    });
  } catch (err) {
    grid.innerHTML = `<p class="form-message error">加载商品失败：${err.message}</p>`;
  }
}

async function submitPOS() {
  if (!posSelectedProductId) return;
  const qty = Number(document.querySelector('[data-pos-qty]').value);
  if (!qty || qty <= 0) {
    document.querySelector('[data-pos-message]').textContent = '请输入有效数量。';
    document.querySelector('[data-pos-message]').className = 'form-message error';
    return;
  }

  const unitPrice = Number(document.querySelector('[data-pos-price]').value || 0);
  const confirmBtn = document.querySelector('[data-pos-confirm]');
  confirmBtn.disabled = true;
  const msg = document.querySelector('[data-pos-message]');
  msg.textContent = '正在出库...';
  msg.className = 'form-message';

  try {
    const result = await apiFetch("/api/sales-records", {
      method: "POST",
      body: {
        product_id: posSelectedProductId,
        quantity: qty,
        unit_price: unitPrice,
        sale_date: new Date().toISOString().slice(0, 10)
      }
    });
    msg.textContent = `出库成功：${qty} → 库存 ${formatNumber(result.inventory_record.quantity_after)}`;
    msg.className = 'form-message success';
    posSelectedProductId = null;
    await loadDashboard();
    loadPOSProducts();
    document.querySelectorAll('.pos-product-card').forEach(c => c.classList.remove('selected'));
    document.querySelector('[data-pos-checkout]').hidden = true;
  } catch (err) {
    msg.textContent = `出库失败：${err.message}`;
    msg.className = 'form-message error';
  } finally {
    confirmBtn.disabled = false;
  }
}

/* ───────── Import modal ───────── */

let importParsedData = null;

function openImportModal() {
  const modal = document.querySelector('[data-import-modal]');
  modal.hidden = false;
  document.querySelector('[data-import-preview-area]').hidden = true;
  document.querySelector('[data-import-submit]').hidden = true;
  document.querySelector('[data-import-status]').textContent = '';
  document.querySelector('[data-import-status]').className = 'form-message';
  document.querySelector('[data-import-csv]').value = '';
  document.querySelector('[data-import-file]').value = '';
  document.querySelector('[data-import-dropzone]').classList.remove('drag-over');
  importParsedData = null;
}

function closeImportModal() {
  document.querySelector('[data-import-modal]').hidden = true;
}

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return { headers: [], rows: [], error: '至少需要一行列名和一行数据。' };

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim());
    if (vals.length === 0 || (vals.length === 1 && vals[0] === '')) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows, error: null };
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!json.length) {
          resolve({ headers: [], rows: [], error: 'Excel 文件中没有数据。' });
          return;
        }
        const headers = Object.keys(json[0]);
        const rows = json.map(r => {
          const row = {};
          headers.forEach(h => { row[h] = String(r[h] ?? ''); });
          return row;
        });
        resolve({ headers, rows, error: null });
      } catch (err) {
        reject(new Error(`Excel 解析失败：${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

function renderImportPreview(headers, rows, importType) {
  const area = document.querySelector('[data-import-preview-area]');
  area.hidden = false;
  area.dataset.importHeaders = JSON.stringify(headers);

  const headerRow = headers.map(h => `<span>${escapeHtml(h)}</span>`).join('');
  const bodyRows = rows.slice(0, 50).map((row, ri) =>
    `<div class="supplier-row import-edit-row" role="row" data-import-row="${ri}">
      ${headers.map(h => `<input class="import-cell-input" type="text" value="${escapeHtml(row[h] || '')}" data-import-col="${escapeHtml(h)}">`).join('')}
      <button class="button danger small import-row-del" type="button" data-import-del="${ri}" title="删除此行">&times;</button>
    </div>`
  ).join('');
  const more = rows.length > 50 ? `<div class="supplier-row" role="row"><span style="grid-column:1/-1;text-align:center;color:var(--ink-muted);">... 还有 ${rows.length - 50} 行（预览最多显示 50 行，全部导入）</span></div>` : '';

  const cols = headers.length + 1;
  const gridStyle = `style="grid-template-columns:repeat(${cols - 1}, 1fr) 40px;"`;

  document.querySelector('[data-import-preview-table]').innerHTML = `
    <div class="supplier-row header import-edit-header" role="row" ${gridStyle}>${headerRow}<span></span></div>
    ${bodyRows}${more}
  `;

  document.querySelectorAll('.import-edit-row').forEach(el => {
    el.style.gridTemplateColumns = `repeat(${cols - 1}, 1fr) 40px`;
  });

  document.querySelectorAll('[data-import-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.import-edit-row').remove();
      updateImportRowCount();
      if (!document.querySelectorAll('.import-edit-row').length) {
        document.querySelector('[data-import-submit]').hidden = true;
      }
    });
  });

  document.querySelectorAll('.import-cell-input').forEach(inp => {
    inp.addEventListener('input', () => { importParsedData = null; });
  });

  importParsedData = rows;
  document.querySelector('[data-import-submit]').hidden = false;
  document.querySelector('[data-import-status]').textContent = `共 ${rows.length} 条记录，可直接编辑或删除后导入`;
  document.querySelector('[data-import-status]').className = 'form-message success';
}

function collectImportRows() {
  const rows = [];
  document.querySelectorAll('.import-edit-row').forEach(row => {
    const obj = {};
    row.querySelectorAll('.import-cell-input').forEach(inp => {
      obj[inp.dataset.importCol] = inp.value;
    });
    rows.push(obj);
  });
  return rows;
}

function updateImportRowCount() {
  const count = document.querySelectorAll('.import-edit-row').length;
  const status = document.querySelector('[data-import-status]');
  status.textContent = `共 ${count} 条记录，可直接编辑或删除后导入`;
}

async function submitImport() {
  const importType = document.querySelector('[data-import-type]').value;
  const status = document.querySelector('[data-import-status]');

  let rows;
  const previewVisible = !document.querySelector('[data-import-preview-area]').hidden;
  if (previewVisible) {
    rows = collectImportRows();
  } else if (importParsedData) {
    rows = importParsedData;
  } else {
    const csvText = document.querySelector('[data-import-csv]').value;
    const parsed = parseCSV(csvText);
    if (parsed.error) {
      status.textContent = parsed.error;
      status.className = 'form-message error';
      return;
    }
    rows = parsed.rows;
  }

  if (!rows || !rows.length) {
    status.textContent = '没有可导入的数据。';
    status.className = 'form-message error';
    return;
  }

  status.textContent = '正在导入...';
  status.className = 'form-message';

  try {
    const result = await apiFetch("/api/import", { method: "POST", body: { type: importType, rows }, timeoutMs: 30000 });
    status.textContent = `导入完成：成功 ${result.imported} 条，失败 ${result.errors.length} 条，共 ${result.total} 条。`;
    status.className = result.errors.length ? 'form-message warning' : 'form-message success';
    importParsedData = null;
    await loadDashboard();
  } catch (err) {
    status.textContent = `导入失败：${err.message}`;
    status.className = 'form-message error';
  }
}

function bindImportEvents() {
  document.querySelector('[data-open-import]')?.addEventListener('click', openImportModal);
  document.querySelectorAll('[data-close-import]').forEach(b => b.addEventListener('click', closeImportModal));
  const importModal = document.querySelector('[data-import-modal]');
  importModal?.addEventListener('click', e => { if (e.target === importModal) closeImportModal(); });

  const dropzone = document.querySelector('[data-import-dropzone]');
  const fileInput = document.querySelector('[data-import-file]');

  dropzone?.addEventListener('click', () => fileInput.click());

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processImportFile(file);
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) processImportFile(file);
  });

  async function processImportFile(file) {
    const status = document.querySelector('[data-import-status]');
    const importType = document.querySelector('[data-import-type]').value;
    const ext = file.name.split('.').pop().toLowerCase();

    status.textContent = '正在解析文件...';
    status.className = 'form-message';

    try {
      let result;
      if (ext === 'csv') {
        const text = await file.text();
        result = parseCSV(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        result = await parseExcelFile(file);
      } else {
        status.textContent = '不支持的文件格式，请使用 CSV 或 Excel 文件。';
        status.className = 'form-message error';
        return;
      }

      if (result.error) {
        status.textContent = result.error;
        status.className = 'form-message error';
        document.querySelector('[data-import-preview-area]').hidden = true;
        document.querySelector('[data-import-submit]').hidden = true;
        return;
      }

      renderImportPreview(result.headers, result.rows, importType);
      status.textContent = `已解析 "${file.name}"`;
      status.className = 'form-message success';
    } catch (err) {
      status.textContent = `文件解析失败：${err.message}`;
      status.className = 'form-message error';
    }
  }

  document.querySelector('[data-import-preview]')?.addEventListener('click', () => {
    const csvText = document.querySelector('[data-import-csv]').value;
    const importType = document.querySelector('[data-import-type]').value;
    const status = document.querySelector('[data-import-status]');
    importParsedData = null;
    const parsed = parseCSV(csvText);
    if (parsed.error) {
      status.textContent = parsed.error;
      status.className = 'form-message error';
      document.querySelector('[data-import-preview-area]').hidden = true;
      document.querySelector('[data-import-submit]').hidden = true;
      return;
    }
    renderImportPreview(parsed.headers, parsed.rows, importType);
  });

  document.querySelector('[data-import-submit]')?.addEventListener('click', submitImport);
}

/* ───────── Backup modal ───────── */

function openBackupModal() {
  document.querySelector('[data-backup-modal]').hidden = false;
  loadBackupList();
}

function closeBackupModal() {
  document.querySelector('[data-backup-modal]').hidden = true;
}

async function createBackup() {
  const msg = document.querySelector('[data-backup-message]');
  msg.hidden = false;
  msg.textContent = '正在创建备份...';
  msg.className = 'form-message';

  try {
    const result = await apiFetch("/api/backup", { method: "POST" });
    msg.textContent = `备份成功：${result.filename} (${result.size_kb} KB)`;
    msg.className = 'form-message success';
    loadBackupList();
  } catch (err) {
    msg.textContent = `备份失败：${err.message}`;
    msg.className = 'form-message error';
  }
}

async function loadBackupList() {
  const list = document.querySelector('[data-backup-list]');
  try {
    const data = await apiFetch("/api/backup/info");
    if (!data.total_count) {
      list.innerHTML = '<p class="form-message" style="text-align:center;">暂无备份。</p>';
      return;
    }
    list.innerHTML = data.backups.map(b =>
      `<div class="backup-item">
        <div class="backup-item-info">
          <strong>${escapeHtml(b.filename)}</strong>
          <span>${b.size_kb} KB · ${b.created_at}</span>
        </div>
      </div>`
    ).join('');
  } catch (err) {
    list.innerHTML = `<p class="form-message error">加载备份列表失败：${err.message}</p>`;
  }
}

/* ───────── Batch purchase modal ───────── */

async function openBatchPurchaseModal() {
  if (currentReplenishmentData.length === 0) {
    try {
      const dashboard = await apiFetch("/api/dashboard");
      currentReplenishmentData = dashboard.replenishment || [];
    } catch (_) {}
  }
  if (currentReplenishmentData.length === 0) {
    showToast("当前没有需要补货的商品。", "info");
    return;
  }
  const table = document.querySelector("[data-batch-purchase-table]");
  table.innerHTML = `
    <div class="batch-purchase-row header"><span>商品</span><span>数量</span><span>单价</span><span>供应商ID</span></div>
    ${currentReplenishmentData.map((r, i) => `
      <div class="batch-purchase-row">
        <span>${escapeHtml(r.product_name)}</span>
        <input type="number" value="${r.suggested_quantity}" min="1" step="1" data-batch-qty="${i}">
        <input type="number" value="0" min="0" step="0.01" data-batch-price="${i}">
        <input type="number" value="1" min="1" step="1" data-batch-supplier="${i}">
      </div>`).join("")}`;
  document.querySelector("[data-batch-purchase-modal]").hidden = false;
  document.querySelector("[data-batch-purchase-message]").textContent = "";
}

function closeBatchPurchaseModal() {
  document.querySelector("[data-batch-purchase-modal]").hidden = true;
}

async function submitBatchPurchase() {
  const items = currentReplenishmentData.map((r, i) => ({
    product_id: r.product_id,
    supplier_id: parseInt(document.querySelector(`[data-batch-supplier="${i}"]`)?.value || 1),
    quantity: parseFloat(document.querySelector(`[data-batch-qty="${i}"]`)?.value || r.suggested_quantity),
    unit_price: parseFloat(document.querySelector(`[data-batch-price="${i}"]`)?.value || 0),
    order_date: new Date().toISOString().slice(0, 10),
  })).filter(item => item.quantity > 0 && item.unit_price > 0);

  if (items.length === 0) {
    document.querySelector("[data-batch-purchase-message]").textContent = "请至少填写一件商品的单价和数量。";
    return;
  }

  const msg = document.querySelector("[data-batch-purchase-message]");
  msg.textContent = "提交中...";
  try {
    const data = await apiFetch("/api/purchase-orders/batch", { method: "POST", body: { items } });
    msg.textContent = `成功创建 ${data.created} 笔采购单`;
    msg.className = "form-message success";
    setTimeout(() => { closeBatchPurchaseModal(); loadDashboard(); }, 1500);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "form-message error";
  }
}

/* ───────── Operation logs modal ───────── */

async function openLogsModal() {
  document.querySelector("[data-logs-modal]").hidden = false;
  const list = document.querySelector("[data-logs-list]");
  list.innerHTML = '<p class="form-message">加载中...</p>';
  try {
    const data = await apiFetch("/api/operation-logs");
    const logs = data.items || [];
    if (logs.length === 0) {
      list.innerHTML = '<p class="form-message">暂无操作记录。</p>';
      return;
    }
    list.innerHTML = logs.map(l => `
      <div class="log-item">
        <span><strong>${escapeHtml(l.action)}</strong> — ${escapeHtml(l.target_type)} #${l.target_id || '-'}</span>
        <span class="log-item-time">${escapeHtml(l.details)} · ${(l.created_at || '').replace('T', ' ').slice(0, 19)}</span>
      </div>`).join("");
  } catch (_) {
    list.innerHTML = '<p class="form-message error">加载失败。</p>';
  }
}

function closeLogsModal() {
  document.querySelector("[data-logs-modal]").hidden = true;
}

/* ───────── Customer contact ───────── */

async function contactCustomer(storageId, action) {
  try {
    const data = await apiFetch("/api/customer-contact", { method: "POST", body: { storage_id: storageId, action } });
    if (data.contacted) {
      const btn = document.querySelector(`[data-${action}-storage="${storageId}"]`);
      if (btn) {
        btn.textContent = action === "notify" ? "已通知" : "已召回";
        btn.disabled = true;
        btn.style.opacity = "0.5";
      }
    }
  } catch (_) { /* ignore */ }
}

function bindCustomerContactButtons() {
  document.addEventListener("click", (e) => {
    const pickupBtn = e.target.closest("[data-pickup-storage]");
    if (pickupBtn) {
      const storageId = parseInt(pickupBtn.dataset.pickupStorage);
      if (storageId) contactCustomer(storageId, "notify");
      return;
    }
    const editBtn = e.target.closest("[data-edit-storage]");
    if (editBtn) {
      const storageId = parseInt(editBtn.dataset.editStorage);
      const item = (currentStorageRecords || []).find(s => s.id === storageId);
      if (item && storageId) openStorageModal(item);
      return;
    }
  });
}

/* ───────── Setup wizard ───────── */

async function checkSetupNeeded() {
  try {
    const data = await apiFetch("/api/setup-check");
    if (data.needs_setup) {
      initQuickSetupRows();
      document.querySelector("[data-setup-wizard-modal]").hidden = false;
    }
  } catch (_) { /* skip */ }
}

function initQuickSetupRows() {
  const productsEl = document.querySelector("[data-quick-products]");
  const suppliersEl = document.querySelector("[data-quick-suppliers]");
  if (productsEl) {
    productsEl.innerHTML = `<div class="quick-row"><input placeholder="名称" data-qp-name><input placeholder="分类" data-qp-cat value="威士忌"><input placeholder="库存" data-qp-stock type="number" value="0"><input placeholder="安全库存" data-qp-safety type="number" value="10"></div>`;
  }
  if (suppliersEl) {
    suppliersEl.innerHTML = `<div class="quick-row"><input placeholder="供应商名称" data-qs-name><input placeholder="稳定性(0-100)" data-qs-score type="number" value="80"><input placeholder="交付天数" data-qs-delivery type="number" value="3"></div>`;
  }
}

async function saveQuickSetup() {
  const msg = document.querySelector("[data-setup-message]");
  msg.textContent = "保存中...";
  msg.className = "form-message";

  const productRows = document.querySelectorAll("[data-quick-products] .quick-row");
  const supplierRows = document.querySelectorAll("[data-quick-suppliers] .quick-row");

  let saved = 0;
  for (const row of productRows) {
    const name = row.querySelector("[data-qp-name]")?.value?.trim();
    if (!name) continue;
    const cat = row.querySelector("[data-qp-cat]")?.value?.trim() || "未分类";
    const stock = parseFloat(row.querySelector("[data-qp-stock]")?.value) || 0;
    const safety = parseFloat(row.querySelector("[data-qp-safety]")?.value) || 10;
    try {
      await apiFetch("/api/products", { method: "POST", body: { name, category: cat, current_stock: stock, safety_stock: safety, unit: "瓶" } });
      saved++;
    } catch (_) { /* skip */ }
  }
  for (const row of supplierRows) {
    const name = row.querySelector("[data-qs-name]")?.value?.trim();
    if (!name) continue;
    const score = parseFloat(row.querySelector("[data-qs-score]")?.value) || 80;
    const delivery = parseFloat(row.querySelector("[data-qs-delivery]")?.value) || 3;
    try {
      await apiFetch("/api/suppliers", { method: "POST", body: { name, price_stability_score: score, average_delivery_days: delivery } });
      saved++;
    } catch (_) { /* skip */ }
  }

  msg.textContent = `已保存 ${saved} 条数据`;
  msg.className = "form-message success";
  setTimeout(() => {
    document.querySelector("[data-setup-wizard-modal]").hidden = true;
    loadDashboard();
  }, 1000);
}

function closeSetupWizard() {
  document.querySelector("[data-setup-wizard-modal]").hidden = true;
}

async function useSeedData() {
  document.querySelector("[data-setup-wizard-modal]").hidden = true;
  loadDashboard();
}

/* ───────── Approval modal ───────── */

async function openApprovalModal() {
  document.querySelector("[data-approval-modal]").hidden = false;
  const list = document.querySelector("[data-approval-list]");
  list.innerHTML = '<p class="form-message">加载中...</p>';
  try {
    const data = await apiFetch("/api/pending-approvals");
    const items = data.items || [];
    if (items.length === 0) {
      list.innerHTML = '<p class="form-message">暂无待审批采购单。</p>';
      return;
    }
    list.innerHTML = items.map(a => `
      <div class="backup-item" style="margin-bottom:8px;">
        <div class="backup-item-info">
          <strong>商品 #${a.product_id} · ¥${a.total_amount}</strong>
          <span>供应商 #${a.supplier_id} · ${a.quantity} 件 · 单价 ¥${a.unit_price} · ${a.created_at}</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="button primary small" type="button" data-approve="${a.id}">通过</button>
          <button class="button danger small" type="button" data-reject="${a.id}">驳回</button>
        </div>
      </div>`).join("");

    list.querySelectorAll("[data-approve]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.approve;
        try {
          await apiFetch(`/api/purchase-approvals/${id}/approve`, { method: "POST" });
          btn.textContent = "已通过"; btn.disabled = true;
        } catch (_) {}
      });
    });
    list.querySelectorAll("[data-reject]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.reject;
        try {
          await apiFetch(`/api/purchase-approvals/${id}/reject`, { method: "POST" });
          btn.textContent = "已驳回"; btn.disabled = true;
        } catch (_) {}
      });
    });
  } catch (_) { list.innerHTML = '<p class="form-message error">加载失败。</p>'; }
}

function closeApprovalModal() {
  document.querySelector("[data-approval-modal]").hidden = true;
}

/* ───────── Inventory audit modal ───────── */

let auditProducts = [];

async function openAuditModal() {
  document.querySelector("[data-audit-modal]").hidden = false;
  const sel = document.querySelector("[data-audit-product]");
  try {
    const data = await apiFetch("/api/products");
    auditProducts = data.items || [];
    sel.innerHTML = auditProducts.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (系统库存: ${p.current_stock})</option>`).join("");
    initSearchableSelect(sel);
  } catch (_) {}
  loadAuditHistory();
}

function closeAuditModal() {
  document.querySelector("[data-audit-modal]").hidden = true;
}

async function submitAudit() {
  const productId = parseInt(document.querySelector("[data-audit-product]")?.value || 0);
  const actual = parseFloat(document.querySelector("[data-audit-actual]")?.value || 0);
  const note = document.querySelector("[data-audit-note]")?.value || "";
  const msg = document.querySelector("[data-audit-message]");
  if (!productId) { msg.textContent = "请选择商品。"; return; }

  msg.textContent = "提交中...";
  msg.className = "form-message";
  try {
    const data = await apiFetch("/api/inventory-audits", {
      method: "POST",
      body: { product_id: productId, actual_stock: actual, note, audited_at: new Date().toISOString().slice(0, 10) }
    });
    const diff = data.discrepancy;
    msg.textContent = `盘点完成。系统库存: ${data.system_stock}，实际: ${data.actual_stock}，差异: ${diff > 0 ? '+' : ''}${diff}`;
    msg.className = `form-message ${Math.abs(diff) > 2 ? 'error' : 'success'}`;
    document.querySelector("[data-audit-actual]").value = "0";
    document.querySelector("[data-audit-note]").value = "";
    loadAuditHistory();
    loadDashboard();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "form-message error";
  }
}

async function loadAuditHistory() {
  const el = document.querySelector("[data-audit-history]");
  if (!el) return;
  try {
    const data = await apiFetch("/api/inventory-audits");
    const items = data.items || [];
    if (items.length === 0) { el.innerHTML = '<p class="form-message">暂无盘点记录。</p>'; return; }
    el.innerHTML = items.slice(0, 10).map(a => `
      <div class="log-item">
        <span>商品 #${a.product_id} · 系统 ${a.system_stock} → 实际 ${a.actual_stock} · 差异 <strong style="color:${Math.abs(a.discrepancy) > 2 ? '#ff3b30' : '#34c759'}">${a.discrepancy > 0 ? '+' : ''}${a.discrepancy}</strong></span>
        <span class="log-item-time">${a.note || ''} · ${a.audited_at}</span>
      </div>`).join("");
  } catch (_) { el.innerHTML = '<p class="form-message">加载失败。</p>'; }
}

/* ───────── Dropdown toggle ───────── */

function bindDropdown() {
  const toggle = document.querySelector('[data-dropdown-toggle]');
  const menu = document.querySelector('[data-dropdown-menu]');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-dropdown]')) {
      menu.hidden = true;
    }
  });

  menu.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => { menu.hidden = true; });
  });
}

/* ───────── New feature buttons ───────── */

function bindNewFeatureButtons() {
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const savedTheme = localStorage.getItem("bar-theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  if (themeToggle) {
    themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("bar-theme", next);
      themeToggle.textContent = next === "dark" ? "☀️" : "🌙";
    });
  }

  const pdfExportBtn = document.querySelector("[data-export-pdf]");
  if (pdfExportBtn) {
    pdfExportBtn.addEventListener("click", () => window.print());
  }

  openSettingsButton?.addEventListener("click", openSettingsModal);
  closeSettingsButtons.forEach((button) => button.addEventListener("click", closeSettingsModal));
  settingsModal?.addEventListener("click", (event) => {
    if (event.target === settingsModal) closeSettingsModal();
  });
  settingsForm?.addEventListener("submit", submitSettings);

  document.querySelector("[data-open-approval]")?.addEventListener("click", openApprovalModal);
  document.querySelectorAll("[data-close-approval]").forEach(b => b.addEventListener("click", closeApprovalModal));
  const approvalModal = document.querySelector("[data-approval-modal]");
  approvalModal?.addEventListener("click", e => { if (e.target === approvalModal) closeApprovalModal(); });

  document.querySelector("[data-open-audit]")?.addEventListener("click", openAuditModal);
  document.querySelectorAll("[data-close-audit]").forEach(b => b.addEventListener("click", closeAuditModal));
  document.querySelector("[data-audit-submit]")?.addEventListener("click", submitAudit);
  const auditModal = document.querySelector("[data-audit-modal]");
  auditModal?.addEventListener("click", e => { if (e.target === auditModal) closeAuditModal(); });

  document.querySelector("[data-open-batch-purchase]")?.addEventListener("click", openBatchPurchaseModal);
  document.querySelectorAll("[data-close-batch-purchase]").forEach(b => b.addEventListener("click", closeBatchPurchaseModal));
  document.querySelector("[data-batch-purchase-submit]")?.addEventListener("click", submitBatchPurchase);
  const batchModal = document.querySelector("[data-batch-purchase-modal]");
  batchModal?.addEventListener("click", e => { if (e.target === batchModal) closeBatchPurchaseModal(); });

  document.querySelector("[data-open-logs]")?.addEventListener("click", openLogsModal);
  document.querySelectorAll("[data-close-logs]").forEach(b => b.addEventListener("click", closeLogsModal));
  const logsModal = document.querySelector("[data-logs-modal]");
  logsModal?.addEventListener("click", e => { if (e.target === logsModal) closeLogsModal(); });

  document.querySelector("[data-setup-save]")?.addEventListener("click", saveQuickSetup);
  document.querySelectorAll("[data-close-setup-wizard]").forEach(b => b.addEventListener("click", closeSetupWizard));
  document.querySelector("[data-setup-seed]")?.addEventListener("click", useSeedData);
  document.querySelector("[data-add-quick-product]")?.addEventListener("click", () => {
    const el = document.querySelector("[data-quick-products]");
    if (el) el.insertAdjacentHTML("beforeend", `<div class="quick-row"><input placeholder="名称" data-qp-name><input placeholder="分类" data-qp-cat value="威士忌"><input placeholder="库存" data-qp-stock type="number" value="0"><input placeholder="安全库存" data-qp-safety type="number" value="10"></div>`);
  });
  document.querySelector("[data-add-quick-supplier]")?.addEventListener("click", () => {
    const el = document.querySelector("[data-quick-suppliers]");
    if (el) el.insertAdjacentHTML("beforeend", `<div class="quick-row"><input placeholder="供应商名称" data-qs-name><input placeholder="稳定性(0-100)" data-qs-score type="number" value="80"><input placeholder="交付天数" data-qs-delivery type="number" value="3"></div>`);
  });

  // Batch outbound
  document.querySelector("[data-open-batch-outbound]")?.addEventListener("click", openBatchOutboundModal);
  document.querySelectorAll("[data-close-batch-outbound]").forEach(b => b.addEventListener("click", closeBatchOutboundModal));
  document.querySelector("[data-batch-outbound-submit]")?.addEventListener("click", submitBatchOutbound);
  const batchOutboundModal = document.querySelector("[data-batch-outbound-modal]");
  batchOutboundModal?.addEventListener("click", e => { if (e.target === batchOutboundModal) closeBatchOutboundModal(); });

  // Batch inventory adjustment
  document.querySelector("[data-open-batch-adjust]")?.addEventListener("click", openBatchAdjustModal);
  document.querySelectorAll("[data-close-batch-adjust]").forEach(b => b.addEventListener("click", closeBatchAdjustModal));
  document.querySelector("[data-batch-adjust-submit]")?.addEventListener("click", submitBatchAdjust);
  const batchAdjustModal = document.querySelector("[data-batch-adjust-modal]");
  batchAdjustModal?.addEventListener("click", e => { if (e.target === batchAdjustModal) closeBatchAdjustModal(); });

  // Rules engine
  document.querySelector("[data-open-rules]")?.addEventListener("click", openRulesModal);
  document.querySelectorAll("[data-close-rules]").forEach(b => b.addEventListener("click", closeRulesModal));
  const rulesModal = document.querySelector("[data-rules-modal]");
  rulesModal?.addEventListener("click", e => { if (e.target === rulesModal) closeRulesModal(); });
  bindRulesEvents();

  document.addEventListener("click", (e) => {
    if (e.target.matches("[data-generate-today-report]") || e.target.closest("[data-generate-today-report]")) {
      generateTodayReportFromDashboard();
    }
  });
}

/* ───────── System settings modal ───────── */

async function openSettingsModal() {
  settingsModal.hidden = false;
  settingsMessage.textContent = "加载设置中...";
  settingsMessage.className = "form-message";
  try {
    await loadAppSettings();
  } catch (error) {
    settingsMessage.textContent = `加载失败：${error.message}`;
    settingsMessage.className = "form-message error";
  }

  settingsForm.elements.bar_name.value = currentAppSettings.bar_name || "Bar Agent";
  settingsForm.elements.default_safety_stock.value = currentAppSettings.default_safety_stock ?? 10;
  settingsForm.elements.admin_display_name.value = currentAppSettings.users?.admin?.display_name || "管理员";
  settingsForm.elements.staff_display_name.value = currentAppSettings.users?.staff?.display_name || "店员";
  settingsForm.elements.admin_password.value = "";
  settingsForm.elements.staff_password.value = "";

  const isAdmin = getCurrentRole() === "admin";
  settingsForm.querySelectorAll("input").forEach((input) => {
    input.disabled = !isAdmin;
  });
  settingsForm.querySelector("button[type='submit']").disabled = !isAdmin;
  settingsMessage.textContent = isAdmin
    ? "保存后会立即更新页面名称和新增酒水默认安全库存。"
    : "当前是店员模式，只能查看设置；修改设置需要管理员。";
  settingsMessage.className = "form-message";
}

function closeSettingsModal() {
  settingsModal.hidden = true;
}

async function submitSettings(event) {
  event.preventDefault();
  const submitButton = settingsForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  settingsMessage.textContent = "保存中...";
  settingsMessage.className = "form-message";

  const formData = new FormData(settingsForm);
  const payload = {
    bar_name: String(formData.get("bar_name") || "").trim(),
    default_safety_stock: Number(formData.get("default_safety_stock") || 0),
    users: {
      admin: {
        display_name: String(formData.get("admin_display_name") || "").trim(),
        password: String(formData.get("admin_password") || ""),
      },
      staff: {
        display_name: String(formData.get("staff_display_name") || "").trim(),
        password: String(formData.get("staff_password") || ""),
      },
    },
  };

  try {
    const result = await apiFetch("/api/settings", { method: "PUT", body: payload });
    applyAppSettings(result.settings || {});
    const role = getCurrentRole();
    const displayName = result.settings?.users?.[role]?.display_name;
    if (displayName) {
      setCurrentUserName(displayName);
      document.querySelector(".nav-utility").textContent = role === "admin" ? "管理员" : "店员";
    }
    settingsForm.elements.admin_password.value = "";
    settingsForm.elements.staff_password.value = "";
    settingsMessage.textContent = "系统设置已保存。";
    settingsMessage.className = "form-message success";
    showToast("系统设置已保存", "success");
  } catch (error) {
    settingsMessage.textContent = `保存失败：${error.message}`;
    settingsMessage.className = "form-message error";
  } finally {
    submitButton.disabled = getCurrentRole() !== "admin";
  }
}

/* ───────── Batch outbound modal ───────── */

let batchOutboundProducts = [];

async function openBatchOutboundModal() {
  const modal = document.querySelector("[data-batch-outbound-modal]");
  modal.hidden = false;
  document.querySelector("[data-batch-outbound-date]").value = new Date().toISOString().slice(0, 10);
  document.querySelector("[data-batch-outbound-message]").textContent = "";
  document.querySelector("[data-batch-outbound-message]").className = "form-message";

  try {
    const data = await apiFetch("/api/products");
    batchOutboundProducts = (data.items || []).filter(p => p.current_stock > 0);
    renderBatchOutboundTable();
  } catch (err) {
    document.querySelector("[data-batch-outbound-table]").innerHTML = `<p class="form-message error">加载失败：${err.message}</p>`;
  }
}

function renderBatchOutboundTable() {
  const table = document.querySelector("[data-batch-outbound-table]");
  if (batchOutboundProducts.length === 0) {
    table.innerHTML = '<div class="supplier-row" role="row"><span style="grid-column:1/-1;text-align:center;color:var(--ink-muted);">没有可出库的商品。</span></div>';
    return;
  }

  table.innerHTML = `
    <div class="supplier-row header" role="row" style="grid-template-columns:40px 1.4fr 0.8fr 0.8fr 0.8fr;">
      <span></span><span>商品</span><span>当前库存</span><span>出库数量</span><span>单价 (¥)</span>
    </div>
    ${batchOutboundProducts.map((p, i) => `
      <div class="supplier-row" role="row" style="grid-template-columns:40px 1.4fr 0.8fr 0.8fr 0.8fr;align-items:center;">
        <input type="checkbox" data-batch-ob-check="${i}" style="width:16px;height:16px;cursor:pointer;">
        <span>${escapeHtml(p.name)}</span>
        <span>${formatNumber(p.current_stock)} ${escapeHtml(p.unit || "")}</span>
        <input type="number" value="1" min="0.1" step="0.1" data-batch-ob-qty="${i}" style="border:1px solid var(--hairline);border-radius:4px;font:inherit;font-size:13px;min-height:32px;padding:4px 8px;width:100%;" disabled>
        <input type="number" value="0" min="0" step="0.01" data-batch-ob-price="${i}" style="border:1px solid var(--hairline);border-radius:4px;font:inherit;font-size:13px;min-height:32px;padding:4px 8px;width:100%;" disabled>
      </div>`).join("")}`;

  document.querySelectorAll("[data-batch-ob-check]").forEach(cb => {
    cb.addEventListener("change", () => {
      const i = parseInt(cb.dataset.batchObCheck);
      const qtyEl = document.querySelector(`[data-batch-ob-qty="${i}"]`);
      const priceEl = document.querySelector(`[data-batch-ob-price="${i}"]`);
      qtyEl.disabled = !cb.checked;
      priceEl.disabled = !cb.checked;
      if (!cb.checked) { qtyEl.value = 1; priceEl.value = 0; }
    });
  });
}

function closeBatchOutboundModal() {
  document.querySelector("[data-batch-outbound-modal]").hidden = true;
}

async function submitBatchOutbound() {
  const msg = document.querySelector("[data-batch-outbound-message]");
  const date = document.querySelector("[data-batch-outbound-date]").value;

  const items = [];
  document.querySelectorAll("[data-batch-ob-check]:checked").forEach(cb => {
    const i = parseInt(cb.dataset.batchObCheck);
    const qty = parseFloat(document.querySelector(`[data-batch-ob-qty="${i}"]`)?.value || 0);
    const price = parseFloat(document.querySelector(`[data-batch-ob-price="${i}"]`)?.value || 0);
    if (qty > 0) {
      items.push({
        product_id: batchOutboundProducts[i].id,
        quantity: qty,
        unit_price: price,
        sale_date: date,
      });
    }
  });

  if (items.length === 0) {
    msg.textContent = "请至少选择一个商品并填写出库数量。";
    msg.className = "form-message error";
    return;
  }

  msg.textContent = `正在批量出库 ${items.length} 个商品...`;
  msg.className = "form-message";

  let successCount = 0;
  for (const item of items) {
    try {
      await apiFetch("/api/sales-records", { method: "POST", body: item });
      successCount++;
    } catch (_) { /* continue */ }
  }

  msg.textContent = `批量出库完成：成功 ${successCount}/${items.length}`;
  msg.className = successCount === items.length ? "form-message success" : "form-message error";
  await loadDashboard();
}

/* ───────── Batch inventory adjustment modal ───────── */

let batchAdjustProducts = [];

async function openBatchAdjustModal() {
  const modal = document.querySelector("[data-batch-adjust-modal]");
  modal.hidden = false;
  document.querySelector("[data-batch-adjust-date]").value = new Date().toISOString().slice(0, 10);
  document.querySelector("[data-batch-adjust-message]").textContent = "";
  document.querySelector("[data-batch-adjust-message]").className = "form-message";

  try {
    const data = await apiFetch("/api/products");
    batchAdjustProducts = data.items || [];
    renderBatchAdjustTable();
  } catch (err) {
    document.querySelector("[data-batch-adjust-table]").innerHTML = `<p class="form-message error">加载失败：${err.message}</p>`;
  }
}

function renderBatchAdjustTable() {
  const table = document.querySelector("[data-batch-adjust-table]");
  if (batchAdjustProducts.length === 0) {
    table.innerHTML = '<div class="supplier-row" role="row"><span style="grid-column:1/-1;text-align:center;color:var(--ink-muted);">暂无商品。</span></div>';
    return;
  }

  table.innerHTML = `
    <div class="supplier-row header" role="row" style="grid-template-columns:40px 1.4fr 0.8fr 0.8fr;">
      <span></span><span>商品</span><span>系统库存</span><span>实际盘点</span>
    </div>
    ${batchAdjustProducts.map((p, i) => `
      <div class="supplier-row" role="row" style="grid-template-columns:40px 1.4fr 0.8fr 0.8fr;align-items:center;">
        <input type="checkbox" data-batch-adj-check="${i}" style="width:16px;height:16px;cursor:pointer;">
        <span>${escapeHtml(p.name)}</span>
        <span>${formatNumber(p.current_stock)} ${escapeHtml(p.unit || "")}</span>
        <input type="number" value="${p.current_stock || 0}" min="0" step="0.1" data-batch-adj-qty="${i}" style="border:1px solid var(--hairline);border-radius:4px;font:inherit;font-size:13px;min-height:32px;padding:4px 8px;width:100%;" disabled>
      </div>`).join("")}`;

  document.querySelectorAll("[data-batch-adj-check]").forEach(cb => {
    cb.addEventListener("change", () => {
      const i = parseInt(cb.dataset.batchAdjCheck);
      const el = document.querySelector(`[data-batch-adj-qty="${i}"]`);
      el.disabled = !cb.checked;
    });
  });
}

function closeBatchAdjustModal() {
  document.querySelector("[data-batch-adjust-modal]").hidden = true;
}

async function submitBatchAdjust() {
  const msg = document.querySelector("[data-batch-adjust-message]");
  const date = document.querySelector("[data-batch-adjust-date]").value;
  const reason = document.querySelector("[data-batch-adjust-reason]").value || "月度盘点";

  const items = [];
  document.querySelectorAll("[data-batch-adj-check]:checked").forEach(cb => {
    const i = parseInt(cb.dataset.batchAdjCheck);
    const actual = parseFloat(document.querySelector(`[data-batch-adj-qty="${i}"]`)?.value || 0);
    items.push({
      product_id: batchAdjustProducts[i].id,
      adjustment_type: "count",
      actual_quantity: actual,
      reason,
      occurred_at: date,
    });
  });

  if (items.length === 0) {
    msg.textContent = "请至少选择一个商品。";
    msg.className = "form-message error";
    return;
  }

  msg.textContent = `正在批量调整 ${items.length} 个商品...`;
  msg.className = "form-message";

  let successCount = 0;
  for (const item of items) {
    try {
      await apiFetch("/api/inventory-adjustments", { method: "POST", body: item });
      successCount++;
    } catch (_) { /* continue */ }
  }

  msg.textContent = `批量调整完成：成功 ${successCount}/${items.length}`;
  msg.className = successCount === items.length ? "form-message success" : "form-message error";
  await loadDashboard();
}

/* ───────── Filter bindings ───────── */

function bindFilters() {
  [inventorySearch, inventoryFilterStock, inventoryFilterCategory].forEach(el => {
    el?.addEventListener("change", applyInventoryFilters);
    el?.addEventListener("input", applyInventoryFilters);
  });
  [storageSearch, storageFilterExpiry].forEach(el => {
    el?.addEventListener("change", applyStorageFilters);
    el?.addEventListener("input", applyStorageFilters);
  });
}

/* ───────── Extra action bindings ───────── */

/* ───────── Budget modal ───────── */

function bindBudgetModal() {
  const budgetModal = document.querySelector("[data-budget-modal]");
  const closeButtons = document.querySelectorAll("[data-close-budget]");
  const saveButton = document.querySelector("[data-save-budget]");
  const yearSelect = document.querySelector("[data-budget-year]");
  const monthSelect = document.querySelector("[data-budget-month]");
  const amountInput = document.querySelector("[data-budget-amount]");
  const message = document.querySelector("[data-budget-message]");

  document.querySelector("[data-open-budget]")?.addEventListener("click", () => {
    budgetModal.hidden = false;
    message.textContent = "";
    message.className = "form-message";
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = [0, 1, 2].map(i => `<option value="${currentYear - i}">${currentYear - i}</option>`).join("");
    yearSelect.value = currentYear;
    monthSelect.value = new Date().getMonth() + 1;
    loadBudgetForm(yearSelect.value, monthSelect.value);
  });

  closeButtons.forEach(b => b.addEventListener("click", () => { budgetModal.hidden = true; }));
  budgetModal.addEventListener("click", (e) => { if (e.target === budgetModal) budgetModal.hidden = true; });

  yearSelect.addEventListener("change", () => loadBudgetForm(yearSelect.value, monthSelect.value));
  monthSelect.addEventListener("change", () => loadBudgetForm(yearSelect.value, monthSelect.value));

  async function loadBudgetForm(year, month) {
    try {
      const data = await apiFetch(`/api/budget?year=${year}&month=${month}`);
      amountInput.value = data.budget || "";
      message.textContent = data.budget > 0
        ? `已使用 ¥${formatNumber(data.spent)} / ¥${formatNumber(data.budget)} (${data.percent_used}%)`
        : "该月份尚未设置预算";
      message.className = "form-message";
    } catch {
      amountInput.value = "";
      message.textContent = "加载预算数据失败";
      message.className = "form-message error";
    }
  }

  saveButton.addEventListener("click", async () => {
    const year = Number(yearSelect.value);
    const month = Number(monthSelect.value);
    const amount = Number(amountInput.value);
    if (!amount || amount < 0) {
      message.textContent = "请输入有效的预算金额";
      message.className = "form-message error";
      return;
    }
    saveButton.disabled = true;
    try {
      await apiFetch("/api/budget", { method: "PUT", body: { year, month, amount } });
      message.textContent = `预算已保存：${year}年${month}月 ¥${formatNumber(amount)}`;
      message.className = "form-message success";
      loadBudgetStatusBar();
    } catch (error) {
      message.textContent = `保存失败：${error.message}`;
      message.className = "form-message error";
    } finally {
      saveButton.disabled = false;
    }
  });
}

async function loadBudgetStatusBar() {
  const bar = document.querySelector("[data-budget-status]");
  if (!bar) return;
  try {
    const now = new Date();
    const data = await apiFetch(`/api/budget?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
    if (data.budget <= 0) { bar.hidden = true; return; }
    bar.hidden = false;
    document.querySelector("[data-budget-summary]").textContent =
      `¥${formatNumber(data.spent)} / ¥${formatNumber(data.budget)} (${data.percent_used}%)`;
    const fill = document.querySelector("[data-budget-progress]");
    fill.style.width = `${Math.min(data.percent_used, 100)}%`;
    fill.style.background = data.percent_used >= 95 ? "#dc2626"
      : data.percent_used >= 80 ? "#f59e0b"
      : "var(--primary)";
  } catch { bar.hidden = true; }
}

function bindExtraActions() {
  document.querySelector('[data-alert-close]')?.addEventListener('click', () => {
    document.querySelector('[data-alert-bar]').hidden = true;
  });

  document.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => exportCSV(btn.dataset.export));
  });

  document.querySelector('[data-open-backup]')?.addEventListener('click', openBackupModal);
  document.querySelectorAll('[data-close-backup]').forEach(b => b.addEventListener('click', closeBackupModal));
  document.querySelector('[data-create-backup]')?.addEventListener('click', createBackup);
  const backupModalEl = document.querySelector('[data-backup-modal]');
  backupModalEl?.addEventListener('click', e => {
    if (e.target === backupModalEl) closeBackupModal();
  });

  document.querySelector('[data-open-pos]')?.addEventListener('click', openPOSModal);
  document.querySelectorAll('[data-close-pos]').forEach(b => b.addEventListener('click', closePOSModal));
  const posModal = document.querySelector('[data-pos-modal]');
  posModal?.addEventListener('click', e => { if (e.target === posModal) closePOSModal(); });
  document.querySelector('[data-pos-confirm]')?.addEventListener('click', submitPOS);
  document.querySelector('[data-pos-qty-up]')?.addEventListener('click', () => {
    const inp = document.querySelector('[data-pos-qty]');
    inp.value = (Number(inp.value) || 0) + 1;
  });
  document.querySelector('[data-pos-qty-down]')?.addEventListener('click', () => {
    const inp = document.querySelector('[data-pos-qty]');
    const v = (Number(inp.value) || 0) - 1;
    inp.value = v >= 0.1 ? v : 0.1;
  });

  bindBudgetModal();
  openStaffWorkspaceButton?.addEventListener("click", openStaffWorkspace);
  closeStaffWorkspaceButtons.forEach(b => b.addEventListener("click", closeStaffWorkspace));
  staffWorkspaceModal?.addEventListener("click", e => {
    if (e.target === staffWorkspaceModal) closeStaffWorkspace();
  });
  document.querySelector("[data-staff-open-pos]")?.addEventListener("click", () => {
    closeStaffWorkspace();
    openPOSModal();
  });
  document.querySelector("[data-staff-open-storage]")?.addEventListener("click", () => {
    closeStaffWorkspace();
    document.querySelector(".nav-link:nth-child(3)")?.click();
  });
  document.querySelector("[data-staff-open-agent]")?.addEventListener("click", () => {
    closeStaffWorkspace();
    document.querySelector(".nav-link:nth-child(5)")?.click();
    agentInput?.focus();
  });
}

function openStaffWorkspace() {
  if (staffWorkspaceModal) staffWorkspaceModal.hidden = false;
}

function closeStaffWorkspace() {
  if (staffWorkspaceModal) staffWorkspaceModal.hidden = true;
}
