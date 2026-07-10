import express from "express";
import { getProfile, getPlan } from "../services/store.js";
import { listTemplates, buildPlan } from "../services/planService.js";
import {
  computeRiskScore,
  categorize,
  isProfileComplete,
} from "../services/riskService.js";

const router = express.Router();

// GET /api/plan/:sessionId  -> current plan (builds on the fly if profile ready)
router.get("/:conversationId", async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    let plan = await getPlan(conversationId);

    if (!plan) {
      const profile = await getProfile(conversationId);
      if (isProfileComplete(profile)) {
        if (profile.riskScore == null) {
          profile.riskScore = computeRiskScore(profile);
          profile.riskCategory = categorize(profile.riskScore);
        }
        plan = buildPlan(profile);
      }
    }
    if (!plan) {
      return res
        .status(404)
        .json({ error: "No plan yet — finish onboarding first." });
    }
    res.json({ plan });
  } catch (err) {
    console.error("plan route error:", err);
    res.status(500).json({ error: "Could not load plan." });
  }
});

// GET /api/plan/templates/all -> all portfolio templates (for transparency)
router.get("/templates/all", (_req, res) => {
  res.json({ templates: listTemplates() });
});

export default router;
