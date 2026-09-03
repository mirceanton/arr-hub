import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Arr Hub</CardTitle>
          <CardDescription>Sign in to search, request, and manage your media.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {ERROR_MESSAGES[error] ?? "Something went wrong signing you in. Please try again."}
            </p>
          )}
          <Button render={<a href="/api/auth/login" />} nativeButton={false} size="lg">
            Sign in with Keycloak
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
