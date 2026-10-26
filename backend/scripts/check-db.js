import "dotenv/config";
import { pool } from "../db.js";

try {
  const { rows } = await pool.query("SELECT current_database() AS database, current_user AS user, version() AS version");
  const exists = await pool.query("SELECT to_regnamespace('nextgen_app') IS NOT NULL AS schema_ready");
  console.log(JSON.stringify({ ...rows[0], schema_ready: exists.rows[0].schema_ready }, null, 2));
} catch (error) {
  console.error(`Database connection check failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
