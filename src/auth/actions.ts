"use client";

import {
  getEmailAuthClient,
  getVerifiedUser,
  requireMemberClient,
} from "./client";
import {
  callbackUrl,
  displayNameSchema,
  emailSchema,
  otpSchema,
  passwordSchema,
  safeReturnPath,
} from "./config";
import { MemberOperationError } from "./errors";
import { useAuth } from "./state";

export async function signInEmail(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await requireMemberClient().auth.signInWithPassword({
    email: emailSchema.parse(email),
    password,
  });
  if (error) throw error;
  await useAuth.getState().refresh();
}

export async function signUpEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<boolean> {
  const address = emailSchema.parse(email);
  // The compatibility adapter expects a session at signup, but verified signup has none yet.
  const { data, error } = await getEmailAuthClient().signUp.email({
    email: address,
    password: passwordSchema.parse(password),
    name:
      displayNameSchema.parse(displayName) || address.split("@")[0] || "會員",
  });
  if (error) throw error;
  if (!data?.user)
    throw new MemberOperationError("會員服務未回傳註冊結果，請稍後再試。");
  if (!data.user.emailVerified) {
    // With verification disabled in the console, signup creates a session but sends no OTP.
    // Still require proof of email ownership before this application grants member access.
    if (data.token) await resendVerification(address);
    return false;
  }
  await useAuth.getState().refresh();
  return useAuth.getState().member !== null;
}

export async function resendVerification(email: string): Promise<void> {
  const { error } = await getEmailAuthClient().$fetch(
    "/email-otp/send-verification-otp",
    {
      method: "POST",
      body: { email: emailSchema.parse(email), type: "email-verification" },
    },
  );
  if (error) throw error;
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<boolean> {
  const { error } = await getEmailAuthClient().$fetch(
    "/email-otp/verify-email",
    {
      method: "POST",
      body: { email: emailSchema.parse(email), otp: otpSchema.parse(code) },
    },
  );
  if (error) throw error;
  await useAuth.getState().refresh();
  return useAuth.getState().member !== null;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getEmailAuthClient().$fetch(
    "/email-otp/request-password-reset",
    { method: "POST", body: { email: emailSchema.parse(email) } },
  );
  if (error) throw error;
}

export async function resetPasswordWithCode(
  email: string,
  code: string,
  password: string,
): Promise<void> {
  const { error } = await getEmailAuthClient().$fetch(
    "/email-otp/reset-password",
    {
      method: "POST",
      body: {
        email: emailSchema.parse(email),
        otp: otpSchema.parse(code),
        password: passwordSchema.parse(password),
      },
    },
  );
  if (error) throw error;
  await signOutMember();
}

export async function signOutMember(): Promise<void> {
  const { error } = await requireMemberClient().auth.signOut({
    scope: "local",
  });
  if (error) throw error;
  await useAuth.getState().refresh();
}

export async function signInSocial(
  provider: "github" | "google",
): Promise<void> {
  const { error } = await requireMemberClient().auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl(window.location.origin) },
  });
  if (error) throw error;
}

export async function finishAuthCallback(address: string): Promise<string> {
  const url = new URL(address);
  if (url.searchParams.has("error") || url.hash.includes("error="))
    throw new MemberOperationError("會員驗證未完成，請重新登入。");
  // Neon handles its OAuth verifier and session cookie. Do not exchange it as a Supabase PKCE code.
  const user = await getVerifiedUser();
  if (!user)
    throw new MemberOperationError(
      "尚未取得有效登入狀態，請回到會員頁重新登入。",
    );
  await useAuth.getState().refresh();
  return safeReturnPath(url.searchParams.get("next"), url.origin);
}
