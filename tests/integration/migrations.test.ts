import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The local Postgres test container from docker-compose.test.yml (see
 * docker-compose.test.md). This intentionally does NOT read DATABASE_URL /
 * env.ts, since this test's whole point is to run the migration set against
 * BOTH dialects in the same process regardless of which one the current
 * .env.local happens to be pointed at.
 */
const PG_ADMIN_URL = "postgresql://arrhub:arrhub@localhost:5433/arrhub";
const TEST_DB_NAME = `arrhub_migration_check_${Date.now()}`;

interface TableShape {
  table: string;
  columns: string[];
}

async function pgReachable(): Promise<boolean> {
  try {
    const sql = postgres(PG_ADMIN_URL, { max: 1, connect_timeout: 3 });
    await sql`select 1`;
    await sql.end();
    return true;
  } catch {
    return false;
  }
}

function normalizeShapes(shapes: TableShape[]): TableShape[] {
  return shapes
    .map((s) => ({ table: s.table, columns: [...s.columns].sort() }))
    .sort((a, b) => a.table.localeCompare(b.table));
}

describe("Migrations produce the same logical schema on both dialects", () => {
  let sqliteDir: string;
  let sqliteShapes: TableShape[] = [];
  let pgShapes: TableShape[] = [];
  let hasPg = false;

  beforeAll(async () => {
    hasPg = await pgReachable();

    // --- SQLite: fresh file in a throwaway temp dir ---
    sqliteDir = mkdtempSync(join(tmpdir(), "arr-hub-migration-test-"));
    const sqlitePath = join(sqliteDir, "test.db");
    const sqlite = new Database(sqlitePath);
    migrateSqlite(drizzleSqlite(sqlite), { migrationsFolder: "drizzle/sqlite" });
    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all() as { name: string }[];
    sqliteShapes = tables.map((t) => {
      const cols = sqlite.prepare(`PRAGMA table_info(${t.name})`).all() as { name: string }[];
      return { table: t.name, columns: cols.map((c) => c.name) };
    });
    sqlite.close();

    if (!hasPg) return;

    // --- Postgres: fresh throwaway database on the local test container ---
    const admin = postgres(PG_ADMIN_URL, { max: 1 });
    await admin.unsafe(`CREATE DATABASE ${TEST_DB_NAME}`);
    await admin.end();

    const testDbUrl = PG_ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);
    const pgClient = postgres(testDbUrl, { max: 1 });
    await migratePg(drizzlePg(pgClient), { migrationsFolder: "drizzle/postgres" });

    const tableRows = await pgClient<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name NOT LIKE '__drizzle%'
    `;
    pgShapes = await Promise.all(
      tableRows.map(async (t) => {
        const colRows = await pgClient<{ column_name: string }[]>`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ${t.table_name}
        `;
        return { table: t.table_name, columns: colRows.map((c) => c.column_name) };
      }),
    );
    await pgClient.end();
  });

  afterAll(async () => {
    rmSync(sqliteDir, { recursive: true, force: true });
    if (!hasPg) return;
    const admin = postgres(PG_ADMIN_URL, { max: 1 });
    // Terminate any lingering connections before dropping, or DROP DATABASE fails.
    await admin.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()`,
    );
    await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await admin.end();
  });

  it("produced a non-empty schema on SQLite", () => {
    expect(sqliteShapes.length).toBeGreaterThan(0);
    expect(sqliteShapes.map((s) => s.table).sort()).toEqual(
      ["requests", "roles", "service_events", "service_permissions", "sessions", "user_roles", "users"].sort(),
    );
  });

  it("produces the identical set of tables and columns on a fresh Postgres database", (ctx) => {
    if (!hasPg) {
      ctx.skip();
      return;
    }
    expect(normalizeShapes(pgShapes)).toEqual(normalizeShapes(sqliteShapes));
  });
});
