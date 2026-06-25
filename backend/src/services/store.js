// Thin data-access layer. Uses Mongoose models when MongoDB is connected,
// otherwise falls back to in-memory maps so the demo never hard-fails.
import { isDbConnected } from "../config/db.js";
import ConversationLog from "../models/ConversationLog.js";
import RiskProfile from "../models/RiskProfile.js";
import Plan from "../models/Plan.js";
import User from "../models/User.js";

const mem = {
  conversations: new Map(),
  profiles: new Map(),
  plans: new Map(),
  users: new Map(),
};

// ---- Users ----
export async function getOrCreateUser(sessionId) {
  if (isDbConnected()) {
    let u = await User.findOne({ sessionId });
    if (!u) u = await User.create({ sessionId });
    return u;
  }
  if (!mem.users.has(sessionId)) {
    mem.users.set(sessionId, { sessionId, onboardingComplete: false });
  }
  return mem.users.get(sessionId);
}

// Upsert identity fields (name/email/googleId/picture) for a session.
// Only overwrites fields that are actually provided and non-empty.
export async function setUserIdentity(sessionId, info = {}) {
  const fields = {};
  for (const k of [
    "name",
    "email",
    "googleId",
    "picture",
    "age",
    "city",
    "occupation",
    "phone",
    "basicInfoComplete",
  ]) {
    if (info[k] != null && info[k] !== "") fields[k] = info[k];
  }
  if (isDbConnected()) {
    return User.findOneAndUpdate(
      { sessionId },
      { $set: fields },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  const existing = mem.users.get(sessionId) || {
    sessionId,
    onboardingComplete: false,
  };
  Object.assign(existing, fields);
  mem.users.set(sessionId, existing);
  return existing;
}

// ---- Conversations ----
export async function getConversation(sessionId) {
  if (isDbConnected()) {
    let c = await ConversationLog.findOne({ sessionId });
    if (!c) c = await ConversationLog.create({ sessionId, messages: [] });
    return c;
  }
  if (!mem.conversations.has(sessionId)) {
    mem.conversations.set(sessionId, { sessionId, messages: [] });
  }
  return mem.conversations.get(sessionId);
}

export async function appendMessages(sessionId, newMessages) {
  const convo = await getConversation(sessionId);
  convo.messages.push(...newMessages);
  if (isDbConnected()) await convo.save();
  return convo;
}

// ---- Risk profile ----
export async function getProfile(sessionId) {
  if (isDbConnected()) {
    let p = await RiskProfile.findOne({ sessionId });
    if (!p) p = await RiskProfile.create({ sessionId });
    return p;
  }
  if (!mem.profiles.has(sessionId)) {
    mem.profiles.set(sessionId, {
      sessionId,
      goals: [],
      horizonYears: null,
      monthlyIncome: null,
      monthlyInvestable: null,
      fearTolerance: null,
      lifeStage: null,
      riskScore: null,
      riskCategory: null,
      complete: false,
    });
  }
  return mem.profiles.get(sessionId);
}

export async function updateProfile(sessionId, updates) {
  const p = await getProfile(sessionId);
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === undefined) continue;
    if (k === "goals" && Array.isArray(v)) {
      const set = new Set([...(p.goals || []), ...v]);
      p.goals = [...set];
    } else {
      p[k] = v;
    }
  }
  if (isDbConnected()) await p.save();
  return p;
}

// ---- Plan ----
export async function savePlan(sessionId, planData) {
  if (isDbConnected()) {
    return Plan.findOneAndUpdate({ sessionId }, planData, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }
  mem.plans.set(sessionId, planData);
  return planData;
}

export async function getPlan(sessionId) {
  if (isDbConnected()) return Plan.findOne({ sessionId });
  return mem.plans.get(sessionId) || null;
}
