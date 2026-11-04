"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAuthConfiguration } from "./config";
import type { Database } from "./database-types";

let client: SupabaseClient<Database> | null = null;
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") return null;
  const config = getAuthConfiguration();
  if (config.status !== "ready") return null;
  client ??= createClient<Database>(
    config.value.url,
    config.value.publishableKey,
    {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storageKey: `dev-map-lab-auth-${config.value.projectNamespace}`,
      },
    },
  );
  return client;
}

export function requireSupabaseClient(): SupabaseClient<Database> {
  const client = getSupabaseClient();
  if (!client) throw new Error("會員服務尚未啟用。");
  return client;
}
