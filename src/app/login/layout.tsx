import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "چوونەژوورەوە - Ari Sponsar",
  description: "چوونەژوورەوە بۆ بەڕێوەبردنی Ari Sponsar",
  robots: "noindex, nofollow", // Don't index login page
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
