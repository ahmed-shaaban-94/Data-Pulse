"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { Fraunces, JetBrains_Mono, Cairo } from "next/font/google";
import { useSession, signIn } from "@/lib/auth-bridge";
import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";
import { swrConfig } from "@/lib/swr-config";
import { AuthProvider } from "@/components/auth-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastProvider } from "@/components/ui/toast";
import { PosCartProvider } from "@/contexts/pos-cart-context";
import { useRendererCrashBridge } from "@/hooks/use-renderer-crash-bridge";

// Fraunces = italic display on the Totals Hero + invoice.
// JetBrains Mono = SKUs, barcodes, numeric readouts, kbd chips.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["italic", "normal"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Arabic body copy on the POS + receipt surfaces (cart item names,
// counseling text, customer names, thanks footer).
//
// NOTE: the v9 handoff README names IBM Plex Sans Arabic as the Arabic
// font, but the existing DataPulse colors_and_type.css in the same
// handoff bundle already defines Cairo as the primary Arabic font
// (`--dp-font-ar: "Cairo", "Tajawal", …`), so we follow the CSS over
// the README. Cairo also sidesteps a Next 15.5.15 name-resolution
// failure against `IBM_Plex_Sans_Arabic` in `next build` (d.ts exports
// it locally, CI rejects it — likely an SWC font-plugin allowlist drift).
//
// PR #615's squash merge into main dropped `IBM_Plex_Sans_Arabic` from
// the import line during conflict resolution, but left the usage below,
// leaving main in a broken "use without import" state. This PR fixes
// both sides: swap to Cairo, add it to the import, keep the CSS var
// name `--font-plex-arabic` so globals.css's `.pos-omni .font-arabic`
// utility atom resolves without edits.
const plexArabic = Cairo({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

/** Block children until session is resolved; redirect on refresh failure. */
function SessionGuard({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if ((session as { error?: string } | null)?.error === "RefreshAccessTokenError") {
      signIn("auth0");
    }
  }, [session]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

/** Keyboard shortcuts for the POS terminal.
 *
 * Audit C-follow-up: removed the F12 dispatch here — it fired
 * ``pos:void-transaction`` which no component listened to, AND it collided
 * with the terminal page's own F12 handler (voucher modal) because both
 * handlers attach to window.keydown. Net effect was a dead event plus a
 * preventDefault race. F12 is now owned by the terminal page alone
 * (voucher) until product decides whether to rebind it to void to match
 * the pharma-pos skill convention.
 */
function PosKeyboardHandler({ children }: { children: ReactNode }) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    // Dispatch custom events so any component can listen without prop-drilling
    switch (e.key) {
      case "F1":
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("pos:focus-search"));
        break;
      case "F2":
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("pos:open-checkout"));
        break;
      case "F5":
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("pos:hold-transaction"));
        break;
      case "F8":
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("pos:open-return"));
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return <>{children}</>;
}

/** POS-only mount of the renderer-error bridge. Self-contained so it
 *  can be removed without touching the layout tree. Runs only inside
 *  Electron (the hook no-ops when `window.electronAPI` is undefined). */
function RendererCrashBridge({ children }: { children: ReactNode }) {
  useRendererCrashBridge();
  return <>{children}</>;
}

export default function PosLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <SWRConfig value={swrConfig}>
          <ErrorBoundary>
            <ToastProvider>
              <SessionGuard>
                <PosCartProvider>
                  <RendererCrashBridge>
                    <PosKeyboardHandler>
                      <div
                        className={`pos-omni ${fraunces.variable} ${jetbrainsMono.variable} ${plexArabic.variable} flex min-h-screen flex-col overflow-hidden bg-[var(--pos-bg)] text-[var(--pos-ink)]`}
                      >
                        {children}
                      </div>
                    </PosKeyboardHandler>
                  </RendererCrashBridge>
                </PosCartProvider>
              </SessionGuard>
            </ToastProvider>
          </ErrorBoundary>
        </SWRConfig>
      </AuthProvider>
    </ThemeProvider>
  );
}
