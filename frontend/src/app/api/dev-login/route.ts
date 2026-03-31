/**
 * TEMPORARY DEV-ONLY LOGIN ROUTE
 * Creates a NextAuth session for demo-admin without going through Keycloak browser flow.
 * Gets a real Keycloak access token via admin-cli direct grant.
 * DELETE THIS FILE after auth testing is complete.
 */
import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "dev only" }, { status: 403 });
  }

  const secret = process.env.NEXTAUTH_SECRET!;
  const kcInternal =
    process.env.KEYCLOAK_ISSUER || "http://keycloak:8080/realms/datapulse";

  // --- Get a real Keycloak access token via admin-cli direct grant ---
  let accessToken = "dev-access-token";
  let refreshToken = "dev-refresh-token";
  let expiresAt = Math.floor(Date.now() / 1000) + 3600;

  try {
    const tokenUrl = `${kcInternal}/protocol/openid-connect/token`;
    const kcRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.KEYCLOAK_CLIENT_ID || "datapulse-frontend",
        grant_type: "password",
        username: process.env.DEV_LOGIN_USERNAME || "demo-admin",
        password: process.env.DEV_LOGIN_PASSWORD || "",
      }).toString(),
    });

    if (kcRes.ok) {
      const kcTokens = await kcRes.json();
      accessToken = kcTokens.access_token ?? accessToken;
      refreshToken = kcTokens.refresh_token ?? refreshToken;
      expiresAt = Math.floor(Date.now() / 1000) + (kcTokens.expires_in ?? 3600);
    } else {
      console.warn("[dev-login] Keycloak token fetch failed, using fake token");
    }
  } catch (err) {
    console.warn("[dev-login] Keycloak token fetch error:", err);
  }

  // Build a NextAuth JWT payload for demo-admin
  const token = await encode({
    token: {
      name: "Demo Admin",
      email: "admin@datapulse.dev",
      picture: undefined,
      sub: "demo-admin-sub",
      accessToken,
      refreshToken,
      expiresAt,
      tenant_id: 1,
      roles: ["admin", "default-roles-datapulse"],
    },
    secret,
    maxAge: 24 * 60 * 60,
  });

  const response = NextResponse.redirect(
    new URL("/dashboard", "http://localhost:3000"),
  );

  // Set the NextAuth session cookie
  response.cookies.set("next-auth.session-token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  });

  return response;
}
