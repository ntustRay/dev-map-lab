"use client";

import { create } from "zustand";
import { useWorkspace } from "../storage/workspace";
import { getSupabaseClient } from "./client";
import { getAuthConfiguration } from "./config";
import { authErrorMessage } from "./errors";
import { accountScope, type Member, memberFromUser } from "./identity";
import { forgetRecovery, hasRecovery, rememberRecovery } from "./recovery";

type AuthState = {
  status:
    | "checking"
    | "disabled"
    | "signed-out"
    | "authenticated"
    | "unavailable";
  member: Member | null;
  error: string | null;
  recovery: boolean;
  refresh: () => Promise<void>;
};
let generation = 0;

export const useAuth = create<AuthState>((set) => ({
  status: "checking",
  member: null,
  error: null,
  recovery: false,
  refresh: async () => {
    const request = ++generation;
    const config = getAuthConfiguration();
    const client = getSupabaseClient();
    if (!client || config.status !== "ready") {
      set({
        status: "disabled",
        member: null,
        error: config.status === "invalid" ? config.reason : null,
        recovery: false,
      });
      await useWorkspace.getState().switchScope("guest");
      return;
    }
    try {
      const { data, error } = await client.auth.getUser();
      if (request !== generation) return;
      if (error && error.name !== "AuthSessionMissingError") throw error;
      if (!data.user) {
        forgetRecovery();
        set({
          status: "signed-out",
          member: null,
          error: null,
          recovery: false,
        });
        await useWorkspace.getState().switchScope("guest");
        return;
      }
      const member = memberFromUser(data.user);
      await useWorkspace
        .getState()
        .switchScope(accountScope(config.value.projectNamespace, member.id));
      if (request === generation)
        set({
          status: "authenticated",
          member,
          error: null,
          recovery: hasRecovery(member.id),
        });
    } catch (error) {
      if (request !== generation) return;
      set({
        status: "unavailable",
        member: null,
        error: authErrorMessage(error),
        recovery: false,
      });
      await useWorkspace.getState().switchScope("guest");
    }
  },
}));

export function startAuth(): () => void {
  const client = getSupabaseClient();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  if (!client) {
    void useAuth.getState().refresh();
    return () => {
      generation++;
    };
  }
  const { data } = client.auth.onAuthStateChange((event, session) => {
    // Keep callbacks synchronous; profile/workspace calls run after the Auth callback has returned.
    if (event === "SIGNED_OUT") {
      forgetRecovery();
      generation++;
      useAuth.setState({
        status: "signed-out",
        member: null,
        error: null,
        recovery: false,
      });
      void useWorkspace.getState().switchScope("guest");
      return;
    }
    // Invalidate an in-flight getUser immediately, before the deferred refresh.
    generation++;
    if (event === "PASSWORD_RECOVERY" && session?.user) {
      rememberRecovery(session.user.id);
      useAuth.setState({ recovery: true });
    }
    if (session?.user.id !== useAuth.getState().member?.id) {
      useWorkspace.getState().lock();
      useAuth.setState({
        status: "checking",
        member: null,
        recovery: session?.user ? hasRecovery(session.user.id) : false,
      });
    }
    const timer = setTimeout(() => {
      timers.delete(timer);
      void useAuth.getState().refresh();
    }, 0);
    timers.add(timer);
  });
  void useAuth.getState().refresh();
  return () => {
    generation++;
    data.subscription.unsubscribe();
    for (const timer of timers) clearTimeout(timer);
  };
}
