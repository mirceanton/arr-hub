"use client";

import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { mediaTypeLabel, serviceAccent } from "@/lib/service-style";
import type { SearchResult } from "@/lib/services/types";

interface ServiceOption {
  id: string;
  label: string;
  mediaType: string;
  canRequest: boolean;
}

export function SearchClient({ services }: { services: ServiceOption[] }) {
  const [service, setService] = useState(services[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const selected = services.find((s) => s.id === service);
  const accent = serviceAccent(service);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !query.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch(`/api/search?service=${service}&q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Search failed");
        return;
      }
      setResults(await res.json());
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function requestItem(result: SearchResult) {
    if (!selected) return;
    setRequestingId(result.externalId);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: selected.id,
          externalId: result.externalId,
          title: result.title,
          mediaType: result.mediaType,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Request failed");
        return;
      }
      setRequestedIds((prev) => new Set(prev).add(result.externalId));
      toast.success(`Requested "${result.title}"`);
    } catch {
      toast.error("Request failed");
    } finally {
      setRequestingId(null);
    }
  }

  if (services.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t have view access to any searchable service yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Search and request what you want added.
        </p>
      </div>

      <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row">
        <Select value={service} onValueChange={(value) => value && setService(value)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Type">
              {(value: string) => {
                const svc = services.find((s) => s.id === value);
                return svc ? mediaTypeLabel(svc.mediaType) : "Type";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: serviceAccent(s.id) }}
                  />
                  {mediaTypeLabel(s.mediaType)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${selected ? mediaTypeLabel(selected.mediaType) : ""}...`}
            className="pl-9"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-8 shrink-0 rounded-lg px-4 text-sm font-semibold text-primary-foreground transition-colors disabled:opacity-50"
          style={{ background: accent }}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((result) => {
            const alreadyRequested = requestedIds.has(result.externalId);
            const btnLabel = alreadyRequested
              ? "Requested"
              : requestingId === result.externalId
                ? "Requesting…"
                : selected?.canRequest
                  ? "Request"
                  : "No permission";
            return (
              <div
                key={result.externalId}
                className="overflow-hidden rounded-[10px] border border-border bg-card"
              >
                <div className="relative aspect-[2/3] w-full">
                  <div
                    className="absolute inset-0 flex items-center justify-center p-3 text-center font-mono text-[10px]"
                    style={{
                      color: "rgba(255,255,255,.3)",
                      backgroundImage: `repeating-linear-gradient(45deg, ${accent}22, ${accent}22 8px, rgba(255,255,255,.02) 8px, rgba(255,255,255,.02) 16px)`,
                    }}
                  >
                    poster art
                  </div>
                  {result.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external poster hosts (TMDB/Fanart), not worth a next/image remotePatterns allowlist
                    <img
                      src={result.posterUrl}
                      alt={result.title}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  ) : null}
                </div>
                <div className="px-3 py-2.5">
                  <div className="mb-0.5 truncate text-[12.5px] font-semibold">{result.title}</div>
                  <div className="mb-2 text-[11px] text-muted-foreground">
                    {result.year ?? "—"} &middot; {selected ? mediaTypeLabel(selected.mediaType) : ""}
                  </div>
                  <p className="mb-2.5 line-clamp-3 text-[11.5px] text-muted-foreground/80">
                    {result.overview ?? "No overview available."}
                  </p>
                  <button
                    onClick={() => requestItem(result)}
                    disabled={!selected?.canRequest || alreadyRequested || requestingId === result.externalId}
                    className="w-full rounded-md border py-1.5 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed"
                    style={
                      alreadyRequested
                        ? { background: "rgba(34,197,94,.12)", borderColor: "rgba(34,197,94,.3)", color: "#22c55e" }
                        : { background: "transparent", borderColor: "rgba(255,255,255,.15)", color: "#fafafa" }
                    }
                  >
                    {btnLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
