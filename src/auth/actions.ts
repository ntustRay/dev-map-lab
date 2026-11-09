"use client";
import type { AuthOutcome, AuthResult } from "@ntustray/web-authentication-component";
import { AuthFailure } from "@ntustray/web-authentication-component";
import { getSharedAuth } from "./shared";
import { getVerifiedUser } from "./client";
import { displayNameSchema, otpSchema, safeReturnPath } from "./config";
import { MemberOperationError } from "./errors";
import { useAuth } from "./state";
import { useWorkspace } from "../storage/workspace";

function shared() {
  const controller = getSharedAuth();
  if (!controller) throw new MemberOperationError("會員服務尚未啟用。");
  return controller;
}
async function complete(result: AuthResult<AuthOutcome>) {
  if (!result.ok) throw new AuthFailure(result.error.code);
  if (result.value.kind === "authenticated" || result.value.kind === "complete") await useAuth.getState().refresh();
  return result.value;
}
export async function signInEmail(email: string, password: string): Promise<void> {
  await complete(await shared().signIn({ email, password }));
}
export async function signUpEmail(email: string, password: string, name: string): Promise<boolean> {
  return (await complete(await shared().signUp({ email, password, name: displayNameSchema.parse(name) }, password))).kind === "authenticated";
}
export async function resendVerification(email: string): Promise<void> {
  await complete(await shared().resendVerification(email));
}
export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  return (await complete(await shared().verifyEmail({ email, code: otpSchema.parse(code) }))).kind === "authenticated";
}
export async function requestPasswordReset(email: string): Promise<void> {
  await complete(await shared().requestPasswordReset(email));
}
export async function resetPasswordWithCode(email: string, code: string, password: string): Promise<void> {
  await complete(await shared().resetPassword({ email, code: otpSchema.parse(code), password }, password));
}
export async function signOutMember(): Promise<void> {
  useWorkspace.getState().lock();
  useAuth.setState({ member: null, status: "checking", error: null });
  const result = await shared().signOut();
  if (!result.ok) {
    useAuth.setState({ member: null, status: "unavailable", error: "登出未完成，請重試。" });
    throw new AuthFailure(result.error.code);
  }
  await useAuth.getState().refresh();
}
export async function signInSocial(provider: "github" | "google"): Promise<void> {
  await complete(await shared().signInWithProvider(provider));
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
