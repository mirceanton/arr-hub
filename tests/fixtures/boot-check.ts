import { env } from "@/env";
import { getConfiguredServiceIds } from "@/lib/services/registry";

console.log(JSON.stringify({ dialect: env.DB_DIALECT, configuredServices: getConfiguredServiceIds() }));
