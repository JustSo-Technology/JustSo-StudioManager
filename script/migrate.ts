import { createHash } from "crypto";
import { readdir, readFile } from "fs/promises";
import path from "path";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running migrations.");
}

const migrationsDir = path.resolve("migrations");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();

  try {
    await client.query(`
      create table if not exists app_migrations (
        id text primary key,
        hash text not null,
        applied_at timestamp without time zone not null default now()
      );
    `);

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const id = file.replace(/\.sql$/, "");
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query("select hash from app_migrations where id = $1", [id]);

      if (existing.rowCount) {
        if (existing.rows[0].hash !== hash) {
          throw new Error(`Migration ${id} has changed since it was applied.`);
        }
        console.log(`Skipping ${id}`);
        continue;
      }

      console.log(`Applying ${id}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into app_migrations (id, hash) values ($1, $2)", [id, hash]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
