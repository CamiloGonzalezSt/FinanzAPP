const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const schemaPath = path.resolve(__dirname, "../../docs/data/schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

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
  await client.query(schemaSql);
  await client.end();
  console.log("Database schema applied successfully.");
}

main().catch((error) => {
  console.error("Failed to initialize database:", error.message);
  process.exit(1);
});
