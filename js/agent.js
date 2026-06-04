/* ───────── Agent suggestions & questions ───────── */

function bindAgentQuestions() {
  document.querySelectorAll(".agent-question").forEach((question) => {
    question.addEventListener("click", () => {
      const key = question.dataset.question;
      const answer = agentAnswers[key];
      if (!answer) return;

      document.querySelectorAll(".agent-question").forEach((item) => item.classList.remove("active"));
      question.classList.add("active");
      renderAgentAnswer(answer);
    });
  });
}

function renderAgentAnswer(answer) {
  agentTitle.textContent = answer.title;
  agentBody.textContent = answer.body;
  agentAction.textContent = answer.action;
  agentAction.dataset.agentAction = answer.action;
}

/* ───────── Agent action button handler ───────── */

function initAgentActionButton() {
  agentAction.addEventListener("click", () => {
    const action = agentAction.dataset.agentAction || agentAction.textContent;
    if (action.includes("采购单") || action.includes("补货")) {
      purchaseModal.hidden = false;
      loadReplenishmentPanel();
      const agentSection = document.getElementById("agent");
      if (agentSection) agentSection.scrollIntoView({ behavior: "smooth" });
    } else if (action.includes("客户召回") || action.includes("存酒") || action.includes("名单")) {
      document.querySelector(".nav-link:nth-child(3)")?.click();
    } else if (action.includes("供应商") || action.includes("对比")) {
      openSupplierQuotesModal();
    } else if (action.includes("活动") || action.includes("促销")) {
      document.querySelector(".nav-link:nth-child(6)")?.click();
    } else if (action.includes("报告") || action.includes("成本")) {
      openReportModal();
    } else {
      openReportModal();
    }
  });
}

function renderAgentSuggestions(suggestions) {
  suggestions.forEach((item) => {
    if (!item.question_key) return;
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

/* ───────── Multi-turn conversation memory ───────── */

const CONVERSATION_MAX_TURNS = 10;
let conversationHistory = [];

function addConversationTurn(role, content) {
  conversationHistory.push({ role, content, timestamp: Date.now() });
  if (conversationHistory.length > CONVERSATION_MAX_TURNS * 2) {
    conversationHistory = conversationHistory.slice(-CONVERSATION_MAX_TURNS * 2);
  }
}

function detectFollowUp(question) {
  const followUpPatterns = [
    /^(那|那这|这个|它|他|她|这些|那些|还有|另外|接着|继续|再|更|详细|具体|比如|例如|为什么|怎么|如何)/,
    /^(what about|and what|how about|tell me more|why|can you|what else)/i,
    /[吗呢]$/,
    /^(然后|接下来|下一步)/,
  ];
  return conversationHistory.length > 0 && followUpPatterns.some(p => p.test(question.trim()));
}

function buildConversationContext() {
  if (conversationHistory.length === 0) return [];
  const recent = conversationHistory.slice(-6);
  return recent.map(t => `${t.role === "user" ? "用户" : "AI"}: ${t.content}`);
}

/* ───────── Agent Q&A ───────── */

async function submitAgentQuestion() {
  const question = agentInput.value.trim();
  if (!question) return;

  agentResult.hidden = false;
  agentAnswerBody.innerHTML = '<p style="color:rgba(255,255,255,0.6);">AI 分析中...</p>';

  addConversationTurn("user", question);

  const isFollowUp = detectFollowUp(question);
  const context = buildConversationContext();

  try {
    const requestBody = {
      question,
      follow_up: isFollowUp,
      conversation_history: context,
    };

    const answer = await apiFetch("/api/agent-ask", { method: "POST", body: requestBody, timeoutMs: 30000 });

    addConversationTurn("assistant", answer.answer);

    const formattedAnswer = answer.answer
      .split("\n")
      .map(line => {
        if (line.trim() === "") return "<br>";
        if (line.startsWith("- ")) return `<p style="margin:4px 0;">${escapeHtml(line)}</p>`;
        return `<p style="margin:6px 0;">${escapeHtml(line)}</p>`;
      })
      .join("");

    const modelBadge = answer.model
      ? `<p style="font-size:11px;color:var(--ink-muted);margin-top:12px;padding-top:8px;border-top:1px solid var(--hairline);">由 ${escapeHtml(answer.model)} 生成</p>`
      : '';
    const aiNote = answer.ai_note
      ? `<p style="font-size:11px;color:var(--ink-muted);margin-top:8px;">${escapeHtml(answer.ai_note)}</p>`
      : '';
    const followUpHint = isFollowUp
      ? `<p style="font-size:11px;color:var(--primary);margin-top:4px;">已关联上文对话</p>`
      : '';

    agentAnswerBody.innerHTML = formattedAnswer + followUpHint + aiNote + modelBadge;
    agentResult.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    agentAnswerBody.innerHTML = `<p class="form-message error">提问失败：${escapeHtml(error.message)}，请确认后端已启动。</p>`;
  }
}

/* ───────── Report & QA bindings ───────── */

function bindReportsAndQA() {
  initAgentActionButton();

  openReportButton.addEventListener("click", openReportModal);
  closeReportButtons.forEach(button => button.addEventListener("click", closeReportModal));
  reportModal.addEventListener("click", event => {
    if (event.target === reportModal) closeReportModal();
  });
  reportTabs.forEach(tab => {
    tab.addEventListener("click", () => switchReportTab(tab.dataset.reportTab));
  });
  generateReportBtn.addEventListener("click", generateReport);
  saveReportButton.addEventListener("click", saveCurrentReport);
  agentAskButton.addEventListener("click", submitAgentQuestion);
  agentInput.addEventListener("keydown", event => {
    if (event.key === "Enter") submitAgentQuestion();
  });

  document.querySelectorAll(".agent-question").forEach(q => {
    q.addEventListener("click", () => {
      agentInput.value = q.textContent.trim();
    });
  });
}
