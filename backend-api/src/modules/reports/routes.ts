import { Router } from "express";
import { runQuery } from "../../db/pool";

export const reportsRouter = Router();

reportsRouter.get("/dashboard", async (req, res) => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  try {
    const result = await runQuery<{ type: "income" | "expense"; total: string }>(
      `select type, coalesce(sum(amount_clp), 0)::text as total
       from transactions
       where user_id = $1
         and date_trunc('month', occurred_at) = date_trunc('month', now())
       group by type`,
      [req.authUser?.id]
    );

    const income = Number(result.rows.find((row: { type: "income" | "expense"; total: string }) => row.type === "income")?.total ?? 0);
    const expense = Number(result.rows.find((row: { type: "income" | "expense"; total: string }) => row.type === "expense")?.total ?? 0);
    const saving = income - expense;
    const overspendPercent = income > 0 ? Math.max(0, ((expense - income) / income) * 100) : 0;

    return res.status(200).json({
      month,
      incomeTotalClp: income,
      expenseTotalClp: expense,
      savingTotalClp: saving,
      overspendPercent: Number(overspendPercent.toFixed(2)),
    });
  } catch {
    return res.status(500).json({ error: { message: "No se pudieron cargar los datos del dashboard." } });
  }
});

reportsRouter.get("/monthly-comparison", async (_req, res) => {
  try {
    const userId = _req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const result = await runQuery<{ month: string; income: string; expense: string }>(
      `select to_char(date_trunc('month', occurred_at), 'YYYY-MM') as month,
              coalesce(sum(case when type = 'income' then amount_clp else 0 end), 0)::text as income,
              coalesce(sum(case when type = 'expense' then amount_clp else 0 end), 0)::text as expense
       from transactions
       where user_id = $1
       group by date_trunc('month', occurred_at)
       order by date_trunc('month', occurred_at) desc
       limit 6`,
      [userId]
    );

    return res.status(200).json({
      items: result.rows
        .reverse()
        .map((row) => ({ month: row.month, incomeTotalClp: Number(row.income), expenseTotalClp: Number(row.expense) })),
    });
  } catch {
    return res.status(200).json({ items: [] });
  }
});

reportsRouter.get("/spending-by-category", async (_req, res) => {
  try {
    const userId = _req.authUser?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const result = await runQuery<{ category_name: string; total: string }>(
      `select coalesce(c.name, 'Sin categoria') as category_name,
              coalesce(sum(t.amount_clp), 0)::text as total
       from transactions t
       left join categories c on c.id = t.category_id
       where t.user_id = $1
         and t.type = 'expense'
         and date_trunc('month', t.occurred_at) = date_trunc('month', now())
       group by coalesce(c.name, 'Sin categoria')
       order by sum(t.amount_clp) desc`,
      [userId]
    );

    return res.status(200).json({
      items: result.rows.map((row) => ({ categoryName: row.category_name, totalClp: Number(row.total) })),
    });
  } catch {
    return res.status(200).json({ items: [] });
  }
});

reportsRouter.get("/export.csv", async (_req, res) => {
  try {
    const userId = _req.authUser?.id;
    if (!userId) {
      res.setHeader("Content-Type", "text/csv");
      return res.status(401).send("error\nunauthorized");
    }

    const result = await runQuery<{ type: string; amount_clp: number; raw_glosa: string; occurred_at: string }>(
      `select type, amount_clp, raw_glosa, occurred_at
       from transactions
       where user_id = $1
       order by occurred_at desc`,
      [userId]
    );

    const csvRows = ["type,amountClp,rawGlosa,occurredAt"];
    for (const row of result.rows) {
      csvRows.push(`${row.type},${row.amount_clp},"${row.raw_glosa.replace(/"/g, '""')}",${row.occurred_at}`);
    }
    res.setHeader("Content-Type", "text/csv");
    return res.status(200).send(csvRows.join("\n"));
  } catch {
    res.setHeader("Content-Type", "text/csv");
    return res.status(200).send("type,amountClp,rawGlosa,occurredAt\n");
  }
});
