import { z } from "zod";

export type AuthConfiguration = {
  url: string;
  projectNamespace: string;
  providers: ("github" | "google")[];
};
export type AuthConfigurationResult =
  | { status: "ready"; value: AuthConfiguration }
  | { status: "disabled"; reason: string }
  | { status: "invalid"; reason: string };

export function parseAuthConfiguration(input: {
  url: string | undefined;
  github: string | undefined;
  google: string | undefined;
}): AuthConfigurationResult {
  const url = input.url?.trim() ?? "";
  if (!url)
    return {
      status: "disabled",
      reason: "會員服務尚未啟用，仍可使用本機學習與筆記。",
    };
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    return { status: "invalid", reason: "會員服務網址設定錯誤。" };
  }
  if (
    address.protocol !== "https:" ||
    address.username ||
    address.password ||
    address.search ||
    address.hash ||
    !/^\/[a-zA-Z0-9_-]+\/?$/.test(address.pathname) ||
    (!address.hostname.endsWith(".neon.tech") &&
      !address.hostname.endsWith(".neon.build"))
  ) {
    return {
      status: "invalid",
      reason: "請設定不含帳密的 Neon HTTPS database URL，並包含資料庫名稱。",
    };
  }
  const providers: AuthConfiguration["providers"] = [];
  if (input.github === "true") providers.push("github");
  if (input.google === "true") providers.push("google");
  return {
    status: "ready",
    value: {
      url: `${address.origin}${address.pathname.replace(/\/$/, "")}`,
      projectNamespace:
        `${address.host}.${address.pathname.replace(/\/$/, "").slice(1)}`.replace(
          /[^a-zA-Z0-9.-]/g,
          "-",
        ),
      providers,
    },
  };
}

export function getAuthConfiguration(): AuthConfigurationResult {
  return parseAuthConfiguration({
    url: process.env.NEXT_PUBLIC_NEON_DATABASE_URL,
    github: process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED,
    google: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED,
  });
}

export const emailSchema = z
  .string()
  .trim()
  .email("請輸入有效的 Email。")
  .max(254)
  .transform((value) => value.toLowerCase());
export const passwordSchema = z
  .string()
  .min(12, "密碼至少需要 12 個字元。")
  .max(72, "密碼最多 72 個字元。")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "密碼 UTF-8 長度最多 72 bytes，請減少字數。",
  );
export const displayNameSchema = z
  .string()
  .trim()
  .max(80, "顯示名稱最多 80 個字元。");

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "請輸入信件中的 6 位數驗證碼。");

export function safeReturnPath(value: string | null, origin: string): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return "/account/";
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || url.pathname.startsWith("/auth/"))
      return "/account/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/account/";
  }
}

export function callbackUrl(origin: string, next = "/account/"): string {
  const url = new URL("/auth/callback/", origin);
  url.searchParams.set("next", safeReturnPath(next, origin));
  return url.toString();
}
