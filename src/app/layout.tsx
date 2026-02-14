import type { Metadata, Viewport } from "next";
import { TikTokPixel } from "@/components/analytics/TikTokPixel";
import { AnimatedGradientOverlay } from "@/components/ui/animated-gradient-overlay";
import { DynamicBackground } from "@/components/ui/DynamicBackground";
import "./globals.css";

// Get base URL from environment variable or default to localhost
const getMetadataBase = (): string => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    return appUrl;
  }
  // Default fallback
  if (process.env.NODE_ENV === "production") {
    return "https://ari.com"; // Update with your production domain
  }
  return "http://localhost:3001";
};

export const metadata: Metadata = {
  metadataBase: new URL(getMetadataBase()),
  title: "Ari Sponsar",
  description:
    "Ari Sponsar connects communities with sponsorship opportunities tailored for growth and support.",
  icons: {
    icon: "/favicon.ico",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#4b5563",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover", // For devices with notches
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ku" dir="rtl">
      <head>
        <link rel="dns-prefetch" href="https://analytics.tiktok.com" />
        <link rel="preconnect" href="https://analytics.tiktok.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#4b5563" />
        {/* Prevent browser caching of HTML pages */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {/* Safari/iOS specific meta tags - Required for proper iPhone functionality */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta name="format-detection" content="telephone=no" />
        {/* Browser compatibility meta tags */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <div 
          data-theme-background
          className="relative min-h-screen w-full overflow-hidden text-white"
          style={{
            background: `linear-gradient(to bottom right, var(--theme-bg-from, #0b1224), var(--theme-bg-via, #1c2d52), var(--theme-bg-to, #b7791f))`,
            backgroundAttachment: 'scroll', // Safari/iOS: Use scroll instead of fixed for better performance
            backgroundSize: '200% 200%',
            contain: 'layout style paint', // Performance optimization
            isolation: 'isolate', // Create new stacking context
          }}
          suppressHydrationWarning
        >
          {/* Animated gradient overlay */}
          <AnimatedGradientOverlay />
          <DynamicBackground />
          <div className="relative z-10" suppressHydrationWarning>
            {children}
          </div>
        </div>
        <TikTokPixel />
      </body>
    </html>
  );
}
