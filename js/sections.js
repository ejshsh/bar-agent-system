/* ───────── Inventory section ───────── */

function renderInventory(dashboard) {
  inventoryFullData = {
    lowStock: dashboard.inventory_alerts?.low_stock || [],
    overstock: dashboard.inventory_alerts?.overstock || [],
    replenishment: dashboard.replenishment || [],
  };
  const allProducts = [...inventoryFullData.lowStock, ...inventoryFullData.overstock];
  const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
  const catSelect = inventoryFilterCategory;
  if (catSelect) {
    const currentVal = catSelect.value;
    catSelect.innerHTML = '<option value="all">全部分类</option>' +
      categories.map(c => `<option value="${c}">${c}</option>`).join("");
    catSelect.value = currentVal;
  }
  applyInventoryFilters();
}

function applyInventoryFilters() {
  const searchVal = (inventorySearch?.value || "").trim().toLowerCase();
  const stockFilter = inventoryFilterStock?.value || "all";
  const catFilter = inventoryFilterCategory?.value || "all";

  let items = [];
  inventoryFullData.lowStock.forEach(item => {
    if (stockFilter === "overstock") return;
    if (!item.name.toLowerCase().includes(searchVal)) return;
    if (catFilter !== "all" && item.category !== catFilter) return;
    items.push({ kicker: "快缺货", item, link: "生成采购建议" });
  });
  inventoryFullData.overstock.forEach(item => {
    if (stockFilter === "low") return;
    if (!item.name.toLowerCase().includes(searchVal)) return;
    if (catFilter !== "all" && item.category !== catFilter) return;
    items.push({ kicker: "库存积压", item, link: "查看活动方案" });
  });

  if (items.length === 0 && stockFilter === "all" && catFilter === "all" && !searchVal) {
    const r = inventoryFullData.replenishment[0];
    if (r) {
      inventoryAlerts.innerHTML = renderUtilityCard({
        kicker: "补货建议",
        title: r.product_name,
        body: `建议采购 ${r.suggested_quantity}，原因：${r.reason}`,
        link: "生成采购单"
      });
      return;
    }
  }

  inventoryAlerts.innerHTML = items.length
    ? items.map(({ kicker, item, link }) => renderUtilityCard({
        kicker,
        title: item.name,
        body: kicker === "快缺货"
          ? `当前库存 ${formatNumber(item.current_stock)} ${item.unit || ""}，安全库存 ${formatNumber(item.safety_stock)}，建议优先补货。`
          : `当前库存 ${formatNumber(item.current_stock)} ${item.unit || ""}，高于安全库存，适合做组合活动。`,
        link
      })).join("")
    : '<p class="form-message" style="grid-column:1/-1;">没有匹配的酒水。</p>';
}

/* ───────── Storage section ───────── */

function renderStorage(records) {
  currentStorageRecords = records;
  applyStorageFilters();
}

function applyStorageFilters() {
  const searchVal = (storageSearch?.value || "").trim().toLowerCase();
  const expiryFilter = storageFilterExpiry?.value || "all";

  const filtered = currentStorageRecords.filter(item => {
    if (searchVal) {
      const nameMatch = item.customer_name.toLowerCase().includes(searchVal);
      const phoneMatch = (item.phone || '').includes(searchVal);
      if (!nameMatch && !phoneMatch) return false;
    }
    if (expiryFilter !== "all" && item.days_until_expiry > parseInt(expiryFilter)) return false;
    return true;
  });

  if (!filtered.length) {
    storageList.innerHTML = '<p class="form-message">没有匹配的存酒记录。</p>';
    return;
  }

  storageList.innerHTML = filtered.map((item, index) => {
    const dotClass = index === 0 ? "urgent" : "";
    return `
      <article class="storage-item">
        <span class="status-dot ${dotClass}"></span>
        <input type="checkbox" data-storage-checkbox="${item.id}" style="align-self:center;width:16px;height:16px;cursor:pointer;" ${selectedStorageIds.has(item.id) ? 'checked' : ''}>
        <div>
          <h3>${escapeHtml(item.customer_name)} · ${escapeHtml(item.product_name)}</h3>
          <p>${item.phone ? '📞 ' + escapeHtml(item.phone) + ' ｜ ' : ''}剩余 ${formatNumber(item.remaining_quantity)}，${item.days_until_expiry} 天后到期${item.days_until_expiry <= 7 ? ' 即将到期' : ''}。</p>
        </div>
        <div class="row-actions">
          <button class="button secondary small" type="button" data-pickup-storage="${item.id}">取酒</button>
          <button class="button secondary small" type="button" data-edit-storage="${item.id}">编辑</button>
          <button class="button danger small" type="button" data-delete-storage="${item.id}">删除</button>
        </div>
      </article>
    `;
  }).join("");
  removeStorageBatchBar();
  renderStorageBatchBar();
  bindStorageCheckboxes();
  bindStorageRowActions();
}

function bindStorageRowActions() {
  document.querySelectorAll("[data-pickup-storage]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = currentStorageRecords.find((item) => String(item.id) === button.dataset.pickupStorage);
      if (record) openPickupModal(record);
    });
  });

  document.querySelectorAll("[data-edit-storage]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = currentStorageRecords.find((item) => String(item.id) === button.dataset.editStorage);
      if (record) openStorageModal(record);
    });
  });

  document.querySelectorAll("[data-delete-storage]").forEach((button) => {
    button.addEventListener("click", () => deleteCustomerStorage(button.dataset.deleteStorage));
  });
}

/* ───────── Suppliers section ───────── */

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

/* ───────── Activities section ───────── */

const ACTIVITY_CONFIG = {
  clearance: { icon: "🏷️", type: "库存清理", color: "#ff9500", metrics: [{ label: "目标消化", value: "40% 积压库存", cls: "warning" }, { label: "预计毛利", value: "≥ 42%", cls: "positive" }, { label: "时间窗口", value: "14 天" }] },
  recall: { icon: "📣", type: "客户召回", color: "#2997ff", metrics: [{ label: "可召回客户", value: "23 位", cls: "" }, { label: "到期间隔", value: "≤ 7 天", cls: "danger" }, { label: "预计到店", value: "12-15 人" }] },
  bundle: { icon: "🎯", type: "高毛利搭售", color: "#34c759", metrics: [{ label: "目标毛利率", value: "≥ 50%", cls: "positive" }, { label: "桌均提升", value: "¥80-120", cls: "positive" }, { label: "适用品类", value: "威士忌" }] },
  new: { icon: "🆕", type: "新品推广", color: "#af52de", metrics: [{ label: "新品数量", value: "3 款", cls: "" }, { label: "试饮转化", value: "预计 25%", cls: "" }, { label: "复购券", value: "二次到店" }] },
};

function renderActivities(suggestions) {
  if (suggestions.length === 0) return;

  activitySummaries = suggestions.reduce((accumulator, item) => {
    accumulator[item.activity_key] = item;
    return accumulator;
  }, {});

  const activityList = document.querySelector("[data-activity-list]");
  if (!activityList) return;

  activityList.innerHTML = suggestions.map((item, index) => {
    const config = ACTIVITY_CONFIG[item.activity_key] || { icon: "📊", type: item.title || "活动", color: "#fff", metrics: [] };
    const metricsHtml = config.metrics.map(m =>
      `<div class="activity-metric-row"><span class="activity-metric-label">${m.label}</span><span class="activity-metric-value ${m.cls}">${m.value}</span></div>`
    ).join("");

    return `
      <button class="activity-card-new ${index === 0 ? "selected" : ""}" type="button" data-activity="${escapeHtml(item.activity_key)}">
        <span class="activity-card-icon">${config.icon}</span>
        <span class="activity-card-type">${config.type}</span>
        <strong class="activity-card-title">${escapeHtml(item.summary).slice(0, 28)}</strong>
        <div class="activity-card-metrics">${metricsHtml}</div>
      </button>`;
  }).join("");

  updateActivitySummary(suggestions[0]);
  bindActivityCards();
}

function updateActivitySummary(item) {
  const summaryEl = document.querySelector("[data-activity-summary]");
  if (!summaryEl || !item) return;

  const summaryText = summaryEl.querySelector(".activity-summary-text");
  const actionBtn = summaryEl.querySelector("[data-activity-action]");

  if (summaryText) summaryText.textContent = item.summary;
  if (actionBtn) {
    actionBtn.dataset.activityKey = item.activity_key;
    actionBtn.textContent = item.activity_key === "clearance" ? "生成清库存方案" :
      item.activity_key === "recall" ? "导出客户名单" :
      item.activity_key === "bundle" ? "查看搭配建议" :
      item.activity_key === "new" ? "创建推广计划" : "执行方案";
  }
}

function bindActivityCards() {
  document.querySelectorAll(".activity-card-new").forEach((card) => {
    card.addEventListener("click", () => {
      const key = card.dataset.activity;
      const item = activitySummaries[key];
      if (!item) return;
      document.querySelectorAll(".activity-card-new").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      updateActivitySummary(item);
    });
  });

  // Action button handler
  const actionBtn = document.querySelector("[data-activity-action]");
  if (actionBtn && !actionBtn.dataset.bound) {
    actionBtn.dataset.bound = "true";
    actionBtn.addEventListener("click", () => {
      const key = actionBtn.dataset.activityKey;
      if (key === "recall") {
        document.querySelector(".nav-link:nth-child(3)")?.click();
      } else if (key === "clearance" || key === "bundle") {
        document.querySelector(".nav-link:nth-child(5)")?.click();
        const agentInput = document.querySelector("[data-agent-input]");
        if (agentInput) {
          agentInput.value = key === "clearance" ? "帮我制定库存清理方案" : "推荐高毛利搭售组合";
          agentInput.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        openReportModal();
      }
    });
  }
}

/* ───────── Batch storage operations ───────── */

function removeStorageBatchBar() {
  const old = document.querySelector('[data-storage-batch-bar]');
  if (old) old.remove();
}

function renderStorageBatchBar() {
  const bar = document.createElement('div');
  bar.dataset.storageBatchBar = '';
  bar.className = 'batch-bar';

  const selectAll = document.createElement('input');
  selectAll.type = 'checkbox';
  selectAll.id = 'storage-select-all';

  const label = document.createElement('label');
  label.htmlFor = 'storage-select-all';
  label.textContent = '全选';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'button danger small';
  deleteBtn.textContent = '删除选中';
  deleteBtn.hidden = true;

  bar.append(selectAll, label, deleteBtn);
  storageList.parentNode.insertBefore(bar, storageList);

  selectAll.addEventListener('change', () => {
    const checked = selectAll.checked;
    selectedStorageIds.clear();
    document.querySelectorAll('[data-storage-checkbox]').forEach(cb => {
      cb.checked = checked;
      if (checked) selectedStorageIds.add(Number(cb.dataset.storageCheckbox));
    });
    updateBatchDeleteButton();
  });

  deleteBtn.addEventListener('click', batchDeleteStorage);
}

function bindStorageCheckboxes() {
  document.querySelectorAll('[data-storage-checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = Number(cb.dataset.storageCheckbox);
      if (cb.checked) selectedStorageIds.add(id);
      else selectedStorageIds.delete(id);
      updateBatchDeleteButton();
    });
  });
  updateBatchDeleteButton();
}

function updateBatchDeleteButton() {
  const bar = document.querySelector('[data-storage-batch-bar]');
  if (!bar) return;
  const btn = bar.querySelector('.button.danger');
  if (!btn) return;
  btn.hidden = selectedStorageIds.size === 0;
  btn.textContent = `删除选中 (${selectedStorageIds.size})`;
}

async function batchDeleteStorage() {
  if (selectedStorageIds.size === 0) return;
  if (!confirm(`确认删除选中的 ${selectedStorageIds.size} 条存酒记录吗？`)) return;

  try {
    await apiFetch("/api/customer-storage/batch-delete", {
      method: "POST",
      body: { ids: [...selectedStorageIds] }
    });
    selectedStorageIds.clear();
    await loadDashboard();
  } catch (err) {
    showToast(`批量删除失败：${err.message}`, "error");
  }
}

/* ───────── CSV Export ───────── */

const CSV_CONFIG = {
  'products': { headers: ['id', '名称', '分类', '当前库存', '安全库存', '单位'], fields: ['id', 'name', 'category', 'current_stock', 'safety_stock', 'unit'] },
  'suppliers': { headers: ['id', '名称', '稳定分', '交付天数'], fields: ['id', 'name', 'price_stability_score', 'average_delivery_days'] },
  'customer-storage': { headers: ['id', '客户姓名', '存酒名称', '剩余量', '到期天数'], fields: ['id', 'customer_name', 'product_name', 'remaining_quantity', 'days_until_expiry'] },
  'sales-records': { headers: ['id', '酒水ID', '数量', '销售日期'], fields: ['id', 'product_id', 'quantity', 'sale_date'] },
  'purchase-orders': { headers: ['id', '酒水ID', '供应商ID', '数量', '单价', '采购日期'], fields: ['id', 'product_id', 'supplier_id', 'quantity', 'unit_price', 'order_date'] },
  'inventory-records': { headers: ['id', '酒水ID', '类型', '变化量', '变化后', '原因', '日期'], fields: ['id', 'product_id', 'record_type', 'quantity_change', 'quantity_after', 'reason', 'occurred_at'] },
};

function downloadCSV(filename, headers, fields, rows) {
  const BOM = '﻿';
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      fields.map(f => {
        const val = row[f] ?? '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportCSV(type) {
  const endpointMap = {
    'products': '/api/products',
    'suppliers': '/api/suppliers',
    'customer-storage': '/api/customer-storage',
    'sales-records': '/api/sales-records',
    'purchase-orders': '/api/purchase-orders',
    'inventory-records': '/api/inventory-records',
  };
  const cfg = CSV_CONFIG[type];
  if (!cfg) return;
  const filename = `${type}_${new Date().toISOString().slice(0, 10)}.csv`;

  try {
    const data = await apiFetch(endpointMap[type]);
    downloadCSV(filename, cfg.headers, cfg.fields, data.items || []);
  } catch (err) {
    showToast(`导出失败：${err.message}`, "error");
  }
}

/* ───────── Chart functions ───────── */

let chartInstances = {};

function destroyCharts() {
  Object.values(chartInstances).forEach(c => c?.destroy());
  chartInstances = {};
}

function renderCharts(data) {
  destroyCharts();

  const colors = ["#0066cc", "#2997ff", "#5ac8fa", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#ff2d55", "#5856d6", "#00c7be"];
  const defaultFont = { family: "'SF Pro Text', system-ui, sans-serif", size: 13 };

  const trendCtx = document.getElementById("chart-purchase-trend");
  if (trendCtx && data.purchase_trend?.length) {
    chartInstances.purchaseTrend = new Chart(trendCtx, {
      type: "line",
      data: {
        labels: data.purchase_trend.map(d => d.month),
        datasets: [{
          label: "采购金额 (¥)",
          data: data.purchase_trend.map(d => d.amount),
          borderColor: "#0066cc",
          backgroundColor: "rgba(0, 102, 204, 0.08)",
          borderWidth: 2, fill: true, tension: 0.3,
          pointRadius: 4, pointBackgroundColor: "#0066cc",
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: defaultFont },
          y: { ticks: { ...defaultFont, callback: v => `¥${v}` } }
        }
      }
    });
  }

  const topCtx = document.getElementById("chart-top-products");
  if (topCtx && data.top_products?.length) {
    chartInstances.topProducts = new Chart(topCtx, {
      type: "bar",
      data: {
        labels: data.top_products.map(d => d.name),
        datasets: [{
          label: "销量", data: data.top_products.map(d => d.quantity),
          backgroundColor: data.top_products.map((_, i) => colors[i % colors.length]),
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true, indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: { x: { ticks: defaultFont }, y: { ticks: { ...defaultFont } } }
      }
    });
  }

  const catCtx = document.getElementById("chart-category");
  if (catCtx && data.category_distribution?.length) {
    chartInstances.category = new Chart(catCtx, {
      type: "doughnut",
      data: {
        labels: data.category_distribution.map(d => d.category),
        datasets: [{
          data: data.category_distribution.map(d => d.count),
          backgroundColor: colors.slice(0, data.category_distribution.length),
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { position: "bottom", labels: { ...defaultFont, padding: 12 } } }
      }
    });
  }

  const stockCtx = document.getElementById("chart-stock-status");
  if (stockCtx && data.stock_status) {
    const ss = data.stock_status;
    const labels = [], values = [], chartColors = [];
    if (ss.low_stock > 0) { labels.push("快缺货"); values.push(ss.low_stock); chartColors.push("#ff3b30"); }
    if (ss.normal > 0) { labels.push("正常"); values.push(ss.normal); chartColors.push("#34c759"); }
    if (ss.overstock > 0) { labels.push("积压"); values.push(ss.overstock); chartColors.push("#ff9500"); }

    chartInstances.stockStatus = new Chart(stockCtx, {
      type: "doughnut",
      data: { labels, datasets: [{ data: values, backgroundColor: chartColors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: true, cutout: "65%",
        plugins: { legend: { position: "bottom", labels: { ...defaultFont, padding: 12 } } }
      }
    });
  }
}

async function loadChartData() {
  try {
    const data = await apiFetch("/api/chart-data");
    renderCharts(data);
  } catch (error) {
    console.error("加载图表数据失败:", error.message);
    document.querySelectorAll(".chart-container").forEach(el => {
      el.innerHTML = '<p style="color:var(--ink-muted);text-align:center;padding:40px 0;">暂无数据</p>';
    });
  }
}

/* ───────── Replenishment badge ───────── */

async function updateReplenishmentBadge() {
  const badge = document.querySelector("[data-replenishment-badge]");
  if (!badge) return;
  try {
    const dashboard = await apiFetch("/api/dashboard");
    const count = (dashboard.replenishment || []).length;
    if (count > 0) {
      badge.textContent = count;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  } catch (_) {
    badge.hidden = true;
  }
}

/* ───────── Procurement statistics ───────── */

let procurementChartInstances = {};
let procurementFullData = { orders: [], products: [], suppliers: [], chartData: null };

function destroyProcurementCharts() {
  Object.values(procurementChartInstances).forEach(c => c?.destroy());
  procurementChartInstances = {};
}

async function loadProcurementData() {
  try {
    const [ordersData, productsData, suppliersData, chartData] = await Promise.all([
      apiFetch("/api/purchase-orders"),
      apiFetch("/api/products"),
      apiFetch("/api/suppliers"),
      apiFetch("/api/chart-data")
    ]);

    const orders = ordersData.items || [];
    const products = productsData.items || [];
    const suppliers = suppliersData.items || [];

    procurementFullData = { orders, products, suppliers, chartData };

    const supplierSelect = document.querySelector('[data-procurement-filter-supplier]');
    if (supplierSelect) {
      const currentVal = supplierSelect.value;
      supplierSelect.innerHTML = '<option value="all">全部供应商</option>' +
        suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      supplierSelect.value = currentVal;
    }

    applyProcurementFilters();
  } catch (err) {
    console.error("加载采购统计失败:", err.message);
  }
}

function applyProcurementFilters() {
  const { orders, products, suppliers, chartData } = procurementFullData;
  if (!orders.length && !products.length) return;

  const searchVal = (document.querySelector('[data-procurement-search]')?.value || '').trim().toLowerCase();
  const monthStart = document.querySelector('[data-procurement-month-start]')?.value || '';
  const monthEnd = document.querySelector('[data-procurement-month-end]')?.value || '';
  const supplierFilter = document.querySelector('[data-procurement-filter-supplier]')?.value || 'all';

  const pMap = Object.fromEntries(products.map(p => [p.id, p]));
  const sMap = Object.fromEntries(suppliers.map(s => [s.id, s]));

  let filtered = orders;
  if (searchVal) {
    filtered = filtered.filter(o => {
      const pName = (pMap[o.product_id]?.name || '').toLowerCase();
      const sName = (sMap[o.supplier_id]?.name || '').toLowerCase();
      return pName.includes(searchVal) || sName.includes(searchVal);
    });
  }
  if (monthStart) filtered = filtered.filter(o => (o.order_date || '') >= monthStart);
  if (monthEnd) filtered = filtered.filter(o => (o.order_date || '') <= monthEnd + '-31');
  if (supplierFilter !== 'all') filtered = filtered.filter(o => String(o.supplier_id) === supplierFilter);

  renderProcurementStats(filtered);
  renderProcurementTable(filtered, products, suppliers);
  renderProcurementCharts(filtered, products, suppliers, chartData);
}

function resetProcurementFilters() {
  const search = document.querySelector('[data-procurement-search]');
  const monthStart = document.querySelector('[data-procurement-month-start]');
  const monthEnd = document.querySelector('[data-procurement-month-end]');
  const supplier = document.querySelector('[data-procurement-filter-supplier]');
  if (search) search.value = '';
  if (monthStart) monthStart.value = '';
  if (monthEnd) monthEnd.value = '';
  if (supplier) supplier.value = 'all';
  applyProcurementFilters();
}

function bindProcurementFilters() {
  document.querySelector('[data-procurement-search]')?.addEventListener('input', applyProcurementFilters);
  document.querySelector('[data-procurement-month-start]')?.addEventListener('change', applyProcurementFilters);
  document.querySelector('[data-procurement-month-end]')?.addEventListener('change', applyProcurementFilters);
  document.querySelector('[data-procurement-filter-supplier]')?.addEventListener('change', applyProcurementFilters);
  document.querySelector('[data-procurement-reset-filters]')?.addEventListener('click', resetProcurementFilters);
}

function renderProcurementStats(orders) {
  let totalSpend = 0, totalQty = 0, priceSum = 0, priceCount = 0;
  const supplierIds = new Set();

  orders.forEach(o => {
    const total = (o.quantity || 0) * (o.unit_price || 0);
    totalSpend += total;
    totalQty += o.quantity || 0;
    if (o.unit_price) { priceSum += o.unit_price; priceCount++; }
    if (o.supplier_id) supplierIds.add(o.supplier_id);
  });

  document.querySelector('[data-pstat="total_spend"]').textContent = totalSpend.toFixed(0);
  document.querySelector('[data-pstat="order_count"]').textContent = orders.length;
  document.querySelector('[data-pstat="total_quantity"]').textContent = totalQty.toFixed(0);
  document.querySelector('[data-pstat="avg_price"]').textContent = priceCount > 0 ? (priceSum / priceCount).toFixed(1) : '—';
  document.querySelector('[data-pstat="supplier_count"]').textContent = supplierIds.size;
}

function renderProcurementTable(orders, products, suppliers) {
  const container = document.querySelector('[data-procurement-table]');
  if (!orders.length) {
    container.innerHTML = '<div class="supplier-row header" role="row"><span>采购日期</span><span>商品名称</span><span>供应商</span><span>数量</span><span>单价 (¥)</span><span>总金额 (¥)</span><span>操作</span></div><div class="supplier-row" role="row"><span style="grid-column:1/-1;text-align:center;color:var(--ink-muted);">暂无采购记录。</span></div>';
    return;
  }

  const pMap = Object.fromEntries(products.map(p => [p.id, p]));
  const sMap = Object.fromEntries(suppliers.map(s => [s.id, s]));

  const rows = orders.map(o => {
    const product = pMap[o.product_id];
    const supplier = sMap[o.supplier_id];
    const total = (o.quantity || 0) * (o.unit_price || 0);
    return `<div class="supplier-row procurement-row" role="row">
      <span>${escapeHtml(o.order_date || '—')}</span>
      <span>${escapeHtml(product?.name || `商品#${o.product_id}`)}</span>
      <span>${escapeHtml(supplier?.name || `供应商#${o.supplier_id}`)}</span>
      <span>${formatNumber(o.quantity)}</span>
      <span>¥ ${formatNumber(o.unit_price)}</span>
      <span>¥ ${total.toFixed(0)}</span>
      <span><button class="button danger small" type="button" data-delete-purchase="${o.id}">删除</button></span>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="supplier-row header" role="row"><span>采购日期</span><span>商品名称</span><span>供应商</span><span>数量</span><span>单价 (¥)</span><span>总金额 (¥)</span><span>操作</span></div>${rows}`;

  document.querySelectorAll('[data-delete-purchase]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deletePurchase;
      if (!confirm(`确认删除采购单 #${id} 吗？`)) return;
      try {
        await apiFetch(`/api/purchase-orders/${id}`, { method: "DELETE" });
        await loadProcurementData();
      } catch (err) {
        showToast(`删除失败：${err.message}`, "error");
      }
    });
  });
}

function renderProcurementCharts(orders, products, suppliers, chartData) {
  destroyProcurementCharts();

  const colors = ["#0066cc", "#2997ff", "#5ac8fa", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#ff2d55", "#5856d6", "#00c7be"];
  const defaultFont = { family: "'SF Pro Text', system-ui, sans-serif", size: 13 };

  const trendCtx = document.getElementById("chart-proc-trend");
  if (trendCtx && chartData.purchase_trend?.length) {
    procurementChartInstances.trend = new Chart(trendCtx, {
      type: "line",
      data: {
        labels: chartData.purchase_trend.map(d => d.month),
        datasets: [{
          label: "采购金额 (¥)", data: chartData.purchase_trend.map(d => d.amount),
          borderColor: "#0066cc", backgroundColor: "rgba(0, 102, 204, 0.08)",
          borderWidth: 2, fill: true, tension: 0.3,
          pointRadius: 4, pointBackgroundColor: "#0066cc",
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: defaultFont }, y: { ticks: { ...defaultFont, callback: v => `¥${v}` } } }
      }
    });
  }

  const sCtx = document.getElementById("chart-proc-supplier");
  if (sCtx) {
    const sMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
    const bySupplier = {};
    orders.forEach(o => {
      const name = sMap[o.supplier_id] || `供应商#${o.supplier_id}`;
      bySupplier[name] = (bySupplier[name] || 0) + (o.quantity || 0);
    });
    const sLabels = Object.keys(bySupplier);
    if (sLabels.length) {
      procurementChartInstances.supplier = new Chart(sCtx, {
        type: "doughnut",
        data: {
          labels: sLabels,
          datasets: [{ data: Object.values(bySupplier), backgroundColor: colors.slice(0, sLabels.length), borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { position: "bottom", labels: { ...defaultFont, padding: 12 } } }
        }
      });
    }
  }

  const pCtx = document.getElementById("chart-proc-product");
  if (pCtx) {
    const pMap = Object.fromEntries(products.map(p => [p.id, p.name]));
    const byProduct = {};
    orders.forEach(o => {
      const name = pMap[o.product_id] || `商品#${o.product_id}`;
      byProduct[name] = (byProduct[name] || 0) + (o.quantity || 0);
    });
    const pLabels = Object.keys(byProduct);
    if (pLabels.length) {
      procurementChartInstances.product = new Chart(pCtx, {
        type: "bar",
        data: {
          labels: pLabels,
          datasets: [{
            label: "采购数量", data: Object.values(byProduct),
            backgroundColor: pLabels.map((_, i) => colors[i % colors.length]), borderRadius: 4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: true, indexAxis: "y",
          plugins: { legend: { display: false } },
          scales: { x: { ticks: defaultFont }, y: { ticks: { ...defaultFont } } }
        }
      });
    }
  }

  const mCtx = document.getElementById("chart-proc-monthly");
  if (mCtx) {
    const byMonth = {};
    orders.forEach(o => {
      const month = (o.order_date || "").slice(0, 7);
      if (!month) return;
      byMonth[month] = (byMonth[month] || 0) + (o.quantity || 0) * (o.unit_price || 0);
    });
    const mLabels = Object.keys(byMonth).sort();
    if (mLabels.length) {
      procurementChartInstances.monthly = new Chart(mCtx, {
        type: "bar",
        data: {
          labels: mLabels,
          datasets: [{ label: "采购金额 (¥)", data: mLabels.map(m => byMonth[m]), backgroundColor: "#0066cc", borderRadius: 4 }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: { x: { ticks: defaultFont }, y: { ticks: { ...defaultFont, callback: v => `¥${v}` } } }
        }
      });
    }
  }
}

/* ───────── Profit analysis ───────── */

let profitChartInstance = null;

async function loadProfitData() {
  try {
    const data = await apiFetch("/api/chart-data");
    const profit = data.profit_analysis;
    if (!profit) {
      document.querySelector('[data-profit-table]').innerHTML = '<div class="supplier-row" role="row"><span style="grid-column:1/-1;text-align:center;color:var(--ink-muted);">暂无利润数据。</span></div>';
      return;
    }
    renderProfitStats(profit);
    renderProfitTable(profit);
    renderProfitChart(profit);
  } catch (err) {
    console.error("加载利润数据失败:", err.message);
  }
}

function renderProfitStats(profit) {
  document.querySelector('[data-pstat="revenue"]').textContent = profit.total_revenue.toFixed(0);
  document.querySelector('[data-pstat="cost"]').textContent = profit.total_cost.toFixed(0);
  document.querySelector('[data-pstat="profit"]').textContent = profit.total_profit.toFixed(0);
  document.querySelector('[data-pstat="margin"]').textContent = profit.overall_margin + '%';
}

function renderProfitTable(profit) {
  const container = document.querySelector('[data-profit-table]');
  const margins = profit.product_margins || [];
  if (!margins.length) {
    container.innerHTML = '<div class="supplier-row header" role="row"><span>商品名称</span><span>营收 (¥)</span><span>成本 (¥)</span><span>毛利 (¥)</span><span>毛利率</span></div><div class="supplier-row" role="row"><span style="grid-column:1/-1;text-align:center;color:var(--ink-muted);">暂无销售数据。</span></div>';
    return;
  }

  const rows = margins.map(p => {
    const marginColor = p.margin >= 50 ? '#34c759' : p.margin >= 20 ? '#ff9500' : '#ff3b30';
    return `<div class="supplier-row" role="row">
      <span><strong>${escapeHtml(p.name)}</strong></span>
      <span>¥ ${formatNumber(p.revenue)}</span>
      <span>¥ ${formatNumber(p.cost)}</span>
      <span>¥ ${formatNumber(p.profit)}</span>
      <span style="color:${marginColor};font-weight:600;">${p.margin}%</span>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="supplier-row header" role="row"><span>商品名称</span><span>营收 (¥)</span><span>成本 (¥)</span><span>毛利 (¥)</span><span>毛利率</span></div>${rows}`;
}

function renderProfitChart(profit) {
  if (profitChartInstance) { profitChartInstance.destroy(); profitChartInstance = null; }

  const trend = profit.profit_trend || [];
  if (!trend.length) return;

  const ctx = document.getElementById('chart-profit-trend');
  if (!ctx) return;

  const defaultFont = { family: "'SF Pro Text', system-ui, sans-serif", size: 13 };

  profitChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.map(d => d.month),
      datasets: [
        {
          label: '营收 (¥)', data: trend.map(d => d.revenue),
          borderColor: '#34c759', backgroundColor: 'rgba(52, 199, 89, 0.08)',
          borderWidth: 2, fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#34c759',
        },
        {
          label: '成本 (¥)', data: trend.map(d => d.cost),
          borderColor: '#ff9500', backgroundColor: 'rgba(255, 149, 0, 0.08)',
          borderWidth: 2, fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#ff9500',
        },
        {
          label: '毛利 (¥)', data: trend.map(d => d.profit),
          borderColor: '#0066cc', backgroundColor: 'rgba(0, 102, 204, 0.08)',
          borderWidth: 2, fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#0066cc',
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { ...defaultFont, padding: 12 } } },
      scales: { x: { ticks: defaultFont }, y: { ticks: { ...defaultFont, callback: v => `¥${v}` } } }
    }
  });
}
