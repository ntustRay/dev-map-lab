"use client";
import { create } from "zustand";
import { useWorkspace } from "../storage/workspace";
import { getAuthConfiguration } from "./config";
import { accountScope, type Member, memberSchema } from "./identity";
import { getSharedAuth } from "./shared";

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
export const useAuth = create<AuthState>(() => ({
  status: "checking",
  member: null,
  error: null,
  async refresh() {
    const controller = getSharedAuth();
    if (controller) await controller.refresh();
    await synchronize();
  },
}));
async function synchronize() {
  const request = ++generation;
  const config = getAuthConfiguration();
  const controller = getSharedAuth();
  if (!controller || config.status !== "ready") {
    useAuth.setState({
      status: "disabled",
      member: null,
      error: config.status === "invalid" ? config.reason : null,
    });
    await useWorkspace.getState().switchScope("guest");
    return;
  }
  const state = controller.getSnapshot();
  const id = state.session?.user.id ?? null;
  if (state.status === "checking" || id !== (useAuth.getState().member?.id ?? null)) {
    useWorkspace.getState().lock();
    useAuth.setState({ status: "checking", member: null, error: null });
  }
  if (state.status === "checking") return;
  if (!state.session) {
    useAuth.setState({
      status: state.status === "unavailable" ? "unavailable" : "signed-out",
      member: null,
      error:
        state.status === "unavailable"
          ? "會員狀態暫時無法確認，請重試。"
          : null,
    });
    await useWorkspace.getState().switchScope("guest");
    return;
  }
  try {
    const user = state.session.user;
    const member = memberSchema.parse({
      id: user.id,
      email: user.email,
      displayName: (user.name ?? "").slice(0, 80),
    });
    await useWorkspace
      .getState()
      .switchScope(accountScope(config.value.projectNamespace, member.id));
    if (request === generation)
      useAuth.setState({ status: "authenticated", member, error: null });
  } catch {
    if (request !== generation) return;
    useAuth.setState({
      status: "unavailable",
      member: null,
      error: "無法載入會員資料空間，請重試。",
    });
    await useWorkspace.getState().switchScope("guest");
  }
}
export function startAuth(): () => void {
  const controller = getSharedAuth();
  if (!controller) {
    void synchronize();
    return () => {
      generation++;
    };
  }
  const unsubscribe = controller.subscribe(() => {
    void synchronize();
  });
  const stop = controller.start();
  const refresh = () => {
    void controller.refresh({ background: true });
  };
  const visible = () => {
    if (document.visibilityState === "visible") refresh();
  };
  if (typeof window !== "undefined") window.addEventListener("focus", refresh);
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", visible);
  void synchronize();
  return () => {
    generation++;
    unsubscribe();
    stop();
    if (typeof window !== "undefined")
      window.removeEventListener("focus", refresh);
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", visible);
  };
}
