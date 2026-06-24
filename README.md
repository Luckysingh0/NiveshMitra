# NiveshMitra 🪙

A conversational AI investment companion that **onboards users empathetically**, builds a
**personalized rule-based investment plan**, lets them **simulate sector allocations live**,
and detects **emotional distress / panic** to switch into a calmer, reassuring **Calm Mode**.

> ⚠️ **Not registered financial advice.** Educational hackathon project. No live trading.

---

## ✨ Core Features

1. **Conversational onboarding** — goals, horizon, income, risk tolerance discovered through
   a natural, human-sounding chat (no forms) → structured risk profile.
2. **Personalized plan** — rule-based mapping of risk score → preset portfolio templates with
   real fund/stock names from a static dataset (no live market data).
3. **Interactive plan dashboard** — donut allocation chart, per-sector **return sliders** to
   simulate how monthly SIPs grow over time, milestones and projected corpus.
4. **Hybrid emotion / panic detection**
   - _Primary:_ LLM infers the user's emotional state through prompting.
   - _Safety net:_ a deterministic keyword/regex layer **force-triggers Calm Mode**
     regardless of the model output — guarantees the flagship feature works on demo day.
5. **Think mode** — a toggle that lets the assistant reason more deeply (longer, richer
   answers) when the user wants detail.
6. **Polished product landing** — a marketing landing page with a live wealth-projection
   chart, dashboard demo, sample conversation, personalization & trust sections, an FAQ, and
   an "always free" band — plus a friendly login and a ChatGPT-style centered chat with a
   collapsible plan dashboard.
7. **Dual theme** — Gemini-inspired **dark** (vivid blue→purple accents) and Claude-inspired
   **light**, toggleable and persisted.

## 🏗️ Architecture

```
React (Vite + recharts)  ──HTTP──►  Express API  ──►  Google Gemini (native REST)
   landing / login           │                         (OpenRouter optional)
   chat UI                    ├─► MongoDB (User, ConversationLog, RiskProfile, Plan)
   plan dashboard + sliders   ├─► Emotion safety-net (deterministic keywords)
   calm-mode cue              ├─► Risk scoring engine
   dark / light themes        └─► Rule-based portfolio templates (static JSON)
```

### Why hybrid emotion detection?

LLMs are excellent at inferring emotion through prompting, but pure LLM output isn't
reliable enough for a live demo. We layer a **deterministic keyword/regex safety net**
on top of LLM-based inference so Calm Mode **always** triggers on clear distress signals
("sell everything", "I can't sleep", "lost it all"), no matter how the model phrases things.

---

## 🚀 Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env      # add your GEMINI_API_KEY (+ optional MONGODB_URI)
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173 and proxies `/api` to the backend on http://localhost:5000.

### Getting a free Gemini key (recommended)

1. Get a free key at https://aistudio.google.com/apikey
2. Put it in `backend/.env` as `GEMINI_API_KEY` (`LLM_PROVIDER=gemini`).
3. Default model is `gemini-2.5-flash` with automatic fallbacks if it's overloaded.

> Prefer OpenRouter? Set `LLM_PROVIDER=openrouter` and add `OPENROUTER_API_KEY`.

> No key yet? The backend runs in **MOCK_LLM mode** automatically and returns canned
> structured responses so the full flow (and demo video) still works.

---

## 📂 Project layout

```
NiveshMitra/
├── backend/         Express + Mongoose + Gemini (native REST)
│   └── src/
│       ├── config/      db connection
│       ├── models/      Mongoose schemas
│       ├── services/    llm, emotion, risk, plan, store
│       ├── prompts/     system prompts
│       ├── data/        static fund/portfolio dataset
│       └── routes/      chat / profile / plan
└── frontend/        Vite + React
    └── src/
        ├── Root.jsx        theme + auth + view orchestration
        ├── App.jsx         chat experience
        ├── api/            backend client
        └── components/     Landing, Login, MessageBubble, PlanDashboard
```

## 🛡️ Guardrails

- Disclaimer injected into every plan response.
- Prompt-injection resistance: user text is never concatenated into the system prompt;
  system instructions are pinned and the model is told to ignore instructions in user content.
- Deterministic panic safety-net cannot be talked out of by the user.

## 🎤 Pitch hooks (mapped to rubric)

- **Conversational AI:** multi-turn, human-sounding empathetic onboarding with persisted state.
- **Emotion detection:** LLM inference + deterministic safety layer.
- **Prompt design:** structured system prompts with robust parsing; optional Think mode.
- **Behavioral finance logic:** risk scoring → portfolio templates → interactive simulation → milestones.
- **Product polish:** landing page, theming, collapsible dashboard with live sliders.
- **Safety:** disclaimers, injection resistance, guaranteed Calm Mode trigger.
