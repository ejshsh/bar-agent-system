const fs = require("fs");
const assert = require("assert");

const script = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert(script.includes("fetch(`${API_BASE_URL}/api/dashboard`)"));
assert(script.includes("renderDashboard"));
assert(script.includes("setApiStatus(\"演示数据\""));
assert(script.includes("setLiveSummaryForDashboard"));
assert(script.includes("setFallbackSummary"));
assert(script.includes("escapeHtml"));
assert(html.includes("data-api-status"));
assert(html.includes("data-live-summary"));
assert(html.includes("data-metric=\"low_stock_count\""));

console.log("frontend checks passed");
