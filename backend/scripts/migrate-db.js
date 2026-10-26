import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
    throw new Error("Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD in backend/.env first.");
  }
  await pool.query(await fs.readFile(path.join(here, "../db/schema.sql"), "utf8"));
  console.log("Additive database schema is ready. Existing rows were not deleted or reset.");
} catch (error) {
  console.error(`Database migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
