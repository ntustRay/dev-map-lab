"use client";
import {
  createAuthController,
  passwordOnly,
} from "@ntustray/web-authentication-component";
import { createNeonAdapter } from "@ntustray/web-authentication-component/adapters/neon";
import { getEmailAuthClient, requireMemberClient } from "./client";
import { callbackUrl, getAuthConfiguration } from "./config";

let controller: ReturnType<typeof createAuthController> | null = null;
export function getSharedAuth() {
  if (controller) return controller;
  const config = getAuthConfiguration();
  if (typeof window === "undefined" || config.status !== "ready") return null;
  const client = getEmailAuthClient();
  controller = createAuthController({
    methods: {
      ...passwordOnly,
      providers: config.value.providers.map((id) => ({
        id,
        label: id === "github" ? "GitHub" : "Google",
      })),
    },
    passwordPolicy: { minLength: 12, maxUtf8Bytes: 72 },
    adapter: createNeonAdapter(
      {
        getSession: (input) => client.getSession(input),
        signOut: () => client.signOut(),
        signIn: {
          email: (input) => client.signIn.email(input),
          social: (input) => client.signIn.social(input),
        },
        signUp: {
          async email(input) {
            const result = await client.signUp.email(input);
            if (
              !result.error &&
              result.data?.token &&
              !result.data.user.emailVerified
            ) {
              const sent = await client.$fetch(
                "/email-otp/send-verification-otp",
                {
                  method: "POST",
                  body: { email: input.email, type: "email-verification" },
                },
              );
              if (sent.error) return { error: sent.error };
            }
            return result;
          },
        },
      },
      client,
      {
        password: true,
        registration: true,
        recovery: true,
        verification: true,
        providers: config.value.providers,
        callbackUrl: callbackUrl(window.location.origin),
        errorCallbackUrl: callbackUrl(window.location.origin),
        recoveryUrl: callbackUrl(window.location.origin),
        watchSession(listener) {
          const { data } = requireMemberClient().auth.onAuthStateChange(() =>
            listener(),
          );
          return () => data.subscription.unsubscribe();
        },
      },
    ),
  });
  return controller;
}
