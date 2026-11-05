"use client";

import { defaultDeriveNeonUrls } from "@neon/neon-js";
import { createAuthClient } from "@neon/neon-js/auth";
import { createClient } from "@neon/neon-js/supabase";
import { getAuthConfiguration } from "./config";
import type { Database } from "./database-types";

type MemberClient = ReturnType<typeof createClient<Database>>;
let client: MemberClient | null = null;
function createEmailClient(databaseUrl: string) {
  return createAuthClient(defaultDeriveNeonUrls(databaseUrl).auth);
}
let emailClient: ReturnType<typeof createEmailClient> | null = null;
export function getMemberClient(): MemberClient | null {
  if (typeof window === "undefined") return null;
  const config = getAuthConfiguration();
  if (config.status !== "ready") return null;
  client ??= createClient<Database>(config.value.url);
  return client;
}

export function requireMemberClient(): MemberClient {
  const client = getMemberClient();
  if (!client) throw new Error("會員服務尚未啟用。");
  return client;
}

export function getEmailAuthClient() {
  const config = getAuthConfiguration();
  if (config.status !== "ready") throw new Error("會員服務尚未啟用。");
  // Use the native Managed SDK for OTP flows missing from the compatibility adapter.
  emailClient ??= createEmailClient(config.value.url);
  return emailClient;
}

export async function getVerifiedUser() {
  // The compatibility adapter's getUser() can use a cached session. Force a server check.
  const { data, error } = await requireMemberClient().auth.getSession({
    forceFetch: true,
  });
  if (error) throw error;
  return data.session?.user ?? null;
}
