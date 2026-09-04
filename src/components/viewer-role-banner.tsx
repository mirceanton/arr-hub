import { Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ViewerRoleBanner() {
  return (
    <Alert className="border-primary/30 bg-primary/5">
      <Eye />
      <AlertDescription className="text-foreground/90">
        You&apos;re signed in as a <strong>viewer</strong> — this app is read-only for your account.
      </AlertDescription>
    </Alert>
  );
}
