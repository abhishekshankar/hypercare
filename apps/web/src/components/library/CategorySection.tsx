import type { ReactNode } from "react";

import {
  LIBRARY_CATEGORY_ORDER,
  CATEGORY_SECTION_TITLES,
  type LibraryCategory,
} from "@/lib/library/constants";
import { ModuleCard } from "@/components/library/ModuleCard";
import type { LibraryModuleListItem } from "@/lib/library/types";

export { LIBRARY_CATEGORY_ORDER, CATEGORY_SECTION_TITLES };

type CategorySectionProps = Readonly<{
  category: LibraryCategory;
  unfiltered: readonly LibraryModuleListItem[];
  visible: readonly LibraryModuleListItem[];
  filterActive: boolean;
}>;

function categoryBody({
  unfiltered,
  visible,
  filterActive,
}: Pick<CategorySectionProps, "unfiltered" | "visible" | "filterActive">): ReactNode {
  if (visible.length > 0) {
    return (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => (
          <li key={m.slug}>
            <ModuleCard module={m} />
          </li>
        ))}
      </ul>
    );
  }
  if (filterActive && unfiltered.length > 0) {
    return (
      <p className="text-sm text-muted-foreground">No matches for your search or stage filters in this section.</p>
    );
  }
  if (unfiltered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No modules in this category yet. Expert content is still rolling out.</p>
    );
  }
  return null;
}

/**
 * One §7.1 section: accordion; empty category bodies stay collapsed (details closed).
 */
export function CategorySection({ category, unfiltered, visible, filterActive }: CategorySectionProps) {
  const title = CATEGORY_SECTION_TITLES[category];
  const n = visible.length;
  const total = unfiltered.length;
  const open =
    n > 0 ||
    (filterActive && total > 0 && n === 0) ||
    (!filterActive && total === 0);

  return (
    <section className="border-b border-border" data-testid={`library-section-${category}`}>
      <details className="group" open={open}>
        <summary className="cursor-pointer list-none py-3 font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-baseline gap-2">
            {title}
            <span className="text-sm font-normal text-muted-foreground">
              ({n}
              {filterActive && n !== total ? ` of ${String(total)}` : ""})
            </span>
          </span>
        </summary>
        <div className="pb-6 pt-1">{categoryBody({ unfiltered, visible, filterActive })}</div>
      </details>
    </section>
  );
}
