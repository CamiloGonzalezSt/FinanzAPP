import { Router } from "express";
import { z } from "zod";
import { runQuery } from "../../db/pool";
import crypto from "crypto";

export const transactionsRouter = Router();

const createTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amountClp: z.number().int().positive(),
  occurredAt: z.string(),
  rawGlosa: z.string().min(1),
  categoryId: z.string().uuid().optional(),
});

transactionsRouter.get("/", async (req, res) => {
  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
    const month = typeof req.query.month === "string" ? req.query.month : undefined;

    const filters: string[] = ["user_id = $1"];
    const params: unknown[] = [userId];

    if (type === "income" || type === "expense") {
      params.push(type);
      filters.push(`type = $${params.length}`);
    }
    if (categoryId) {
      params.push(categoryId);
      filters.push(`category_id = $${params.length}`);
    }
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      params.push(`${month}-01`);
      filters.push(`date_trunc('month', occurred_at) = date_trunc('month', $${params.length}::date)`);
    }

    const result = await runQuery<{
      id: string;
      type: "income" | "expense";
      amount_clp: number;
      raw_glosa: string;
      occurred_at: string;
      category_id: string | null;
      subject: string | null;
    }>(
      `select id, type, amount_clp, raw_glosa, occurred_at, category_id, subject
       from transactions
       where ${filters.join(" and ")}
       order by occurred_at desc
       limit 200`,
      params
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      amountClp: Number(row.amount_clp),
      rawGlosa: row.raw_glosa,
      occurredAt: row.occurred_at,
      categoryId: row.category_id ?? undefined,
      subject: row.subject ?? undefined,
    }));
    return res.status(200).json({ items });
  } catch {
    return res.status(500).json({ error: { message: "No se pudieron cargar las transacciones." } });
  }
});

transactionsRouter.post("/", async (req, res) => {
  const parsed = createTransactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const dedupeHash = crypto
      .createHash("sha256")
      .update([userId, parsed.data.type, parsed.data.amountClp, parsed.data.rawGlosa, parsed.data.occurredAt].join("|"))
      .digest("hex");

    const insertResult = await runQuery<{
      id: string;
      type: "income" | "expense";
      amount_clp: number;
      raw_glosa: string;
      occurred_at: string;
    }>(
      `insert into transactions
       (user_id, category_id, type, source, amount_clp, occurred_at, raw_glosa, dedupe_hash, parser_version)
       values ($1, $2, $3, 'manual', $4, $5, $6, $7, 'manual-v1')
       on conflict (user_id, dedupe_hash) do update set updated_at = now()
       returning id, type, amount_clp, raw_glosa, occurred_at`,
      [
        userId,
        parsed.data.categoryId ?? null,
        parsed.data.type,
        parsed.data.amountClp,
        parsed.data.occurredAt,
        parsed.data.rawGlosa,
        dedupeHash,
      ]
    );

    const row = insertResult.rows[0];
    return res.status(201).json({
      id: row.id,
      type: row.type,
      amountClp: Number(row.amount_clp),
      rawGlosa: row.raw_glosa,
      occurredAt: row.occurred_at,
    });
  } catch {
    return res.status(500).json({ error: { message: "Could not create transaction" } });
  }
});

transactionsRouter.patch("/:id", async (req, res) => {
  const schema = z.object({
    type: z.enum(["income", "expense"]).optional(),
    amountClp: z.number().int().positive().optional(),
    rawGlosa: z.string().min(1).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    occurredAt: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const userId = req.authUser?.id;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
  const { id } = req.params;

  try {
    const current = await runQuery<{ type: string; amount_clp: string; raw_glosa: string; occurred_at: string; category_id: string | null }>(
      `select type, amount_clp, raw_glosa, occurred_at, category_id from transactions where id = $1 and user_id = $2`,
      [id, userId]
    );
    if (current.rows.length === 0) return res.status(404).json({ error: { message: "Not found" } });

    const row = current.rows[0];
    const newType = parsed.data.type ?? row.type;
    const newAmount = parsed.data.amountClp ?? Number(row.amount_clp);
    const newGlosa = parsed.data.rawGlosa ?? row.raw_glosa;
    const newOccurredAt = parsed.data.occurredAt ?? row.occurred_at;
    const newCategoryId = parsed.data.categoryId !== undefined ? parsed.data.categoryId : row.category_id;

    const dedupeHash = crypto
      .createHash("sha256")
      .update([userId, newType, newAmount, newGlosa, newOccurredAt].join("|"))
      .digest("hex");

    await runQuery(
      `update transactions
       set type = $1, amount_clp = $2, raw_glosa = $3, occurred_at = $4,
           category_id = $5, dedupe_hash = $6, updated_at = now()
       where id = $7 and user_id = $8`,
      [newType, newAmount, newGlosa, newOccurredAt, newCategoryId, dedupeHash, id, userId]
    );
    return res.status(200).json({ updated: true });
  } catch {
    return res.status(500).json({ error: { message: "Could not update transaction" } });
  }
});

transactionsRouter.delete("/:id", async (req, res) => {
  const userId = req.authUser?.id;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
  const { id } = req.params;
  try {
    const result = await runQuery(
      `delete from transactions where id = $1 and user_id = $2`,
      [id, userId]
    );
    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: { message: "Transaction not found" } });
    }
    return res.status(200).json({ deleted: true });
  } catch {
    return res.status(500).json({ error: { message: "Could not delete transaction" } });
  }
});
