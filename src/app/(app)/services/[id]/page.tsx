import { redirect } from "next/navigation";
import type { ServiceId } from "@/env";
import { requireUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { getServiceClient } from "@/lib/services/registry";

export const dynamic = "force-dynamic";

export default async function ServiceViewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) redirect("/");

  const { id } = await params;
  const client = getServiceClient(id as ServiceId);
  if (!client) redirect("/");

  const proxyPath = `/api/proxy/${id}/`;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{client.label}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Break-glass admin view, proxied from the internal service through arr-hub.
          </p>
        </div>
        <a
          href={proxyPath}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Open in new tab
        </a>
      </div>
      <iframe
        src={proxyPath}
        title={`${client.label} (embedded)`}
        className="min-h-[70vh] w-full flex-1 rounded-[10px] border border-border bg-card"
      />
    </div>
  );
}
