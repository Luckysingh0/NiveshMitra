import express from "express";
import { OAuth2Client } from "google-auth-library";
import { setUserIdentity, updateProfile } from "../services/store.js";

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID
  ? new OAuth2Client(GOOGLE_CLIENT_ID)
  : null;

function serializeUser(u) {
  return {
    name: u?.name ?? "Friend",
    email: u?.email ?? null,
    picture: u?.picture ?? null,
    age: u?.age ?? null,
    city: u?.city ?? null,
    occupation: u?.occupation ?? null,
    phone: u?.phone ?? null,
    basicInfoComplete: Boolean(u?.basicInfoComplete),
  };
}

const clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * POST /api/auth/login
 * Credential gate (demo): email identifies the account, password is required
 * but not stored — any non-empty value is accepted. The session id is derived
 * from the email so a returning user keeps their history.
 * body: { email, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Email is required." });
    }
    if (!password || typeof password !== "string" || !password.length) {
      return res.status(400).json({ error: "Password is required." });
    }
    const emailLc = email.trim().toLowerCase();
    const sessionId = `usr_${emailLc}`;
    const user = await setUserIdentity(sessionId, { email: emailLc });
    res.json({ sessionId, user: serializeUser(user) });
  } catch (err) {
    console.error("auth/login error:", err);
    res.status(500).json({ error: "Could not sign you in." });
  }
});

/**
 * POST /api/auth/basic-info
 * Saves the short profile form collected right after login, and pre-fills the
 * risk profile so the chat onboarding doesn't re-ask income/goal.
 * body: { sessionId, name, age, city, occupation, phone, monthlyIncome, goal }
 */
router.post("/basic-info", async (req, res) => {
  try {
    const {
      sessionId,
      name,
      age,
      city,
      occupation,
      phone,
      monthlyIncome,
      goal,
    } = req.body || {};
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId is required." });
    }

    const ageNum = Number(age);
    const user = await setUserIdentity(sessionId, {
      name: clean(name),
      age: !Number.isNaN(ageNum) && ageNum > 0 ? ageNum : null,
      city: clean(city),
      occupation: clean(occupation),
      phone: clean(phone),
      basicInfoComplete: true,
    });

    // Feed overlapping fields into the financial risk profile.
    const updates = {};
    const incomeNum = Number(monthlyIncome);
    if (!Number.isNaN(incomeNum) && incomeNum > 0) {
      updates.monthlyIncome = incomeNum;
    }
    const goalClean = clean(goal);
    if (goalClean) updates.goals = [goalClean];
    if (Object.keys(updates).length) await updateProfile(sessionId, updates);

    res.json({ user: serializeUser(user) });
  } catch (err) {
    console.error("auth/basic-info error:", err);
    res.status(500).json({ error: "Could not save your details." });
  }
});

/**
 * POST /api/auth/google
 * Verifies a Google Identity Services ID token and links the account.
 * body: { sessionId, credential }
 *
 * Uses the Google account "sub" to build a stable sessionId so a returning
 * user keeps their history across devices/browsers.
 */
router.post("/google", async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(503).json({
        error:
          "Google sign-in is not configured on the server (GOOGLE_CLIENT_ID missing).",
      });
    }
    const { credential } = req.body || {};
    if (!credential || typeof credential !== "string") {
      return res.status(400).json({ error: "Google credential is required." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid Google token." });
    }

    // Stable per-account session so chat history follows the Google account.
    const accountSession = `goog_${payload.sub}`;
    const user = await setUserIdentity(accountSession, {
      name: payload.name || payload.given_name || "Friend",
      email: payload.email || null,
      googleId: payload.sub,
      picture: payload.picture || null,
    });

    res.json({ sessionId: accountSession, user: serializeUser(user) });
  } catch (err) {
    console.error("auth/google error:", err.message);
    res.status(401).json({ error: "Google sign-in failed. Please try again." });
  }
});

export default router;
