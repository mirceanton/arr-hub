import { requireUser } from "@/lib/auth/session";
import { loadServiceCalendar } from "@/lib/calendar";
import { isAdmin } from "@/lib/permissions";
import * as repo from "@/lib/db/repository";
import { getConfiguredServiceIds } from "@/lib/services/registry";
import { CalendarClient } from "./calendar-client";
import { RequestsClient, type RequestRow } from "../requests/requests-client";

export const dynamic = "force-dynamic";

function currentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

export default async function CalendarPage() {
  const user = await requireUser();
  const admin = await isAdmin(user.id);
  const { start, end } = currentMonthRange();

  const [calendar, myRequests, history] = await Promise.all([
    loadServiceCalendar(start, end),
    repo.listRequestsByUser(user.id),
    admin
      ? repo.listRecentRequestsWithRequester(getConfiguredServiceIds(), 100)
      : Promise.resolve<RequestRow[]>([]),
  ]);

  // Non-admins only see release dates for things they've actually requested — everyone else's
  // requests (and library items nobody requested) stay out of their calendar view.
  const visibleCalendar = admin
    ? calendar
    : calendar.filter((entry) => myRequests.some((r) => r.title === entry.title));

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {admin
            ? "Upcoming releases across the household."
            : "Upcoming releases for what you've requested."}
        </p>
      </div>

      <CalendarClient entries={visibleCalendar} />

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          {admin ? "Request history" : "My request history"}
        </h2>
        <RequestsClient
          initialRequests={admin ? history : myRequests}
          showRequester={admin}
          emptyMessage="No requests yet."
        />
      </div>
    </div>
  );
}
