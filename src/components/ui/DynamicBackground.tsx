"use client";

import dynamic from "next/dynamic";

const Background = dynamic(
  () => import("@/components/ui/background").then((m) => ({ default: m.Background })),
  { ssr: false, loading: () => <div className="pointer-events-none absolute inset-0" aria-hidden /> }
);

export function DynamicBackground() {
  return <Background />;
}
