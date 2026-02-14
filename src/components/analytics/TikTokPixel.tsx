/**
 * TikTok Pixel Component (Server Component)
 * 
 * Securely loads TikTok Pixel tracking code using Next.js Script component.
 * Only loads in production or when TIKTOK_PIXEL_ID is explicitly set.
 * 
 * Environment Variable Required:
 * - NEXT_PUBLIC_TIKTOK_PIXEL_ID: Your TikTok Pixel ID
 */
import Script from "next/script";

export function TikTokPixel(): React.ReactElement | null {
  const pixelId = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;

  // Only load if pixel ID is configured
  if (!pixelId) {
    return null;
  }

  // Use Next.js Script component to avoid hydration mismatches
  // strategy="lazyOnload" loads after the page becomes interactive
  // Errors are handled silently within the inline script to handle ad blockers gracefully
  return (
    <Script
      id="tiktok-pixel"
      strategy="lazyOnload"
      dangerouslySetInnerHTML={{
        __html: `
          !function (w, d, t) {
            try {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;n.onerror=function(){};e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
              ttq.load('${pixelId}');
              ttq.page();
            } catch(e) {
              // Silently handle ad blocker or network errors (ERR_BLOCKED_BY_CLIENT)
            }
          }(window, document, 'ttq');
        `,
      }}
    />
  );
}
