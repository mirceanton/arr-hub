import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { db, dialect } from "./client";
import { ensureRolesSeeded } from "./repository";
import { logger } from "@/lib/logger";

export async function runMigrations(): Promise<void> {
  if (dialect === "sqlite") {
    migrateSqlite(db as never, { migrationsFolder: "drizzle/sqlite" });
  } else {
    await migratePg(db as never, { migrationsFolder: "drizzle/postgres" });
  }
  await ensureRolesSeeded();
  logger.info({ dialect }, "database migrations applied");
}
