const { Client } = require("pg");
const { randomUUID } = require("crypto");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

function buildHash(parts) {
  return parts.join("|").toLowerCase().replace(/\s+/g, "_");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString: databaseUrl });
  let connected = false;
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    try {
      await client.connect();
      connected = true;
      break;
    } catch (error) {
      if (attempt === 15) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  if (!connected) throw new Error("Database not ready");

  const userId = randomUUID();
  await client.query(
    `insert into users (id, email, full_name)
     values ($1, $2, $3)
     on conflict (email) do update set full_name = excluded.full_name`,
    [userId, "demo@finanzasapp.cl", "Usuario Demo"]
  );

  const categories = [
    { name: "Comida", color: "#FF6B6B" },
    { name: "Deuda", color: "#F6C90E" },
    { name: "Cuentas", color: "#5BC0EB" },
    { name: "Transporte", color: "#9B5DE5" },
    { name: "Sueldo", color: "#2ED47A" },
  ];

  for (const category of categories) {
    await client.query(
      `insert into categories (user_id, name, color_hex, is_system)
       values ($1, $2, $3, true)
       on conflict (user_id, lower(name)) do nothing`,
      [userId, category.name, category.color]
    );
  }

  const categoryRows = await client.query(
    `select id, name from categories where user_id = $1`,
    [userId]
  );
  const categoryByName = Object.fromEntries(categoryRows.rows.map((row) => [row.name, row.id]));

  const now = new Date();
  const txs = [
    {
      type: "income",
      amount: 570000,
      glosa: "Pago Sueldo",
      category: "Sueldo",
      merchant: "Empresa Demo",
    },
    {
      type: "expense",
      amount: 10000,
      glosa: "Pago Starbucks",
      category: "Comida",
      merchant: "Starbucks",
    },
    {
      type: "expense",
      amount: 60000,
      glosa: "Pago Internet Hogar",
      category: "Cuentas",
      merchant: "Proveedor Internet",
    },
  ];

  for (const tx of txs) {
    const dedupeHash = buildHash([userId, tx.type, String(tx.amount), tx.glosa, tx.merchant]);
    await client.query(
      `insert into transactions
      (user_id, category_id, type, source, amount_clp, occurred_at, merchant, raw_glosa, dedupe_hash, parser_version)
      values ($1, $2, $3, 'manual', $4, $5, $6, $7, $8, 'seed-v1')
      on conflict (user_id, dedupe_hash) do nothing`,
      [
        userId,
        categoryByName[tx.category] ?? null,
        tx.type,
        tx.amount,
        now.toISOString(),
        tx.merchant,
        tx.glosa,
        dedupeHash,
      ]
    );
  }

  await client.end();
  console.log("Seed completed successfully.");
}

main().catch((error) => {
  console.error("Failed to seed database:", error.message);
  process.exit(1);
});
