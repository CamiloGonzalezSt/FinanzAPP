import { Router } from "express";
import { z } from "zod";
import { runQuery } from "../../db/pool";

export const budgetsRouter = Router();

const upsertBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  year: z.number().int().gte(2020),
  month: z.number().int().min(1).max(12),
  amountLimitClp: z.number().int().positive(),
});

budgetsRouter.get("/", async (req, res) => {
  const monthParam = typeof req.query.month === "string" ? req.query.month : undefined;
  const now = new Date();
  const [year, month] = monthParam?.split("-").map(Number) ?? [now.getFullYear(), now.getMonth() + 1];

  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const result = await runQuery<{
      id: string;
      category_id: string;
      year: number;
      month: number;
      amount_limit_clp: number;
    }>(
      `select id, category_id, year, month, amount_limit_clp
       from budgets
       where user_id = $1 and year = $2 and month = $3
       order by created_at desc`,
      [userId, year, month]
    );

    return res.status(200).json({
      items: result.rows.map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        year: row.year,
        month: row.month,
        amountLimitClp: Number(row.amount_limit_clp),
      })),
    });
  } catch {
    return res.status(200).json({ items: [] });
  }
});

budgetsRouter.put("/", async (req, res) => {
  const parsed = upsertBudgetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const result = await runQuery<{
      id: string;
      category_id: string;
      year: number;
      month: number;
      amount_limit_clp: number;
    }>(
      `insert into budgets (user_id, category_id, period, year, month, amount_limit_clp)
       values ($1, $2, 'monthly', $3, $4, $5)
       on conflict (user_id, category_id, period, year, month)
       do update set amount_limit_clp = excluded.amount_limit_clp, updated_at = now()
       returning id, category_id, year, month, amount_limit_clp`,
      [userId, parsed.data.categoryId, parsed.data.year, parsed.data.month, parsed.data.amountLimitClp]
    );

    const row = result.rows[0];
    return res.status(200).json({
      id: row.id,
      categoryId: row.category_id,
      year: row.year,
      month: row.month,
      amountLimitClp: Number(row.amount_limit_clp),
    });
  } catch {
    return res.status(500).json({ error: { message: "Could not save budget" } });
  }
});
