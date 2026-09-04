import { redirect } from "next/navigation";
import { Grid2x2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { getCurrentUser } from "@/lib/auth/session";

const ERROR_MESSAGES: Record<string, string> = {
  missing_state: "Your sign-in session expired before it could complete. Please try again.",
  oidc_failed: "Keycloak rejected the sign-in attempt. Please try again.",
  no_id_token: "Keycloak didn't return an identity token. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  return (
    <div
      className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-background p-6"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.12), transparent)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 60% 50% at 50% 30%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 30%, black, transparent)",
        }}
      />

      <div className="relative z-10 w-full max-w-[380px]">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div
            className="flex size-9 items-center justify-center rounded-[9px] text-base font-bold text-white"
            style={{ background: "linear-gradient(155deg,#8b5cf6,#6d28d9)" }}
          >
            {env.APP_TITLE.charAt(0).toUpperCase()}
          </div>
          <span className="text-[19px] font-semibold tracking-tight text-foreground">{env.APP_TITLE}</span>
        </div>

        <div className="rounded-[14px] border border-border bg-card px-7 py-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,.6)]">
          <div className="mb-6 text-center">
            <div className="mb-1 text-[15px] font-semibold text-foreground">Sign in to continue</div>
            <div className="text-[13px] text-muted-foreground">
              Authenticate with your household identity provider
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {ERROR_MESSAGES[error] ?? "Something went wrong signing you in. Please try again."}
            </p>
          )}

          <Button
            render={<a href="/api/auth/login" />}
            nativeButton={false}
            size="lg"
            className="w-full gap-2.5"
          >
            <Grid2x2 className="size-4" />
            Continue with Keycloak
          </Button>
        </div>
      </div>
    </div>
  );
}
