import { Router } from "express";
import { z } from "zod";
import { runQuery } from "../../db/pool";

export const goalsRouter = Router();

const createGoalSchema = z.object({
  name: z.string().min(2),
  targetAmountClp: z.number().int().positive(),
  monthlyContributionClp: z.number().int().positive(),
  targetDate: z.string().optional(),
});

goalsRouter.get("/", async (_req, res) => {
  try {
    const userId = _req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const goalsResult = await runQuery<{
      id: string;
      name: string;
      target_amount_clp: number;
      monthly_contribution_clp: number;
      current_amount_clp: number;
      status: "active" | "paused" | "completed" | "cancelled";
    }>(
      `select id, name, target_amount_clp, monthly_contribution_clp, current_amount_clp, status
       from saving_goals
       where user_id = $1
       order by created_at desc`,
      [userId]
    );

    return res.status(200).json({
      items: goalsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        targetAmountClp: Number(row.target_amount_clp),
        monthlyContributionClp: Number(row.monthly_contribution_clp),
        currentAmountClp: Number(row.current_amount_clp),
        status: row.status,
      })),
    });
  } catch {
    return res.status(200).json({ items: [] });
  }
});

goalsRouter.post("/", async (req, res) => {
  const parsed = createGoalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const insertResult = await runQuery<{
      id: string;
      name: string;
      target_amount_clp: number;
      monthly_contribution_clp: number;
      current_amount_clp: number;
      status: "active" | "paused" | "completed" | "cancelled";
    }>(
      `insert into saving_goals (user_id, name, target_amount_clp, monthly_contribution_clp, current_amount_clp, target_date)
       values ($1, $2, $3, $4, 0, $5)
       returning id, name, target_amount_clp, monthly_contribution_clp, current_amount_clp, status`,
      [userId, parsed.data.name, parsed.data.targetAmountClp, parsed.data.monthlyContributionClp, parsed.data.targetDate ?? null]
    );

    const row = insertResult.rows[0];
    return res.status(201).json({
      id: row.id,
      name: row.name,
      targetAmountClp: Number(row.target_amount_clp),
      monthlyContributionClp: Number(row.monthly_contribution_clp),
      currentAmountClp: Number(row.current_amount_clp),
      status: row.status,
    });
  } catch {
    return res.status(500).json({ error: { message: "Could not create goal" } });
  }
});

goalsRouter.post("/:goalId/contributions", async (req, res) => {
  // amountClp can be negative (withdrawal) — clamped to 0 in DB
  const schema = z.object({ amountClp: z.number().int().refine((n) => n !== 0, "Amount must be non-zero"), note: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const goalId = req.params.goalId;
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const ownership = await runQuery<{ id: string }>(`select id from saving_goals where id = $1 and user_id = $2 limit 1`, [goalId, userId]);
    if (ownership.rows.length === 0) return res.status(404).json({ error: { message: "Goal not found" } });

    await runQuery(
      `insert into goal_contributions (goal_id, amount_clp, source, note)
       values ($1, $2, 'manual', $3)`,
      [goalId, parsed.data.amountClp, parsed.data.note ?? null]
    );
    // GREATEST(0, ...) prevents negative balance
    const updated = await runQuery<{ current_amount_clp: number }>(
      `update saving_goals
       set current_amount_clp = GREATEST(0, current_amount_clp + $2), updated_at = now()
       where id = $1
       returning current_amount_clp`,
      [goalId, parsed.data.amountClp]
    );
    return res.status(201).json({ currentAmountClp: Number(updated.rows[0]?.current_amount_clp ?? 0) });
  } catch {
    return res.status(500).json({ error: { message: "Could not register contribution" } });
  }
});

goalsRouter.delete("/:goalId", async (req, res) => {
  try {
    const goalId = req.params.goalId;
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const ownership = await runQuery<{ id: string }>(
      `select id from saving_goals where id = $1 and user_id = $2 limit 1`,
      [goalId, userId]
    );
    if (ownership.rows.length === 0) return res.status(404).json({ error: { message: "Goal not found" } });

    await runQuery(`delete from goal_contributions where goal_id = $1`, [goalId]);
    await runQuery(`delete from saving_goals where id = $1`, [goalId]);

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: { message: "Could not delete goal" } });
  }
});

goalsRouter.patch("/:goalId", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    targetAmountClp: z.number().int().positive().optional(),
    monthlyContributionClp: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const goalId = req.params.goalId;
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const ownership = await runQuery<{ id: string }>(
      `select id from saving_goals where id = $1 and user_id = $2 limit 1`,
      [goalId, userId]
    );
    if (ownership.rows.length === 0) return res.status(404).json({ error: { message: "Goal not found" } });

    const sets: string[] = [];
    const values: unknown[] = [goalId];
    if (parsed.data.name !== undefined) { values.push(parsed.data.name); sets.push(`name = $${values.length}`); }
    if (parsed.data.targetAmountClp !== undefined) { values.push(parsed.data.targetAmountClp); sets.push(`target_amount_clp = $${values.length}`); }
    if (parsed.data.monthlyContributionClp !== undefined) { values.push(parsed.data.monthlyContributionClp); sets.push(`monthly_contribution_clp = $${values.length}`); }

    if (sets.length === 0) return res.status(400).json({ error: { message: "Nothing to update" } });

    sets.push(`updated_at = now()`);
    const result = await runQuery<{
      id: string; name: string; target_amount_clp: number;
      monthly_contribution_clp: number; current_amount_clp: number; status: string;
    }>(
      `update saving_goals set ${sets.join(", ")} where id = $1
       returning id, name, target_amount_clp, monthly_contribution_clp, current_amount_clp, status`,
      values
    );

    const row = result.rows[0];
    return res.status(200).json({
      id: row.id, name: row.name,
      targetAmountClp: Number(row.target_amount_clp),
      monthlyContributionClp: Number(row.monthly_contribution_clp),
      currentAmountClp: Number(row.current_amount_clp),
      status: row.status,
    });
  } catch {
    return res.status(500).json({ error: { message: "Could not update goal" } });
  }
});
