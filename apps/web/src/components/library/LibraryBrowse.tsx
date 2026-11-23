"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LibraryResultRow, type LibraryStreamResult } from "@/components/library/LibraryResultRow";
import { CategorySection } from "@/components/library/CategorySection";
import { SearchInput } from "@/components/library/SearchInput";
import { StageFilter } from "@/components/library/StageFilter";
import { streamingLibraryClientEnabled } from "@/lib/env.client";
import { filterLibraryModules, matchesStageFilter } from "@/lib/library/filter";
import { LIBRARY_CATEGORY_ORDER } from "@/lib/library/constants";
import type { LibraryModuleListItem, StageKey } from "@/lib/library/types";
import { createSseParser, parseSseDataJson } from "@/lib/sse";

type LibraryBrowseProps = Readonly<{
  modules: readonly LibraryModuleListItem[];
}>;

function groupByCategory(
  list: readonly LibraryModuleListItem[],
): Map<string, LibraryModuleListItem[]> {
  const m = new Map<string, LibraryModuleListItem[]>();
  for (const c of LIBRARY_CATEGORY_ORDER) {
    m.set(c, []);
  }
  for (const mod of list) {
    const arr = m.get(mod.category);
    if (arr) arr.push(mod);
  }
  return m;
}

function isStreamResultRow(value: unknown): value is LibraryStreamResult {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.kind === "string" &&
    typeof o.title === "string" &&
    typeof o.snippet === "string" &&
    typeof o.score === "number" &&
    typeof o.source === "string"
  );
}

export function LibraryBrowse({ modules: allModules }: LibraryBrowseProps) {
  const useStream = streamingLibraryClientEnabled();
  const debounceMs = useStream ? 150 : 200;

  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedStages, setSelectedStages] = useState<Set<StageKey>>(() => new Set());

  const [streamRows, setStreamRows] = useState<LibraryStreamResult[]>([]);
  const [streamBusy, setStreamBusy] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  /** Server returned 404 (STREAMING_LIBRARY off); fall back to TASK-023 client filter until query is cleared. */
  const [streamDisabled, setStreamDisabled] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const prevDebouncedRef = useRef("");

  useEffect(() => {
    if (rawQuery.trim() === "") {
      setDebouncedQuery("");
      return;
    }
    const t = window.setTimeout(() => setDebouncedQuery(rawQuery), debounceMs);
    return () => window.clearTimeout(t);
  }, [rawQuery, debounceMs]);

  useEffect(() => {
    if (rawQuery.trim() === "") {
      searchAbortRef.current?.abort();
      setStreamRows([]);
      setStreamBusy(false);
      setStreamError(null);
      setStreamDisabled(false);
    }
  }, [rawQuery]);

  useEffect(() => {
    if (!useStream) {
      return;
    }
    if (prevDebouncedRef.current !== debouncedQuery) {
      setStreamDisabled(false);
      prevDebouncedRef.current = debouncedQuery;
    }
    const q = debouncedQuery.trim();
    searchAbortRef.current?.abort();
    if (q.length === 0) {
      return;
    }

    const ac = new AbortController();
    searchAbortRef.current = ac;
    setStreamBusy(true);
    setStreamError(null);
    setStreamRows([]);

    void (async () => {
      try {
        const res = await fetch("/api/app/library/search", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "text/event-stream",
          },
          body: JSON.stringify({ query: q }),
          signal: ac.signal,
        });

        if (res.status === 404) {
          setStreamDisabled(true);
          setStreamBusy(false);
          setStreamRows([]);
          return;
        }

        if (!res.ok) {
          setStreamError("Search didn’t load — try again");
          setStreamBusy(false);
          return;
        }

        const reader = res.body?.getReader();
        if (reader == null) {
          setStreamError("Search didn’t load — try again");
          setStreamBusy(false);
          return;
        }

        const parser = createSseParser((ev) => {
          if (ev.event === "result") {
            const j = parseSseDataJson<unknown>(ev.data);
            if (isStreamResultRow(j)) {
              setStreamRows((prev) => [...prev, j]);
            }
            return;
          }
          if (ev.event === "done") {
            setStreamBusy(false);
            return;
          }
          if (ev.event === "error") {
            const r = parseSseDataJson<{ message?: string }>(ev.data);
            setStreamError(r?.message ?? "Search failed");
            setStreamBusy(false);
          }
        });

        for (;;) {
          const { done, value } = await reader.read();
          if (value) {
            parser.push(value);
          }
          if (done) {
            parser.end();
            break;
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        if ((e as Error).name === "AbortError") {
          return;
        }
        if (!ac.signal.aborted) {
          setStreamError(e instanceof Error ? e.message : "Search failed");
          setStreamBusy(false);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [useStream, debouncedQuery]);

  const filtered = useMemo(
    () => filterLibraryModules(allModules, debouncedQuery, selectedStages),
    [allModules, debouncedQuery, selectedStages],
  );

  const visibleStreamRows = useMemo(() => {
    return streamRows.filter((r) => {
      if (r.kind === "saved_answer") {
        return true;
      }
      if (r.kind === "recent_topic") {
        return true;
      }
      if (r.module != null) {
        return matchesStageFilter(r.module, selectedStages);
      }
      return false;
    });
  }, [streamRows, selectedStages]);

  const byAll = useMemo(() => groupByCategory(allModules), [allModules]);
  const byFiltered = useMemo(() => groupByCategory(filtered), [filtered]);
  const filterActive = debouncedQuery.trim().length > 0 || selectedStages.size > 0;

  const showStreamSurface =
    useStream && !streamDisabled && debouncedQuery.trim().length > 0;

  const toggleStage = (stage: StageKey) => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const clearStages = () => setSelectedStages(new Set());

  const clearSearchAndAbort = useCallback(() => {
    searchAbortRef.current?.abort();
    setRawQuery("");
    setDebouncedQuery("");
    setStreamRows([]);
    setStreamBusy(false);
    setStreamError(null);
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <SearchInput onChange={setRawQuery} onEscape={clearSearchAndAbort} value={rawQuery} />
        <StageFilter
          onAny={clearStages}
          onToggle={toggleStage}
          selected={selectedStages}
        />
      </div>

      {showStreamSurface ? (
        <div className="space-y-3">
          {streamError != null ? (
            <p className="text-sm text-destructive" data-testid="library-stream-error" role="alert">
              {streamError}
            </p>
          ) : null}
          <ul aria-live="polite" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleStreamRows.map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                <LibraryResultRow row={row} />
              </li>
            ))}
          </ul>
          {filterActive && visibleStreamRows.length === 0 && !streamBusy && streamError == null ? (
            <p className="text-sm text-muted-foreground">
              No matches for your search or stage filters in this section.
            </p>
          ) : null}
          {streamBusy ? (
            <p className="text-sm text-muted-foreground" data-testid="library-stream-busy">
              Still searching…
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-0">
          {LIBRARY_CATEGORY_ORDER.map((cat) => (
            <CategorySection
              category={cat}
              filterActive={filterActive}
              key={cat}
              unfiltered={byAll.get(cat) ?? []}
              visible={byFiltered.get(cat) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
