import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { authRouter } from "./modules/auth/routes";
import { budgetsRouter } from "./modules/budgets/routes";
import { goalsRouter } from "./modules/goals/routes";
import { reportsRouter } from "./modules/reports/routes";
import { transactionsRouter } from "./modules/transactions/routes";
import { categoriesRouter } from "./modules/categories/routes";
import { pool } from "./db/pool";
import { requireAuth } from "./middleware/requireAuth";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

app.get("/health", async (_req, res) => {
  if (!pool) {
    return res.status(200).json({ status: "ok", service: "backend-api", database: "not_configured" });
  }
  try {
    await pool.query("select 1");
    return res.status(200).json({ status: "ok", service: "backend-api", database: "up" });
  } catch {
    return res.status(503).json({ status: "degraded", service: "backend-api", database: "down" });
  }
});

app.use("/v1/auth", authRouter);
app.use("/v1/transactions", requireAuth, transactionsRouter);
app.use("/v1/categories", requireAuth, categoriesRouter);
app.use("/v1/goals", requireAuth, goalsRouter);
app.use("/v1/budgets", requireAuth, budgetsRouter);
app.use("/v1/reports", requireAuth, reportsRouter);
