"use client";

import { useEffect, useMemo, useState } from "react";

import { filterLibraryModules } from "@/lib/library/filter";
import { LIBRARY_CATEGORY_ORDER } from "@/lib/library/constants";
import type { LibraryModuleListItem, StageKey } from "@/lib/library/types";
import { CategorySection } from "@/components/library/CategorySection";
import { SearchInput } from "@/components/library/SearchInput";
import { StageFilter } from "@/components/library/StageFilter";

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

export function LibraryBrowse({ modules: allModules }: LibraryBrowseProps) {
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedStages, setSelectedStages] = useState<Set<StageKey>>(() => new Set());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(rawQuery), 200);
    return () => window.clearTimeout(t);
  }, [rawQuery]);

  const filtered = useMemo(
    () => filterLibraryModules(allModules, debouncedQuery, selectedStages),
    [allModules, debouncedQuery, selectedStages],
  );

  const byAll = useMemo(() => groupByCategory(allModules), [allModules]);
  const byFiltered = useMemo(() => groupByCategory(filtered), [filtered]);
  const filterActive = debouncedQuery.trim().length > 0 || selectedStages.size > 0;

  const toggleStage = (stage: StageKey) => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  const clearStages = () => setSelectedStages(new Set());

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <SearchInput onChange={setRawQuery} value={rawQuery} />
        <StageFilter
          onAny={clearStages}
          onToggle={toggleStage}
          selected={selectedStages}
        />
      </div>
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
    </div>
  );
}
