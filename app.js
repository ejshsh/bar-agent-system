const navLinks = document.querySelectorAll(".nav-link");
const agentQuestions = document.querySelectorAll(".agent-question");
const activityCards = document.querySelectorAll(".activity-card");

const agentTitle = document.querySelector("#agent-title");
const agentBody = document.querySelector("#agent-body");
const agentAction = document.querySelector("#agent-action");
const activitySummary = document.querySelector("#activity-summary");

const agentAnswers = {
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

const activitySummaries = {
  clearance: "当前方案建议将荔枝味预调酒与热销啤酒组合，控制折扣后毛利率不低于 42%，目标是在 14 天内消化 40% 积压库存。",
  recall: "当前方案建议邀请 23 位临期存酒客户参加会员夜，优先触达剩余酒量较多且 45 天内未到店客户。",
  bundle: "当前方案建议用高毛利威士忌搭配小食和调酒券，保持桌均消费提升，同时避免直接打折损伤价格感。",
  new: "当前方案建议围绕龙舌兰新品设计试饮主题夜，搭配限时首杯价和二次到店券，积累新品销售数据。"
};

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

agentQuestions.forEach((question) => {
  question.addEventListener("click", () => {
    const key = question.dataset.question;
    const answer = agentAnswers[key];

    if (!answer) {
      return;
    }

    agentQuestions.forEach((item) => item.classList.remove("active"));
    question.classList.add("active");
    agentTitle.textContent = answer.title;
    agentBody.textContent = answer.body;
    agentAction.textContent = answer.action;
  });
});

activityCards.forEach((card) => {
  card.addEventListener("click", () => {
    const key = card.dataset.activity;
    const summary = activitySummaries[key];

    if (!summary) {
      return;
    }

    activityCards.forEach((item) => item.classList.remove("selected"));
    card.classList.add("selected");
    activitySummary.textContent = summary;
  });
});
