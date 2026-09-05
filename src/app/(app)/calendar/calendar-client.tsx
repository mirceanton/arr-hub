"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { serviceAccent } from "@/lib/service-style";
import type { CalendarEntry } from "@/lib/calendar";

export function CalendarClient({ entries }: { entries: CalendarEntry[] }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  const firstWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayNum = now.getDate();

  const entriesByDay = new Map<number, CalendarEntry[]>();
  for (const entry of entries) {
    const day = new Date(entry.date).getDate();
    entriesByDay.set(day, [...(entriesByDay.get(day) ?? []), entry]);
  }

  const dayEntries = selectedDay !== null ? (entriesByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <span className="text-[13px] font-semibold">Release calendar</span>
        <span className="font-mono text-[11px] text-muted-foreground">{monthLabel}</span>
      </div>

      <div className="p-4">
        <div className="mb-1.5 grid grid-cols-7 gap-1.5">
          {weekdays.map((wd, i) => (
            <div key={i} className="text-center font-mono text-[10px] text-muted-foreground/70">
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const isToday = d === todayNum;
            const dayItems = entriesByDay.get(d) ?? [];
            const hasRelease = dayItems.length > 0;
            return (
              <button
                key={d}
                type="button"
                onClick={() => hasRelease && setSelectedDay(d)}
                disabled={!hasRelease}
                className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md text-[11px] transition-colors disabled:cursor-default"
                style={{
                  color: isToday ? "#fff" : hasRelease ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.35)",
                  background: isToday ? "#8b5cf6" : hasRelease ? "rgba(139,92,246,.1)" : "transparent",
                  cursor: hasRelease ? "pointer" : undefined,
                }}
              >
                <span>{d}</span>
                {hasRelease && (
                  <span className="font-mono text-[8.5px] text-muted-foreground">{dayItems.length}</span>
                )}
              </button>
            );
          })}
        </div>
        {entries.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">Nothing scheduled this month.</p>
        )}
      </div>

      <Dialog open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedDay !== null &&
                new Date(now.getFullYear(), now.getMonth(), selectedDay).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {dayEntries.map((entry) => (
              <div
                key={`${entry.service}-${entry.id}`}
                className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2"
              >
                <span
                  className="h-6 w-[3px] shrink-0 rounded-sm"
                  style={{ background: serviceAccent(entry.service.toLowerCase()) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium">{entry.title}</div>
                  <div className="text-[11px] text-muted-foreground">{entry.service}</div>
                </div>
                <span
                  className="shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    color: serviceAccent(entry.service.toLowerCase()),
                    background: `${serviceAccent(entry.service.toLowerCase())}1f`,
                  }}
                >
                  {entry.mediaType}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
