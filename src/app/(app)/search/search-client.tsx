"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-muted-foreground text-sm">
          You don&apos;t have view access to any searchable service yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-muted-foreground text-sm">Search a service and request what you want added.</p>
      </div>

      <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row">
        <Select value={service} onValueChange={(value) => value && setService(value)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${selected?.label ?? ""}...`}
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((result) => {
            const alreadyRequested = requestedIds.has(result.externalId);
            return (
              <Card key={result.externalId} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-2 text-base">
                    <span className="line-clamp-2">{result.title}</span>
                    {result.year && (
                      <Badge variant="secondary" className="shrink-0">
                        {result.year}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-muted-foreground line-clamp-4 text-sm">
                    {result.overview ?? "No overview available."}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!selected?.canRequest || alreadyRequested || requestingId === result.externalId}
                    onClick={() => requestItem(result)}
                  >
                    {alreadyRequested
                      ? "Requested"
                      : requestingId === result.externalId
                        ? "Requesting…"
                        : selected?.canRequest
                          ? "Request"
                          : "No permission"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
