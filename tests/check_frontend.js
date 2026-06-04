const fs = require("fs");
const assert = require("assert");

const scriptFiles = [
  "js/utils.js",
  "js/dashboard.js",
  "js/sections.js",
  "js/modals.js",
  "js/agent.js",
  "app.js",
];
const script = scriptFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const html = fs.readFileSync("index.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

assert(script.includes("apiFetch(\"/api/dashboard\")"));
assert(script.includes("authHeaders"));
assert(script.includes("loginAsRole"));
assert(script.includes("apiFetch(\"/api/auth/login\""));
assert(script.includes("renderDashboard"));
assert(script.includes("setApiStatus"));
assert(script.includes("setLiveSummaryForDashboard"));
assert(script.includes("setFallbackSummary"));
assert(script.includes("submitPurchaseOrder"));
assert(script.includes("apiFetch(\"/api/purchase-orders\""));
assert(script.includes("resolveProductId"));
assert(script.includes("resolveSupplierId"));
assert(script.includes("postJson(\"/api/products\""));
assert(script.includes("postJson(\"/api/suppliers\""));
assert(script.includes("deleteResource"));
assert(script.includes("submitCustomerStorage"));
assert(script.includes("deleteCustomerStorage"));
assert(script.includes("method: storageId ? \"PUT\" : \"POST\""));
assert(script.includes("submitSalesRecord"));
assert(script.includes("apiFetch(\"/api/sales-records\""));
assert(script.includes("submitInventoryAdjustment"));
assert(script.includes("apiFetch(\"/api/inventory-adjustments\""));
assert(script.includes("syncInventoryAdjustmentMode"));
assert(script.includes("submitSupplierQuote"));
assert(script.includes("loadSupplierQuoteComparison"));
assert(script.includes("apiFetch(`/api/supplier-price-quotes?product_id="));
assert(script.includes("submitStoragePickup"));
assert(script.includes("data-pickup-storage"));
assert(script.includes("/pickup`"));
assert(script.includes("generateReport"));
assert(script.includes("saveCurrentReport"));
assert(script.includes("submitAgentQuestion"));
assert(script.includes("apiFetch(\"/api/agent-reports\""));
assert(script.includes("apiFetch(\"/api/agent-ask\""));
assert(script.includes("openStaffWorkspace"));
assert(script.includes("escapeHtml"));
assert(html.includes("data-api-status"));
assert(html.includes("data-last-refresh"));
assert(html.includes("data-ai-brief"));
assert(html.includes("js/utils.js"));
assert(html.includes("js/dashboard.js"));
assert(html.includes("js/sections.js"));
assert(html.includes("js/modals.js"));
assert(html.includes("js/agent.js"));
assert(html.includes("rel=\"manifest\""));
assert(html.includes("data-purchase-modal"));
assert(html.includes("data-purchase-form"));
assert(html.includes("new_product_name"));
assert(html.includes("new_supplier_name"));
assert(html.includes("data-show-new-product"));
assert(html.includes("data-show-new-supplier"));
assert(html.includes("data-storage-modal"));
assert(html.includes("data-storage-form"));
assert(html.includes("data-open-storage"));
assert(html.includes("data-sale-modal"));
assert(html.includes("data-sale-form"));
assert(html.includes("data-open-sale"));
assert(html.includes("data-open-inventory-adjustment"));
assert(html.includes("data-inventory-adjustment-modal"));
assert(html.includes("data-inventory-adjustment-form"));
assert(html.includes("data-open-supplier-quotes"));
assert(html.includes("data-supplier-quotes-modal"));
assert(html.includes("data-supplier-quotes-form"));
assert(html.includes("data-pickup-modal"));
assert(html.includes("data-pickup-form"));
assert(html.includes("data-report-modal"));
assert(html.includes("data-agent-input"));
assert(html.includes("data-open-staff-workspace"));
assert(html.includes("data-staff-workspace-modal"));
assert(html.includes("data-metric=\"low_stock_count\""));
assert(manifest.name);
assert(manifest.icons.every((icon) => typeof icon.src === "string"));
assert(fs.existsSync("sw.js"));

console.log("frontend checks passed");
