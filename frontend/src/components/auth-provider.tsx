"use client";

import { SessionProvider } from "@/lib/auth-bridge";
import type { ReactNode } from "react";

/**
 * Thin wrapper around the shared NextAuth SessionProvider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
