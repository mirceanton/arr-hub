import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import postgres from "postgres";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { env } from "@/env";
import * as sqliteSchema from "./schema/sqlite";
import * as pgSchema from "./schema/postgres";

function createSqliteDb() {
  const path = env.DATABASE_URL.slice("file:".length);
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return {
    dialect: "sqlite" as const,
    db: drizzleSqlite(sqlite, { schema: sqliteSchema }),
    schema: sqliteSchema,
    raw: sqlite,
  };
}

function createPostgresDb() {
  const client = postgres(env.DATABASE_URL);
  return {
    dialect: "postgres" as const,
    db: drizzlePg(client, { schema: pgSchema }),
    schema: pgSchema,
    raw: client,
  };
}

function createDb() {
  return env.DB_DIALECT === "sqlite" ? createSqliteDb() : createPostgresDb();
}

export const dbConnection = createDb();
export const { dialect, db, schema } = dbConnection;
