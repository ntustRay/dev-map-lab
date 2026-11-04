"use client";

import { requireSupabaseClient } from "./client";
import {
  callbackUrl,
  displayNameSchema,
  emailSchema,
  passwordSchema,
  safeReturnPath,
} from "./config";
import { MemberOperationError } from "./errors";
import { forgetRecovery, hasRecovery, rememberRecovery } from "./recovery";
import { useAuth } from "./state";

export async function signInEmail(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await requireSupabaseClient().auth.signInWithPassword({
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
  const { data, error } = await requireSupabaseClient().auth.signUp({
    email: emailSchema.parse(email),
    password: passwordSchema.parse(password),
    options: {
      emailRedirectTo: callbackUrl(window.location.origin),
      data: { display_name: displayNameSchema.parse(displayName) },
    },
  });
  if (error) throw error;
  if (data.session) await useAuth.getState().refresh();
  return data.session !== null;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await requireSupabaseClient().auth.resetPasswordForEmail(
    emailSchema.parse(email),
    {
      redirectTo: callbackUrl(
        window.location.origin,
        "/account/?mode=recovery",
      ),
    },
  );
  if (error) throw error;
}

export async function resendVerification(email: string): Promise<void> {
  const { error } = await requireSupabaseClient().auth.resend({
    type: "signup",
    email: emailSchema.parse(email),
    options: { emailRedirectTo: callbackUrl(window.location.origin) },
  });
  if (error) throw error;
}

export async function updateRecoveredPassword(password: string): Promise<void> {
  const client = requireSupabaseClient();
  const { data, error: identityError } = await client.auth.getUser();
  if (
    identityError ||
    !data.user ||
    !useAuth.getState().recovery ||
    useAuth.getState().member?.id !== data.user.id ||
    !hasRecovery(data.user.id)
  )
    throw new MemberOperationError("請先從密碼重設信開啟有效連結。");
  const { error } = await client.auth.updateUser({
    password: passwordSchema.parse(password),
  });
  if (error) throw error;
  forgetRecovery();
  useAuth.setState({ recovery: false });
  await signOutMember();
}

export async function signOutMember(): Promise<void> {
  const { error } = await requireSupabaseClient().auth.signOut({
    scope: "local",
  });
  if (error) throw error;
  await useAuth.getState().refresh();
}

export async function signInSocial(
  provider: "github" | "google",
): Promise<void> {
  const { error } = await requireSupabaseClient().auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl(window.location.origin) },
  });
  if (error) throw error;
}

export async function finishAuthCallback(address: string): Promise<string> {
  const url = new URL(address);
  if (url.searchParams.has("error"))
    throw new MemberOperationError("會員驗證未完成，請重新登入或寄送驗證信。");
  const code = url.searchParams.get("code");
  if (!code)
    throw new MemberOperationError("驗證連結缺少授權碼，請重新寄送連結。");
  const flowId = url.searchParams.get("sb_flow_id");
  const client = requireSupabaseClient();
  const { data: listener } = client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session?.user) {
      rememberRecovery(session.user.id);
      useAuth.setState({ recovery: true });
    }
  });
  try {
    const { error } = await client.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (error) throw error;
  } finally {
    listener.subscription.unsubscribe();
  }
  await useAuth.getState().refresh();
  return safeReturnPath(url.searchParams.get("next"), url.origin);
}
