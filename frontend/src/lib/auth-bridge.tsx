/** Auth0-backed auth shim.
 *
 * Call sites keep importing from ``@/lib/auth-bridge`` so the app-wide auth
 * surface stays stable even though Auth0 is now the only supported runtime
 * provider.
 */

"use client";

import NextAuth, {
  SessionProvider as NASessionProvider,
  getSession as naGetSession,
  signIn as naSignIn,
  signOut as naSignOut,
  useSession as naUseSession,
} from "next-auth/react";
import * as React from "react";
import type { Session } from "next-auth";

export type AuthSessionUser = NonNullable<Session["user"]>;
export type AuthSession = Session;
export type AuthStatus = "authenticated" | "unauthenticated" | "loading";
export type UseSessionReturn = ReturnType<typeof naUseSession>;

export function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <NASessionProvider>{children}</NASessionProvider>;
}

export const useSession = naUseSession;
export const getSession = naGetSession;

export interface SignInOptions {
  callbackUrl?: string;
  redirect?: boolean;
  [key: string]: unknown;
}

export async function signIn(
  providerId?: string | null,
  options?: SignInOptions,
): Promise<unknown> {
  return naSignIn(providerId ?? undefined, options);
}

export async function signOut(options?: {
  callbackUrl?: string;
  redirect?: boolean;
}): Promise<unknown> {
  return naSignOut(options);
}

export { NextAuth as _NextAuthLegacy };
