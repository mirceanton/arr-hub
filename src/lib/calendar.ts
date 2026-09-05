import { serviceRegistry } from "@/lib/services/registry";
import type { CalendarItem } from "@/lib/services/types";

export type CalendarEntry = CalendarItem & { service: string };

/** Every configured service's calendar entries between start and end, merged and sorted by date. */
export async function loadServiceCalendar(start: Date, end: Date): Promise<CalendarEntry[]> {
  const entries = await Promise.all(
    [...serviceRegistry.values()]
      .filter((c) => c.getCalendar)
      .map(async (c) => {
        try {
          const items = await c.getCalendar!(start, end);
          return items.map((item) => ({ ...item, service: c.label }));
        } catch {
          return [];
        }
      }),
  );
  return entries.flat().sort((a, b) => a.date.localeCompare(b.date));
}
