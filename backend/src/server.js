import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { isMockMode, providerInfo } from "./services/llmService.js";
import chatRoutes from "./routes/chat.js";
import planRoutes from "./routes/plan.js";
import profileRoutes from "./routes/profile.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mockLLM: isMockMode(),
    ...providerInfo(),
    time: new Date().toISOString(),
  });
});

app.use("/api/chat", chatRoutes);
app.use("/api/plan", planRoutes);
app.use("/api/profile", profileRoutes);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB(process.env.MONGODB_URI);
  app.listen(PORT, () => {
    const info = providerInfo();
    console.log(`\n🪙  NiveshMitra backend on http://localhost:${PORT}`);
    console.log(
      `   LLM: ${info.mock ? "MOCK (no key)" : `${info.provider} → ${info.model}`}`,
    );
  });
})();
