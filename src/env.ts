import { z } from "zod";

/**
 * Every media service the hub can talk to declares its env prefix here.
 * Adding a new service (e.g. `shelfmark`) means adding one entry to this
 * array plus a client implementation under `lib/services/` — nothing else
 * in this file needs to change.
 */
export const SERVICE_IDS = ["sonarr", "radarr", "lidarr", "bazarr"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

function serviceEnvShape() {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const id of SERVICE_IDS) {
    const prefix = id.toUpperCase();
    shape[`${prefix}_URL`] = z.url().optional().or(z.literal("").transform(() => undefined));
    shape[`${prefix}_API_KEY`] = z
      .string()
      .min(1)
      .optional()
      .or(z.literal("").transform(() => undefined));
  }
  return shape;
}

const rawSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required (file:./data/app.db or postgres://...)"),
    SESSION_SECRET: z
      .string()
      .min(32, "SESSION_SECRET must be at least 32 characters"),

    OIDC_ISSUER_URL: z.url(),
    OIDC_CLIENT_ID: z.string().min(1),
    OIDC_CLIENT_SECRET: z.string().min(1),
    OIDC_REDIRECT_URI: z.url(),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    PORT: z.coerce.number().int().positive().default(3000),

    ...serviceEnvShape(),
  })
  .superRefine((val, ctx) => {
    const record = val as unknown as Record<string, string | undefined>;
    for (const id of SERVICE_IDS) {
      const prefix = id.toUpperCase();
      const url = record[`${prefix}_URL`];
      const apiKey = record[`${prefix}_API_KEY`];
      if (Boolean(url) !== Boolean(apiKey)) {
        ctx.addIssue({
          code: "custom",
          message: `${prefix}_URL and ${prefix}_API_KEY must both be set or both be unset`,
          path: [`${prefix}_URL`],
        });
      }
    }
  });

export type Env = z.infer<typeof rawSchema> & {
  DB_DIALECT: "sqlite" | "postgres";
};

function parseEnv(): Env {
  const result = rawSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:\n" + z.prettifyError(result.error));
    process.exit(1);
  }

  const dbUrl = result.data.DATABASE_URL;
  const dialect: "sqlite" | "postgres" = dbUrl.startsWith("file:")
    ? "sqlite"
    : dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")
      ? "postgres"
      : (() => {
          console.error(
            `Invalid DATABASE_URL "${dbUrl}": must start with "file:" (SQLite) or "postgres(ql)://" (Postgres)`,
          );
          process.exit(1);
        })();

  return { ...result.data, DB_DIALECT: dialect };
}

export const env = parseEnv();

export interface ServiceEnvConfig {
  baseUrl: string;
  apiKey: string;
}

/** Returns the {baseUrl, apiKey} pair for a service, or null if it's not configured. */
export function getServiceEnvConfig(id: ServiceId): ServiceEnvConfig | null {
  const prefix = id.toUpperCase();
  const record = env as unknown as Record<string, string | undefined>;
  const baseUrl = record[`${prefix}_URL`];
  const apiKey = record[`${prefix}_API_KEY`];
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}
