const today = new Date("2026-06-20T08:00:00+08:00");

const riskWeights = {
  Low: 10,
  Medium: 24,
  High: 42,
  Critical: 60,
};

const severityWeights = {
  low: 8,
  medium: 16,
  high: 28,
};

function formatRinggit(value) {
  return `RM ${Math.round(value).toLocaleString("en-MY")}`;
}

function normalizeRisk(score) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function getClientName(client) {
  return client?.consentStatus === "Verified" ? client.name : "Consent-locked client";
}

function getClientTasks(client, tasks) {
  return tasks.filter((task) => task.clientId === client.id && task.status !== "Done");
}

export function daysSince(dateString) {
  const date = new Date(`${dateString}T00:00:00+08:00`);
  return Math.max(0, Math.round((today - date) / 86400000));
}

export function scoreClient(client, tasks) {
  const openTasks = getClientTasks(client, tasks);
  const overdueWeight = openTasks.filter((task) => task.status === "Overdue").length * 28;
  const taskSeverityWeight = openTasks.reduce((sum, task) => sum + (severityWeights[task.severity] ?? 10), 0);
  const signalWeight = client.prioritySignals.length * 12;
  const contactWeight = Math.min(daysSince(client.lastContact) * 2, 28);
  const premiumWeight = Math.min(client.annualPremium / 4000, 25);
  const gapWeight = Math.min((client.estimatedCoverageGap ?? 0) / 100000, 18);
  const propensityWeight = Math.min((client.propensity ?? 0) / 8, 12);
  const consentPenalty = client.consentStatus === "Review due" ? 16 : 0;

  return Math.round(
    overdueWeight +
      taskSeverityWeight +
      signalWeight +
      contactWeight +
      premiumWeight +
      gapWeight +
      propensityWeight +
      consentPenalty
  );
}

export function getPriorityClients(clients, tasks) {
  return [...clients]
    .map((client) => ({
      ...client,
      score: scoreClient(client, tasks),
      openTasks: getClientTasks(client, tasks).length,
    }))
    .sort((a, b) => b.score - a.score);
}

export function buildMorningBrief(clients, tasks, meetings, signals = []) {
  const verifiedClients = clients.filter((client) => client.consentStatus === "Verified");
  const lockedCount = clients.length - verifiedClients.length;
  const priority = getPriorityClients(verifiedClients, tasks)[0];
  const overdue = tasks.filter((task) => task.status === "Overdue");
  const meetingsToday = meetings.filter((meeting) => !meeting.time.toLowerCase().includes("tomorrow"));
  const highSignals = signals.filter((signal) => signal.confidence >= 90);

  return [
    `${priority.name} is the highest verified priority because of ${priority.prioritySignals[0].toLowerCase()} and ${priority.openTasks} active action item(s).`,
    `${meetingsToday.length} client meetings are scheduled today; prepare concise summaries before each appointment.`,
    `${overdue.length} overdue follow-up(s) need attention before new recommendations are issued.`,
    highSignals.length > 0
      ? `${highSignals.length} high-confidence overnight signal(s) can be converted into compliant next-best actions.`
      : "No high-confidence overnight signals require immediate escalation.",
    `Security reminder: ${lockedCount} consent-gated record(s) stay masked until status is verified.`,
  ];
}

export function generateClientBrief(client, tasks = [], signals = [], referrals = []) {
  if (!client) {
    return {
      title: "No client selected",
      summary: "Select a client to generate a deterministic advisory brief.",
      highlights: [],
      risk: "Low",
      evidence: [],
    };
  }

  if (client.consentStatus !== "Verified") {
    return {
      title: "Consent refresh required",
      summary: "Private notes, needs, financial values and recommendations remain masked until consent is verified.",
      highlights: ["Refresh PDPA consent", "Log consent evidence", "Re-run client brief after verification"],
      risk: "High",
      evidence: client.timeline.map((event) => `${event.date}: ${event.note}`),
    };
  }

  const activeTasks = getClientTasks(client, tasks);
  const clientSignals = signals.filter((signal) => signal.clientId === client.id);
  const clientReferrals = referrals.filter((referral) => referral.clientId === client.id);
  const topSignal = clientSignals[0]?.signal ?? client.prioritySignals[0];
  const taskSummary =
    activeTasks.length > 0
      ? `${activeTasks.length} open task(s), including ${activeTasks[0].title.toLowerCase()}.`
      : "No open operational tasks.";
  const referralSummary =
    clientReferrals.length > 0
      ? `${clientReferrals.length} referral opportunity/opportunities in motion.`
      : "No active referral yet.";

  return {
    title: `${client.name} - ${client.segment}`,
    summary: `${client.occupation} in ${client.location}; ${topSignal.toLowerCase()} makes ${client.nextBestOffer.toLowerCase()} timely.`,
    highlights: [
      `Annual premium ${formatRinggit(client.annualPremium)} with estimated coverage gap ${formatRinggit(client.estimatedCoverageGap ?? 0)}.`,
      taskSummary,
      referralSummary,
      `Preferred engagement: ${client.memory[0]}`,
    ],
    risk: normalizeRisk(scoreClient(client, tasks)),
    evidence: client.timeline.slice(0, 4).map((event) => `${event.date}: ${event.type} - ${event.note}`),
  };
}

export function generateNextBestActions(client, tasks = [], partners = [], complianceItems = []) {
  if (!client) return [];

  const actions = [];
  const complianceRisk = scoreComplianceRisk(client, tasks, complianceItems);

  if (client.consentStatus !== "Verified") {
    return [
      {
        id: `${client.id}-consent`,
        title: "Refresh consent before advice",
        priority: "High",
        owner: "Advisor",
        reason: "PDPA consent is not verified, so private workflows must stay masked.",
        blocked: false,
      },
    ];
  }

  const overdueTask = getClientTasks(client, tasks).find((task) => task.status === "Overdue");
  if (overdueTask) {
    actions.push({
      id: `${client.id}-overdue`,
      title: overdueTask.title,
      priority: "High",
      owner: "Advisor",
      reason: "Overdue service tasks increase lapse, complaint and retention risk.",
      blocked: false,
    });
  }

  actions.push({
    id: `${client.id}-brief`,
    title: `Prepare ${client.nextBestOffer}`,
    priority: client.propensity >= 85 ? "High" : "Medium",
    owner: "Advisor",
    reason: `Client propensity is ${client.propensity ?? 0}% and signals include ${client.prioritySignals.join(", ")}.`,
    blocked: complianceRisk.level === "High" && complianceRisk.score >= 85,
  });

  const partnerMatch = matchPartners(client, partners)[0];
  if (partnerMatch) {
    actions.push({
      id: `${client.id}-partner`,
      title: `Route to ${partnerMatch.name}`,
      priority: partnerMatch.matchScore >= 90 ? "High" : "Medium",
      owner: "Advisor",
      reason: `${partnerMatch.reason}; SLA ${partnerMatch.sla}.`,
      blocked: false,
    });
  }

  if (complianceRisk.score >= 40) {
    actions.push({
      id: `${client.id}-compliance`,
      title: "Attach suitability and disclosure evidence",
      priority: complianceRisk.level,
      owner: "Admin",
      reason: complianceRisk.reasons.join(" "),
      blocked: false,
    });
  }

  return actions.sort((a, b) => riskWeights[b.priority] - riskWeights[a.priority]);
}

export function generateDraftMessage(client, action, channel = "WhatsApp") {
  if (!client || client.consentStatus !== "Verified") {
    return {
      channel,
      subject: "Consent refresh required",
      body: "Hi, I would like to refresh your consent preferences before we review any private planning details.",
      disclaimers: ["No recommendation is included until consent is verified."],
    };
  }

  const isPremiumRisk = client.prioritySignals.some((signal) => /missed premium|lapse/i.test(signal));
  const opener = channel === "Email" ? `Dear ${client.name},` : `Hi ${client.name},`;
  const actionTitle = typeof action === "string" ? action : action?.title ?? client.nextBestOffer;
  const body = [
    opener,
    `I prepared a short review for ${actionTitle.toLowerCase()} based on your recent updates.`,
    `The main items are ${client.prioritySignals.slice(0, 2).join(" and ").toLowerCase()}, with an estimated planning gap of ${formatRinggit(client.estimatedCoverageGap ?? 0)}.`,
    "Would you like me to walk through the options and assumptions in our next meeting?",
  ];

  return {
    channel,
    subject: `${client.name}: ${actionTitle}`,
    body: body.join("\n\n"),
    disclaimers: [
      "For discussion only; final advice depends on updated suitability and affordability checks.",
      isPremiumRisk ? "Includes lapse-prevention language because a payment issue was detected." : "No guaranteed outcome language included.",
    ],
  };
}

export function scoreComplianceRisk(client, tasks = [], complianceItems = []) {
  if (!client) return { score: 0, level: "Low", reasons: ["No client selected."] };

  const reasons = [];
  let score = 0;

  if (client.consentStatus !== "Verified") {
    score += 55;
    reasons.push("Consent is not verified.");
  }

  const clientTasks = getClientTasks(client, tasks);
  const overdue = clientTasks.filter((task) => task.status === "Overdue");
  if (overdue.length > 0) {
    score += overdue.length * 14;
    reasons.push(`${overdue.length} overdue task(s) need action.`);
  }

  const complianceMatches = complianceItems.filter((item) => item.clientId === client.id);
  complianceMatches.forEach((item) => {
    score += riskWeights[item.severity] ?? 12;
    reasons.push(item.issue);
  });

  if (client.prioritySignals.some((signal) => /missed premium|policy review overdue/i.test(signal))) {
    score += 12;
    reasons.push("Service or disclosure-sensitive signal detected.");
  }

  const cappedScore = Math.min(100, score);
  return {
    score: cappedScore,
    level: normalizeRisk(cappedScore),
    reasons: reasons.length > 0 ? reasons : ["No material compliance flags detected."],
  };
}

export function recommendCpd(courses, clients, advisor) {
  const activeNeeds = new Set(clients.flatMap((client) => client.needs));
  return courses
    .map((course) => {
      const matches = course.fitTags.filter((tag) => activeNeeds.has(tag));
      const complianceBoost = advisor.cpdHours < advisor.cpdTarget && course.status === "Required" ? 2 : 0;
      const gapBoost = Math.max(0, advisor.cpdTarget - advisor.cpdHours) > 8 ? 1 : 0;
      return {
        ...course,
        matchScore: Math.min(100, 62 + matches.length * 13 + complianceBoost * 10 + gapBoost * 5),
        reason:
          matches.length > 0
            ? `Matches current book themes: ${matches.join(", ")}`
            : "Supports compliance hygiene across advisory workflows",
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function matchPartners(client, partners) {
  if (!client || client.consentStatus !== "Verified") return [];

  return partners
    .map((partner) => {
      const matches = partner.tags.filter((tag) => client.needs.includes(tag));
      const slaBoost = /hour/i.test(partner.sla) ? 4 : 0;
      return {
        ...partner,
        matchScore: Math.min(100, partner.qualityScore - 10 + matches.length * 9 + slaBoost),
        reason: matches.length > 0 ? `Relevant for ${matches.join(", ")}` : "General advisory support",
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function summarizeBusinessImpact(impactItems = [], clients = [], referrals = []) {
  const premium = clients.reduce((sum, client) => sum + (client.annualPremium || 0), 0);
  const coverageGap = clients.reduce((sum, client) => sum + (client.estimatedCoverageGap || 0), 0);
  const referralPipeline = referrals.reduce(
    (sum, referral) => sum + (referral.expectedValue || 0) * ((referral.probability ?? 100) / 100),
    0
  );

  const generated = [
    {
      id: "impact-generated-premium",
      label: "Managed premium in demo book",
      value: premium,
      unit: "RM",
      narrative: "Visible premium base protected by priority scoring and follow-up controls.",
    },
    {
      id: "impact-generated-gap",
      label: "Coverage gap surfaced",
      value: coverageGap,
      unit: "RM",
      narrative: "Estimated needs gap available for compliant, evidence-led advice.",
    },
    {
      id: "impact-generated-referrals",
      label: "Weighted referral pipeline",
      value: Math.round(referralPipeline),
      unit: "RM",
      narrative: "Referral opportunities weighted by current stage probability.",
    },
  ];

  return [...impactItems, ...generated].map((item) => ({
    ...item,
    displayValue: item.unit === "RM" ? formatRinggit(item.value) : `${item.value} ${item.unit}`,
  }));
}

export function buildDemoStory({
  clients = [],
  tasks = [],
  meetings = [],
  signals = [],
  partners = [],
  complianceItems = [],
  impactItems = [],
  referrals = [],
} = {}) {
  const priority = getPriorityClients(
    clients.filter((client) => client.consentStatus === "Verified"),
    tasks
  )[0];
  const clientBrief = generateClientBrief(priority, tasks, signals, referrals);
  const actions = generateNextBestActions(priority, tasks, partners, complianceItems).slice(0, 3);
  const complianceHotspot = clients
    .map((client) => ({ client, risk: scoreComplianceRisk(client, tasks, complianceItems) }))
    .sort((a, b) => b.risk.score - a.risk.score)[0];
  const impact = summarizeBusinessImpact(impactItems, clients, referrals).slice(0, 4);

  return [
    {
      title: "Start with the AI morning brief",
      detail: `${meetings.length} scheduled meeting(s), ${signals.length} overnight signal(s), and ${getClientName(priority)} surfaced as the top verified client.`,
    },
    {
      title: "Open the client cockpit",
      detail: `${clientBrief.title}: ${clientBrief.summary}`,
    },
    {
      title: "Show next-best actions",
      detail: actions.map((action) => `${action.priority}: ${action.title}`).join(" | "),
    },
    {
      title: "Prove compliance guardrails",
      detail: `${getClientName(complianceHotspot.client)} scores ${complianceHotspot.risk.score}/100 because ${complianceHotspot.risk.reasons[0]}`,
    },
    {
      title: "Close on business impact",
      detail: impact.map((item) => `${item.label}: ${item.displayValue}`).join(" | "),
    },
  ];
}

export function summarizeAdmin({ clients, tasks, referrals, expenses, complianceItems = [], reviewItems = [] }) {
  const totalPremium = clients.reduce((sum, client) => sum + client.annualPremium, 0);
  const overdueTasks = tasks.filter((task) => task.status === "Overdue").length;
  const pendingExpenses = expenses.filter((expense) => expense.status === "Pending").length;
  const flaggedExpenses = expenses.filter((expense) => expense.status === "Flagged").length;
  const highCompliance = complianceItems.filter((item) => item.severity === "High").length;
  const highReviews = reviewItems.filter((item) => item.priority === "High").length;

  return [
    { label: "Managed premium", value: `RM ${Math.round(totalPremium / 1000)}k`, tone: "blue" },
    { label: "Priority clients", value: clients.filter((client) => client.prioritySignals.length > 1).length, tone: "green" },
    { label: "Overdue tasks", value: overdueTasks, tone: overdueTasks > 0 ? "red" : "green" },
    { label: "Open referrals", value: referrals.filter((referral) => referral.status !== "Closed").length, tone: "blue" },
    { label: "Pending expenses", value: pendingExpenses + flaggedExpenses, tone: flaggedExpenses > 0 ? "red" : "green" },
    {
      label: "Review queue",
      value: highCompliance + highReviews,
      tone: highCompliance + highReviews > 0 ? "red" : "green",
    },
  ];
}

// ---------------------------------------------------------------------------
// Adaptive CPD & Learning Loop – Dual-Engine Architecture
// Implements Pillar A (Novice Layer), Pillar B (Portfolio Density), and
// Pillar C (Real-Time Gap Detection) from Learning.md.
// ---------------------------------------------------------------------------

const GAP_KEYWORDS = [
  { pattern: /tax\s*threshold/i, moduleId: "cpd-mod-gap-tax", reason: "Gap Alert: Recent notes mention tax threshold uncertainty — this micro-lesson closes the knowledge gap before your next client conversation." },
  { pattern: /trust/i, moduleId: "cpd-mod-gap-trust", reason: "Gap Alert: Trust structuring appeared in your recent notes — this rapid lesson ensures you can confidently discuss trust options." },
  { pattern: /lapse|missed\s*premium/i, moduleId: "cpd-mod-gap-lapse", reason: "Gap Alert: Lapse risk language detected in recent activity — complete this module to handle premium recovery conversations." },
];

const CLUSTER_LABELS = {
  SME_Owner: "SME business owners",
  HNW_Legacy: "HNW legacy guardians",
  Mass_Affluent: "mass affluent professionals",
};

export function recommendLearningModule(advisorId, allAdvisors, allClients, cpdModules, recentNotes = "") {
  const advisor = allAdvisors.find((a) => a.id === advisorId);
  if (!advisor) {
    return {
      module: null,
      ruleFired: "none",
      strategicReasoning: "No advisor found for the given ID.",
    };
  }

  const advisorClients = allClients.filter((c) => c.advisorId === advisorId);

  // ---- Rule C: Gap Detection (overrides Rules A & B) ----
  if (recentNotes && recentNotes.trim().length > 0) {
    for (const keyword of GAP_KEYWORDS) {
      if (keyword.pattern.test(recentNotes)) {
        const gapModule = cpdModules.find((m) => m.id === keyword.moduleId);
        if (gapModule) {
          return {
            module: gapModule,
            ruleFired: "C",
            strategicReasoning: keyword.reason,
          };
        }
      }
    }
  }

  // ---- Rule A: Novice Layer ----
  if (advisor.experienceLevel === "Novice") {
    const foundational = cpdModules.filter((m) => m.clusterTarget === "Foundational");
    const module = foundational[0] ?? null;
    return {
      module,
      ruleFired: "A",
      strategicReasoning: module
        ? `Onboarding Path: As a newly onboarded advisor, your learning track prioritises foundational competencies. "${module.title}" builds the baseline skills needed before advanced portfolio-driven electives are unlocked.`
        : "No foundational modules available.",
    };
  }

  // ---- Rule B: Portfolio Density Layer (Senior) ----
  const clusterCounts = {};
  for (const client of advisorClients) {
    const cluster = client.portfolioCluster;
    if (cluster) {
      clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1;
    }
  }

  const totalClients = advisorClients.length || 1;
  let dominantCluster = null;
  let dominantPct = 0;

  for (const [cluster, count] of Object.entries(clusterCounts)) {
    const pct = Math.round((count / totalClients) * 100);
    if (pct > dominantPct) {
      dominantPct = pct;
      dominantCluster = cluster;
    }
  }

  // Density threshold: recommend cluster-specific module when >= 40% concentration
  if (dominantCluster && dominantPct >= 40) {
    const clusterModules = cpdModules.filter((m) => m.clusterTarget === dominantCluster);
    const module = clusterModules[0] ?? null;
    const clusterLabel = CLUSTER_LABELS[dominantCluster] || dominantCluster;

    return {
      module,
      ruleFired: "B",
      strategicReasoning: module
        ? `Portfolio Alert: ${dominantPct}% of your book consists of ${clusterLabel}. "${module.title}" is a high-impact elective that directly maps to the estate continuity, tax, and structuring needs dominating your client conversations.`
        : `Portfolio density detected (${dominantPct}% ${clusterLabel}) but no matching modules found.`,
      portfolioDensity: { cluster: dominantCluster, percentage: dominantPct },
    };
  }

  // Fallback: no dominant cluster, recommend first available foundational module
  const fallback = cpdModules.filter((m) => m.clusterTarget === "Foundational")[0] ?? cpdModules[0];
  return {
    module: fallback,
    ruleFired: "B-fallback",
    strategicReasoning: fallback
      ? `Your portfolio is diversified across segments. "${fallback.title}" strengthens cross-segment advisory skills applicable to your current book balance.`
      : "No learning modules available.",
  };
}

// ---------------------------------------------------------------------------
// Knowledge Gate — Scenario-Based Post-Lesson Quiz
// Generates contextual questions using the advisor's actual client data so
// the quiz tests applied understanding, not rote memory.
// ---------------------------------------------------------------------------

const QUIZ_TEMPLATES = {
  trust: (client) => ({
    question: `Based on this module, what is the immediate compliance risk for your client, ${client.name}, if their estate assets are transferred without a properly structured trust arrangement?`,
    options: [
      { id: "a", text: "The transfer would be tax-exempt under Malaysian law regardless of structure.", correct: false },
      { id: "b", text: "Beneficiaries could face forced liquidation, probate delays, and unintended estate duty exposure.", correct: true },
      { id: "c", text: "The only risk is a minor administrative fee for late trust registration.", correct: false },
      { id: "d", text: "No risk exists as long as a will is in place, even without a trust.", correct: false },
    ],
    explanation: `Without proper trust structuring, ${client.name}'s beneficiaries face probate delays, forced asset liquidation, and potential estate duty exposure — especially critical for cross-border holdings.`,
  }),
  legacy: (client) => ({
    question: `Your client ${client.name} recently had a liquidity event. According to this module, what should be the FIRST step in their estate continuity plan?`,
    options: [
      { id: "a", text: "Immediately invest all proceeds into a single insurance product.", correct: false },
      { id: "b", text: "Conduct a suitability review mapping the liquidity event to updated beneficiary nominations, tax sequencing, and estate bridge needs.", correct: true },
      { id: "c", text: "Wait 12 months for the tax year to close before taking any action.", correct: false },
      { id: "d", text: "Refer directly to a solicitor without any advisory needs analysis.", correct: false },
    ],
    explanation: `A liquidity event for ${client.name} triggers immediate estate re-sequencing needs. The correct first step is a structured suitability review before any product action.`,
  }),
  tax: (client) => ({
    question: `${client.name} is approaching a corporate tax threshold boundary. Based on this module, what is the primary advisory risk if this is not flagged proactively?`,
    options: [
      { id: "a", text: "There is no risk; tax thresholds adjust automatically.", correct: false },
      { id: "b", text: "The client may unknowingly trigger a higher tax bracket, increasing effective rates on business income and reducing protection affordability.", correct: true },
      { id: "c", text: "The advisor loses their commission on existing policies.", correct: false },
      { id: "d", text: "The client's medical coverage is automatically suspended.", correct: false },
    ],
    explanation: `Failing to flag ${client.name}'s proximity to a tax threshold could result in unexpected bracket jumps that reduce disposable income and make protection premiums unaffordable.`,
  }),
  "tax threshold": (client) => ({
    question: `Your client ${client.name}'s business income is nearing the next chargeable income tier. According to this module, what should you verify BEFORE the next review meeting?`,
    options: [
      { id: "a", text: "Only the client's personal savings balance.", correct: false },
      { id: "b", text: "The gap between current chargeable income and the next threshold, and whether current protection premiums remain affordable under the higher effective rate.", correct: true },
      { id: "c", text: "The client's social media activity for lifestyle changes.", correct: false },
      { id: "d", text: "Nothing — tax thresholds are the accountant's responsibility, not the advisor's.", correct: false },
    ],
    explanation: `For ${client.name}, verifying the income-to-threshold gap ensures your advice accounts for potential premium affordability changes and allows proactive restructuring.`,
  }),
  "key-person": (client) => ({
    question: `${client.name} has key-person concentration risk. If the key person becomes incapacitated, what does this module identify as the most critical immediate exposure?`,
    options: [
      { id: "a", text: "Loss of the company's social media presence.", correct: false },
      { id: "b", text: "The business may fail to meet loan covenants, triggering debt recall and threatening the continuity of operations.", correct: true },
      { id: "c", text: "Minor inconvenience in scheduling client meetings.", correct: false },
      { id: "d", text: "Automatic transfer of business ownership to the next shareholder.", correct: false },
    ],
    explanation: `For ${client.name}, key-person incapacitation can trigger loan covenant breaches, debt recall, and operational failure — the most severe and immediate financial exposure.`,
  }),
  underwriting: (client) => ({
    question: `When assessing suitability for ${client.name}, what does this module say is the FIRST requirement before recommending any product?`,
    options: [
      { id: "a", text: "Check the advisor's commission rate for each product.", correct: false },
      { id: "b", text: "Verify that the client's needs analysis, risk profile, and disclosure evidence are documented and current.", correct: true },
      { id: "c", text: "Present the most expensive product as it provides the highest coverage.", correct: false },
      { id: "d", text: "Ask the client to sign a blank application form to save time.", correct: false },
    ],
    explanation: `Before any recommendation for ${client.name}, the advisor must verify the needs analysis, risk classification, and disclosure evidence are up-to-date — this is the foundation of suitability.`,
  }),
  compliance: (client) => ({
    question: `If ${client.name || "a client"}'s PDPA consent has expired, what actions does this module require the advisor to take IMMEDIATELY?`,
    options: [
      { id: "a", text: "Continue accessing the client's data but add a note to refresh consent later.", correct: false },
      { id: "b", text: "Mask all private data, block referrals and recommendations, and initiate a consent refresh workflow before any further access.", correct: true },
      { id: "c", text: "Delete the client's records from the system entirely.", correct: false },
      { id: "d", text: "Email the client asking them to visit the office in person within 30 days.", correct: false },
    ],
    explanation: `When consent expires, the module requires immediate data masking, blocking of all recommendations and referrals, and a formal consent refresh — no exceptions.`,
  }),
  "cross-selling": (client) => ({
    question: `During a review with ${client.name}, they mention a new life event. According to this module, how should you capture this for cross-selling opportunities?`,
    options: [
      { id: "a", text: "Ignore it unless they explicitly ask about new products.", correct: false },
      { id: "b", text: "Log the life event in the client memory, map it to potential coverage gaps, and flag it for the next needs analysis review.", correct: true },
      { id: "c", text: "Immediately recommend a product before the client changes their mind.", correct: false },
      { id: "d", text: "Forward the information to a third-party lead generator.", correct: false },
    ],
    explanation: `The module teaches capturing relational context from ${client.name}'s life events into structured memory, mapping to coverage gaps, and scheduling a proper needs review — not rushing to sell.`,
  }),
  income: (client) => ({
    question: `${client.name}'s income protection needs must be reviewed after a career change. According to this module, what is the key ratio to verify?`,
    options: [
      { id: "a", text: "The ratio of the client's social media followers to their income.", correct: false },
      { id: "b", text: "The debt-to-income ratio and whether current coverage replaces sufficient income during disability.", correct: true },
      { id: "c", text: "The client's commute distance to their new workplace.", correct: false },
      { id: "d", text: "Only the premium amount, regardless of coverage adequacy.", correct: false },
    ],
    explanation: `After a career change for ${client.name}, the debt-to-income ratio and income replacement adequacy during disability are the critical metrics this module highlights for review.`,
  }),
  medical: (client) => ({
    question: `For ${client.name}'s family, this module highlights a common gap in standard medical coverage. What is it?`,
    options: [
      { id: "a", text: "Coverage for cosmetic procedures.", correct: false },
      { id: "b", text: "Dependent coverage gaps where newborns or elderly parents are not automatically included, and specialist panel access limitations.", correct: true },
      { id: "c", text: "Free gym membership inclusion.", correct: false },
      { id: "d", text: "Coverage for overseas holiday medical emergencies only.", correct: false },
    ],
    explanation: `The most common gap for families like ${client.name}'s is that newborns and elderly dependents are not automatically covered, and specialist panel access may be limited under standard plans.`,
  }),
  lapse: (client) => ({
    question: `${client.name || "A client"} has missed a premium payment. According to this module, what is the advisor's FIRST compliant action?`,
    options: [
      { id: "a", text: "Cancel the policy immediately to avoid further liability.", correct: false },
      { id: "b", text: "Contact the client using service-first language within the grace period, disclose lapse risk transparently, and document the outreach in the audit trail.", correct: true },
      { id: "c", text: "Wait for the insurer to contact the client directly.", correct: false },
      { id: "d", text: "Pay the premium from the advisor's own funds to prevent lapse.", correct: false },
    ],
    explanation: `The module requires immediate, documented outreach using service-first language during the grace period, with transparent lapse risk disclosure — protecting both the client and the advisor's compliance record.`,
  }),
};

// Fallback generic quiz for topics without a specific template
function genericQuiz(mod, client) {
  return {
    question: `After completing "${mod.title}", which of the following best describes the correct advisory approach for a client like ${client.name}?`,
    options: [
      { id: "a", text: "Skip the needs analysis and recommend the highest-premium product available.", correct: false },
      { id: "b", text: "Apply the module's framework: assess needs, verify suitability, document evidence, and only then make a compliant recommendation.", correct: true },
      { id: "c", text: "Defer all decisions to the client without providing any structured advice.", correct: false },
      { id: "d", text: "Copy another advisor's recommendation from a similar case.", correct: false },
    ],
    explanation: `The correct approach always follows the evidence-based advisory framework: assess, verify, document, then recommend — tailored to ${client.name}'s specific circumstances.`,
  };
}

export function generateKnowledgeGateQuiz(module, advisorId, allClients) {
  if (!module) return null;

  // Pick a real client from the advisor's book to contextualise the question
  const advisorClients = allClients.filter(
    (c) => c.advisorId === advisorId && c.consentStatus === "Verified"
  );
  const contextClient = advisorClients[0] ?? {
    name: "your client",
    segment: "Client",
    occupation: "Professional",
    needs: [],
  };

  // Find the matching question template by module topic
  const templateFn = QUIZ_TEMPLATES[module.topic];
  const quiz = templateFn ? templateFn(contextClient) : genericQuiz(module, contextClient);

  // Shuffle options deterministically based on module id
  const seed = module.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const shuffled = [...quiz.options].sort((a, b) => {
    const ha = ((a.id.charCodeAt(0) * seed) % 97);
    const hb = ((b.id.charCodeAt(0) * seed) % 97);
    return ha - hb;
  });

  return {
    moduleId: module.id,
    moduleTitle: module.title,
    clientName: contextClient.name,
    question: quiz.question,
    options: shuffled,
    explanation: quiz.explanation,
    correctId: quiz.options.find((o) => o.correct)?.id,
  };
}
