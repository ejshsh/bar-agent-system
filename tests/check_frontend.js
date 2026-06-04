const fs = require("fs");
const assert = require("assert");

const script = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert(script.includes("fetch(`${API_BASE_URL}/api/dashboard`)"));
assert(script.includes("renderDashboard"));
assert(script.includes("setApiStatus(\"演示数据\""));
assert(script.includes("setLiveSummaryForDashboard"));
assert(script.includes("setFallbackSummary"));
assert(script.includes("submitPurchaseOrder"));
assert(script.includes("fetch(`${API_BASE_URL}/api/purchase-orders`"));
assert(script.includes("resolveProductId"));
assert(script.includes("resolveSupplierId"));
assert(script.includes("postJson(\"/api/products\""));
assert(script.includes("postJson(\"/api/suppliers\""));
assert(script.includes("deleteSelectedProduct"));
assert(script.includes("deleteSelectedSupplier"));
assert(script.includes("method: \"DELETE\""));
assert(script.includes("escapeHtml"));
assert(html.includes("data-api-status"));
assert(html.includes("data-live-summary"));
assert(html.includes("data-purchase-modal"));
assert(html.includes("data-purchase-form"));
assert(html.includes("new_product_name"));
assert(html.includes("new_supplier_name"));
assert(html.includes("data-mode-toggle=\"product\""));
assert(html.includes("data-delete-product"));
assert(html.includes("data-delete-supplier"));
assert(html.includes("data-metric=\"low_stock_count\""));

console.log("frontend checks passed");
