import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { pool } from "./db/pool";

async function runStartupMigrations() {
  if (!pool) return;
  try {
    await pool.query(`
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parent_id);
    `);
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username)) WHERE username IS NOT NULL;
    `);
    logger.info("Startup migrations OK");
  } catch {
    logger.warn("Startup migration skipped (table may not exist yet; run db:init first)");
  }
}

runStartupMigrations().then(() => {
  app.listen(env.port, () => {
    logger.info({ port: env.port }, "Backend API listening");
  });
});
