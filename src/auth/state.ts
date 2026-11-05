"use client";

import { create } from "zustand";
import { useWorkspace } from "../storage/workspace";
import { getMemberClient, getVerifiedUser } from "./client";
import { getAuthConfiguration } from "./config";
import { authErrorMessage, MemberOperationError } from "./errors";
import { accountScope, type Member, memberFromUser } from "./identity";

type AuthState = {
  status:
    | "checking"
    | "disabled"
    | "signed-out"
    | "authenticated"
    | "unavailable";
  member: Member | null;
  error: string | null;
  refresh: () => Promise<void>;
};
let generation = 0;

export const useAuth = create<AuthState>((set) => ({
  status: "checking",
  member: null,
  error: null,
  refresh: async () => {
    const request = ++generation;
    const config = getAuthConfiguration();
    const client = getMemberClient();
    if (!client || config.status !== "ready") {
      set({
        status: "disabled",
        member: null,
        error: config.status === "invalid" ? config.reason : null,
      });
      await useWorkspace.getState().switchScope("guest");
      return;
    }
    try {
      const user = await getVerifiedUser();
      if (request !== generation) return;
      if (!user) {
        set({
          status: "signed-out",
          member: null,
          error: null,
        });
        await useWorkspace.getState().switchScope("guest");
        return;
      }
      if (!user.email_confirmed_at)
        throw new MemberOperationError("請先完成 Email 驗證，再使用會員資料。");
      const member = memberFromUser(user);
      await useWorkspace
        .getState()
        .switchScope(accountScope(config.value.projectNamespace, member.id));
      if (request === generation)
        set({
          status: "authenticated",
          member,
          error: null,
        });
    } catch (error) {
      if (request !== generation) return;
      set({
        status: "unavailable",
        member: null,
        error: authErrorMessage(error),
      });
      await useWorkspace.getState().switchScope("guest");
    }
  },
}));

export function startAuth(): () => void {
  const client = getMemberClient();
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
      generation++;
      useAuth.setState({
        status: "signed-out",
        member: null,
        error: null,
      });
      void useWorkspace.getState().switchScope("guest");
      return;
    }
    // Invalidate an in-flight identity check before the deferred refresh.
    generation++;
    if (session?.user.id !== useAuth.getState().member?.id) {
      useWorkspace.getState().lock();
      useAuth.setState({
        status: "checking",
        member: null,
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
