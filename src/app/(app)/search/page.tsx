import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getRequestableServices } from "@/lib/services/registry";
import { SearchClient } from "./search-client";

export default async function SearchPage() {
  const user = await requireUser();
  const requestable = getRequestableServices();

  const [viewFlags, requestFlags] = await Promise.all([
    Promise.all(requestable.map((c) => can(user.id, c.id, "view"))),
    Promise.all(requestable.map((c) => can(user.id, c.id, "request"))),
  ]);

  const services = requestable
    .map((c, i) => ({
      id: c.id,
      label: c.label,
      mediaType: c.mediaType,
      canRequest: requestFlags[i],
      supportsSeasonSelection: Boolean(c.listSeasons),
    }))
    .filter((_, i) => viewFlags[i]);

  return <SearchClient services={services} />;
}
