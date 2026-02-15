"use client";

import { memo, useCallback, useMemo, useEffect, useRef } from "react";
import { Link, Linktree } from "@/lib/db/queries";
import { appendMessageToUrl } from "@/lib/utils/message-url";
import { DynamicTemplate } from "@/components/templates/DynamicTemplate";
import type { TemplateTheme } from "@/components/templates";
import {
  deriveAccentColor,
  deriveBorderColor,
  deriveTextColor,
  deriveTextSecondaryColor,
  deriveHighlightColor,
} from "@/lib/utils/theme-colors";
import { queueView, queueClick } from "@/lib/utils/client-queue";
import { getBackgroundGradient, DEFAULT_BACKGROUND_COLOR } from "@/lib/config/background-gradients";

interface LinktreePageProps {
  linktree: Linktree;
  links: Link[];
}

export const LinktreePage = memo(function LinktreePage({ linktree, links }: LinktreePageProps) {
  // Ref to prevent duplicate view tracking in same mount (e.g. React Strict Mode)
  const viewTrackedRef = useRef(false);

  // Fix viewport height on iOS - must be client-side
  // This ensures proper height calculation on iPhone Safari
  // Performance: Debounced resize handler
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    let timeoutId: NodeJS.Timeout;
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    
    // Set on load
    setVH();
    
    // Debounced resize handler for better performance
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(setVH, 150); // Debounce 150ms
    };
    
    // Update on resize and orientation change
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", setVH, { passive: true });
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", setVH);
    };
  }, []);

  // Track page view on mount (once per mount). Uniqueness is handled by the database.
  useEffect(() => {
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    queueView(linktree.uid);
  }, [linktree.uid]);
  // Get background gradient or solid color based on background_color
  const baseTheme = useMemo(() => {
    const bgColor = linktree.background_color || DEFAULT_BACKGROUND_COLOR;
    return getBackgroundGradient(bgColor);
  }, [linktree.background_color]);

  // Extend theme with derived accent colors
  const theme: TemplateTheme = useMemo(() => {
    return {
      ...baseTheme,
      accent: deriveAccentColor(baseTheme.from, baseTheme.via, baseTheme.to),
      border: deriveBorderColor(baseTheme.from, baseTheme.via, baseTheme.to, 0.3),
      text: deriveTextColor(baseTheme.from, baseTheme.via, baseTheme.to),
      textSecondary: deriveTextSecondaryColor(baseTheme.from, baseTheme.via, baseTheme.to),
      highlight: deriveHighlightColor(baseTheme.from, baseTheme.via, baseTheme.to),
    };
  }, [baseTheme]);

  const backgroundStyle = useMemo(() => {
    if (theme.isSolid) {
      return theme.from;
    }
    return `linear-gradient(to bottom right, ${theme.from}, ${theme.via}, ${theme.to})`;
  }, [theme.from, theme.via, theme.to, theme.isSolid]);

  // Apply background color to body/page (client-side only to prevent hydration mismatch)
  // Optimized: Combined DOM updates and reduced re-renders
  useEffect(() => {
    // Only run on client to prevent hydration mismatch
    if (typeof window === 'undefined') return;
    
    // Batch DOM updates using requestAnimationFrame for better performance
    const rafId = requestAnimationFrame(() => {
      // Find the main background container using data attribute
      const bodyContainer = document.querySelector('body > div[data-theme-background]') as HTMLElement;
      
      if (bodyContainer) {
        // Apply the background (gradient or solid)
        bodyContainer.style.background = backgroundStyle;
        // Safari/iOS: Use 'scroll' instead of 'fixed' for better performance
        bodyContainer.style.backgroundAttachment = 'scroll';
      }
      
      // Update CSS variables in one batch
      const root = document.documentElement;
      root.style.setProperty('--theme-bg-from', theme.from);
      root.style.setProperty('--theme-bg-via', theme.isSolid ? theme.from : theme.via);
      root.style.setProperty('--theme-bg-to', theme.isSolid ? theme.from : theme.to);

      // Dispatch theme change event (debounced to prevent excessive events)
      window.dispatchEvent(
        new CustomEvent('theme-background-change', {
          detail: {
            from: theme.from,
            via: theme.isSolid ? theme.from : theme.via,
            to: theme.isSolid ? theme.from : theme.to,
          },
        })
      );
    });
    
    // Cleanup: restore default on unmount
    return () => {
      cancelAnimationFrame(rafId);
      if (typeof window === 'undefined') return;
      const container = document.querySelector('body > div[data-theme-background]') as HTMLElement;
      if (container) {
        container.style.background = '';
        container.style.backgroundAttachment = 'scroll';
      }
    };
  }, [backgroundStyle, theme.from, theme.via, theme.to, theme.isSolid]);

  const handleLinkClick = useCallback((linkId: string, url: string, platform: string, defaultMessage?: string | null) => {
    // Track click; ensure IDs are strings (can be undefined from serialization)
    const lid = linkId != null ? String(linkId).trim() : "";
    const ltId = linktree?.id != null ? String(linktree.id).trim() : "";
    if (lid && ltId) {
      queueClick(lid, ltId);
      // Flush soon so click is sent before user may leave
      import("@/lib/utils/client-queue").then(({ flushNow }) => flushNow().catch(() => {}));
    }

    // Append default message to URL if platform supports it
    const finalUrl = appendMessageToUrl(url, platform, defaultMessage);

    // Open link in new tab
    try {
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } catch {
      // Ignore popup blockers; user can tap again
    }
  }, [linktree?.id]);

  return (
    <>
      {/* Dynamic template renders based on template_config from database */}
      <DynamicTemplate
        linktree={linktree}
        links={links}
        theme={theme}
        onLinkClick={handleLinkClick}
      />
    </>
  );
});
