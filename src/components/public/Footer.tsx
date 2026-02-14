"use client";

import { memo, useCallback } from "react";
import type { MouseEvent } from "react";
import { SPONSOR_TEXT, DEFAULT_FOOTER_NAME, DEFAULT_FOOTER_PHONE } from "@/lib/constants/footer";

interface FooterProps {
  footerText?: string | null;
  footerPhone?: string | null;
  footerHidden?: boolean;
  transparent?: boolean;
  textColor?: string;
  textSecondaryColor?: string;
}

export const Footer = memo(function Footer({
  footerText,
  footerPhone,
  footerHidden = false,
  transparent: _transparent = false,
  textColor = "#ffffff",
  textSecondaryColor = "rgba(255, 255, 255, 0.7)",
}: FooterProps) {
  // Use footerPhone from database if present, otherwise default to configured number
  const phoneNumber = footerPhone?.trim() || DEFAULT_FOOTER_PHONE;
  // Ensure phone number has country code format (add + if missing, but wa.me doesn't need +)
  const cleanPhone = phoneNumber.startsWith("+") ? phoneNumber.slice(1) : phoneNumber;
  
  // Hooks must be called before any early returns
  const handleAriWhatsApp = useCallback((e: MouseEvent<HTMLButtonElement | HTMLParagraphElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const whatsappUrl = `https://wa.me/${cleanPhone}`;

    // Always open WhatsApp chat in a new tab to avoid duplicate targets
    try {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } catch {
      // Ignore popup blockers; user can tap again
    }
  }, [cleanPhone]);

  // Don't render footer if hidden (after hooks)
  if (footerHidden) {
    return null;
  }
  
  const sponsorText = SPONSOR_TEXT; // Always fixed sponsor text
  const nameText = footerText?.trim() || DEFAULT_FOOTER_NAME; // Clickable admin-configured name

  // Detect if background is light or dark for soft colored button
  const isLightBackground = textColor !== "#ffffff" && textColor !== "#00ff00";

  // System primary yellow (globals.css: --color-brand-400 #facc15, brand-500 #eab308, brand-300 #fde047)
  const buttonBg = isLightBackground
    ? "rgba(254, 249, 195, 0.85)"
    : "rgba(250, 204, 21, 0.14)";
  const buttonBgHover = isLightBackground
    ? "rgba(254, 249, 195, 1)"
    : "rgba(250, 204, 21, 0.22)";
  const buttonBorder = isLightBackground
    ? "rgba(234, 179, 8, 0.35)"
    : "rgba(250, 204, 21, 0.4)";
  const buttonBorderHover = isLightBackground
    ? "rgba(234, 179, 8, 0.55)"
    : "rgba(250, 204, 21, 0.55)";
  const buttonTextColor = isLightBackground
    ? "#713f12"
    : "#fef08a";
  const buttonShadow = isLightBackground
    ? "0 2px 12px rgba(234, 179, 8, 0.12)"
    : "0 2px 16px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(250, 204, 21, 0.12)";
  const buttonShadowHover = isLightBackground
    ? "0 4px 20px rgba(234, 179, 8, 0.18)"
    : "0 4px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(250, 204, 21, 0.2)";

  const sponsorTextColor = isLightBackground
    ? "rgba(107, 114, 128, 0.8)"
    : textSecondaryColor;

  return (
    <footer 
      className="w-full flex justify-center px-3 sm:px-4 py-4 sm:py-5 md:py-6"
      style={{
        paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))",
      }}
    >
      <div className="w-full text-center max-w-md mx-auto">
        <p 
          className="text-[11px] sm:text-xs md:text-sm font-medium tracking-wide leading-tight"
          style={{ color: sponsorTextColor }}
        >
          {sponsorText}
        </p>
        <button
          type="button"
          onClick={handleAriWhatsApp}
          className="inline-block mt-2 sm:mt-2.5 rounded-2xl px-5 py-2.5 text-sm font-medium font-kurdish tracking-[0.15em] transition-all duration-200 cursor-pointer border backdrop-blur-sm hover:scale-[1.03] active:scale-[0.98]"
          style={{
            color: buttonTextColor,
            background: buttonBg,
            borderColor: buttonBorder,
            boxShadow: buttonShadow,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = buttonBgHover;
            e.currentTarget.style.borderColor = buttonBorderHover;
            e.currentTarget.style.boxShadow = buttonShadowHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = buttonBg;
            e.currentTarget.style.borderColor = buttonBorder;
            e.currentTarget.style.boxShadow = buttonShadow;
          }}
        >
          {nameText}
        </button>
      </div>
    </footer>
  );
});
