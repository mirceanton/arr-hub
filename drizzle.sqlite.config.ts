import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema/sqlite.ts",
  out: "./drizzle/sqlite",
  dbCredentials: {
    url: (process.env.DATABASE_URL ?? "file:./data/app.db").replace(/^file:/, ""),
  },
});
