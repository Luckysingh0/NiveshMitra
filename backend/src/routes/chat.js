import express from "express";
import { chatJSON, providerInfo } from "../services/llmService.js";
import { resolvePanic } from "../services/emotionService.js";
import {
  computeRiskScore,
  categorize,
  isProfileComplete,
} from "../services/riskService.js";
import { buildPlan } from "../services/planService.js";
import {
  ONBOARDING_SYSTEM_PROMPT,
  ADVISOR_SYSTEM_PROMPT,
} from "../prompts/systemPrompts.js";
import {
  getConversation,
  createConversation,
  getAllConversations,
  appendMessages,
  getProfile,
  updateProfile,
  savePlan,
  getPlan,
  getUser,
} from "../services/store.js";
import ConversationLog from "../models/ConversationLog.js";

const router = express.Router();

// Number of user turns between simulated periodic check-ins.
const CHECKIN_EVERY = 4;

router.post("/", async (req, res) => {
  try {
    const { email, conversationId, message, thinkMode } = req.body;

    if (!email || !message || typeof message !== "string") {
      return res.status(400).json({ error: "Email and message are required." });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: "Message too long." });
    }

    const user = await getUser(email);

    const conversation =
      conversationId !== ""
        ? await getConversation(conversationId)
        : await createConversation(email, message);

    const newConversationId = conversation._id.toString();

    const profile = await getProfile(newConversationId);
    const plan = await getPlan(newConversationId);

    const onboarding = !profile.complete && !isProfileComplete(profile);
    let systemPrompt = onboarding
      ? ONBOARDING_SYSTEM_PROMPT
      : ADVISOR_SYSTEM_PROMPT;

    // Tell the AI who it's talking to, up front, as a firm fact so it greets
    // them by name and never asks for their name again.
    if (user?.name && user.name !== "Friend") {
      systemPrompt =
        `IMPORTANT: You are already talking with ${user.name}. ` +
        `You know their name — greet and address them as ${user.name} naturally, ` +
        `and never ask what their name is.\n\n${systemPrompt}`;
    }

    // Give the AI full awareness of what the user sees on the dashboard.
    const dashboardContext = buildDashboardContext(profile, plan);
    if (dashboardContext) {
      systemPrompt = `${systemPrompt}\n\n${dashboardContext}`;
    }

    // History trimmed to recent turns to keep token usage low on free models.
    const history = conversation.messages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    // Pre-scan the deterministic safety net so we can request calm-mode styling
    // from the LLM up front when panic language is present.
    const preScan = resolvePanic(message, {});
    const calmMode = preScan.panicMode;

    const llm = await chatJSON({
      systemPrompt,
      history,
      userMessage: message,
      calmMode,
      thinkMode: Boolean(thinkMode),
    });

    // Final panic resolution combines deterministic + LLM judgement.
    const panic = resolvePanic(message, llm);

    // Merge any profile updates the model extracted.
    if (llm.profile_updates && Object.keys(llm.profile_updates).length) {
      await updateProfile(newConversationId, llm.profile_updates);
    }

    // Re-read profile, recompute score, and possibly finalize onboarding + plan.
    let updatedProfile = await getProfile(newConversationId);
    let planJustBuilt = null;

    const readyToFinalize =
      (llm.onboarding_complete || isProfileComplete(updatedProfile)) &&
      !updatedProfile.complete;

    if (isProfileComplete(updatedProfile)) {
      const score = computeRiskScore(updatedProfile);
      updatedProfile = await updateProfile(newConversationId, {
        riskScore: score,
        riskCategory: categorize(score),
      });
    }

    if (readyToFinalize && isProfileComplete(updatedProfile)) {
      updatedProfile = await updateProfile(newConversationId, {
        complete: true,
      });
      const planData = buildPlan(updatedProfile);
      planJustBuilt = await savePlan(newConversationId, planData);
      user.onboardingComplete = true;
      if (user.save) await user.save();
    }

    // Periodic check-in: every N user turns, nudge a reflective question.
    const userTurns =
      conversation.messages.filter((message) => message.role === "user")
        .length + 1;
    const checkIn = userTurns > 0 && userTurns % CHECKIN_EVERY === 0;

    // Persist both turns with emotion metadata on the assistant message.
    await appendMessages(newConversationId, [
      { role: "user", content: message },
      {
        role: "assistant",
        content: llm.response_text,
        detectedEmotion: llm.detected_emotion,
        riskSignal: llm.risk_signal,
        confidence: llm.confidence,
        panicMode: panic.panicMode,
        triggeredBy: panic.triggeredBy,
      },
    ]);

    res.status(200).json({
      conversationId: newConversationId,
      reply: llm.response_text,
      emotion: {
        detected: llm.detected_emotion,
        riskSignal: llm.risk_signal,
        confidence: llm.confidence,
        panicMode: panic.panicMode,
        fomo: panic.fomo,
        triggeredBy: panic.triggeredBy,
        matched: panic.matched,
      },
      phase: updatedProfile.complete ? "advisor" : "onboarding",
      profile: serializeProfile(updatedProfile),
      planBuilt: Boolean(planJustBuilt),
      checkIn,
      meta: { mock: Boolean(llm._mock), ...providerInfo(), error: llm._error },
    });
  } catch (err) {
    console.error("chat route error:", err);
    res
      .status(500)
      .json({ error: "Something went wrong handling your message." });
  }
});

router.get("/", async (req, res) => {
  try {
    const conversations = await getAllConversations();
    res.status(201).json({ conversations });
  } catch (err) {
    console.error("Some error occurred while fetching conversations:", err);
    res
      .status(400)
      .json({ error: "Some error occurred while fetching conversations." });
  }
});

router.get("/:slug", async (req, res) => {
  const slug = req.params.slug;

  try {
    const conversation = await ConversationLog.findOne({
      email,
      slug,
    });

    if (!conversation) {
      return res.status(404).json({
        error: "This conversation was either deleted or does not exist.",
      });
    }

    res.status(201).json(conversation);
  } catch (err) {
    console.error("Some error occurred while fetching the conversation:", err);
    res
      .status(500)
      .json({ error: "Some error occurred while fetching the conversation." });
  }
});

router.delete("/", async (req, res) => {
  const { conversationId } = req.body;

  try {
    await ConversationLog.findByIdAndDelete(conversationId);
  } catch (err) {
    console.error(err);
  }
});

function serializeProfile(p) {
  return {
    goals: p.goals || [],
    horizonYears: p.horizonYears ?? null,
    monthlyIncome: p.monthlyIncome ?? null,
    monthlyInvestable: p.monthlyInvestable ?? null,
    fearTolerance: p.fearTolerance ?? null,
    lifeStage: p.lifeStage ?? null,
    riskScore: p.riskScore ?? null,
    riskCategory: p.riskCategory ?? null,
    complete: Boolean(p.complete),
  };
}

const inr = (n) =>
  typeof n === "number" && !Number.isNaN(n)
    ? "₹" + Math.round(n).toLocaleString("en-IN")
    : "—";

/**
 * Render a plain-text summary of exactly what the user sees on the dashboard,
 * so the LLM can answer questions about their plan with real, specific numbers.
 * Returns "" when there is nothing meaningful yet (early onboarding).
 */
function buildDashboardContext(profile, plan) {
  const lines = [];

  const p = profile || {};
  const profileBits = [];
  if (p.goals?.length) profileBits.push(`Goals: ${p.goals.join(", ")}`);
  if (p.horizonYears != null)
    profileBits.push(`Horizon: ${p.horizonYears} years`);
  if (p.monthlyIncome != null)
    profileBits.push(`Monthly income: ${inr(p.monthlyIncome)}`);
  if (p.monthlyInvestable != null)
    profileBits.push(`Can invest/month: ${inr(p.monthlyInvestable)}`);
  if (p.fearTolerance) profileBits.push(`Fear tolerance: ${p.fearTolerance}`);
  if (p.lifeStage) profileBits.push(`Life stage: ${p.lifeStage}`);
  if (p.riskCategory)
    profileBits.push(
      `Risk profile: ${p.riskCategory}${p.riskScore != null ? ` (score ${p.riskScore}/100)` : ""}`,
    );

  if (profileBits.length) {
    lines.push("USER PROFILE:");
    profileBits.forEach((b) => lines.push(`- ${b}`));
  }

  if (plan) {
    lines.push("");
    lines.push(
      `INVESTMENT PLAN — "${plan.templateName}"${plan.tagline ? ` (${plan.tagline})` : ""}:`,
    );
    if (plan.expectedReturn)
      lines.push(`- Expected return: ${plan.expectedReturn}`);
    if (plan.monthlySIP) lines.push(`- Monthly SIP: ${inr(plan.monthlySIP)}`);
    if (plan.allocation?.length) {
      lines.push("- Asset allocation:");
      plan.allocation.forEach((a) => {
        const examples = a.examples?.length
          ? ` (e.g. ${a.examples.slice(0, 2).join(", ")})`
          : "";
        lines.push(`    • ${a.asset}: ${a.percent}%${examples}`);
      });
    }
    if (plan.milestones?.length) {
      lines.push("- Milestones:");
      plan.milestones.forEach((m) => {
        const yr = m.targetYear ? ` [${m.targetYear}]` : "";
        lines.push(`    • ${m.label}${yr}${m.done ? " ✓" : ""}`);
      });
    }
  }

  if (!lines.length) return "";

  return [
    "DASHBOARD CONTEXT — this is the live data the user currently sees on their screen.",
    "Use it to answer their questions specifically and accurately:",
    "",
    ...lines,
  ].join("\n");
}

export default router;
