#!/usr/bin/env node
/**
 * One-time helper to get a Google refresh token for the review sync.
 *
 * Before running, in Google Cloud Console:
 *   1. Create (or pick) a project, and request access to the Business Profile APIs.
 *      Access is granted by Google, not automatic — see the README.
 *   2. Enable: My Business Account Management API, My Business Business Information API,
 *      and Google My Business API (the v4 one, which still serves reviews).
 *   3. Create an OAuth client of type "Desktop app". Note the client ID and secret.
 *
 * Then:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-oauth-setup.mjs
 *
 * Sign in as the account that **owns or manages** the Front Street Cafe profile — Gavin,
 * not you, unless he has made you a manager. Paste the printed refresh token into
 * .env.local for local runs and into the repository secrets for the Action.
 */
import { createServer } from "node:http";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 8711;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/business.manage";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first. See the comment at the top of this file.");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    // Both are required to be handed a refresh token at all.
    access_type: "offline",
    prompt: "consent",
  });

console.log("\nOpen this in a browser, signed in as the profile owner or a manager:\n");
console.log(authUrl);
console.log("\nWaiting for the redirect…\n");

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    response.writeHead(404).end();
    return;
  }

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (error || !code) {
    response.writeHead(400, { "Content-Type": "text/plain" }).end(`Authorisation failed: ${error ?? "no code"}`);
    console.error(`Authorisation failed: ${error ?? "no code returned"}`);
    server.close();
    process.exitCode = 1;
    return;
  }

  const token = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const body = await token.json().catch(() => ({}));

  if (!token.ok || !body.refresh_token) {
    const detail = body.error_description ?? body.error ?? "no refresh_token in the response";
    response.writeHead(500, { "Content-Type": "text/plain" }).end(`Token exchange failed: ${detail}`);
    console.error(`\nToken exchange failed: ${detail}`);
    if (token.ok) {
      console.error("Google only returns a refresh token on first consent — the prompt=consent above should force it.");
    }
    server.close();
    process.exitCode = 1;
    return;
  }

  response
    .writeHead(200, { "Content-Type": "text/plain" })
    .end("Done — the refresh token is in your terminal. You can close this tab.");

  console.log("GOOGLE_REFRESH_TOKEN=%s\n", body.refresh_token);
  console.log("Store it in .env.local and as a repository secret. It is long-lived; treat it like a password.");
  server.close();
});

server.listen(PORT);
