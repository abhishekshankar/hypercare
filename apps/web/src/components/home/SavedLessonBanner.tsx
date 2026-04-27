"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sp.get("saved") === "1") {
      setVisible(true);
      const t = setTimeout(() => {
        router.replace("/app");
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [sp, router]);

  if (!visible) {
    return null;
  }
  return (
    <p
      className="rounded-lg border border-accent/30 bg-amber-wash px-4 py-3 text-sm text-foreground"
      data-testid="lesson-saved-banner"
      role="status"
    >
      Saved. We won&apos;t show this lesson again for two weeks unless you revisit it.
    </p>
  );
}

export function SavedLessonBanner() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
