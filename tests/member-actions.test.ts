import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetRecovery,
  hasRecovery,
  rememberRecovery,
} from "../src/auth/recovery";

type Listener = (
  event: string,
  session: { user: { id: string } } | null,
) => void;
const sdk = vi.hoisted(() => {
  const listener: { current: Listener | null } = { current: null };
  const state: { member: { id: string } | null; recovery: boolean } = {
    member: null,
    recovery: false,
  };
  return {
    listener,
    state,
    getUser: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(),
    reset: vi.fn(),
    resend: vi.fn(),
    exchange: vi.fn(),
    refresh: vi.fn(),
    unsubscribe: vi.fn(),
  };
});
vi.mock("../src/auth/client", () => ({
  requireSupabaseClient: () => ({
    auth: {
      getUser: sdk.getUser,
      signUp: sdk.signUp,
      signOut: sdk.signOut,
      updateUser: sdk.updateUser,
      resetPasswordForEmail: sdk.reset,
      resend: sdk.resend,
      exchangeCodeForSession: sdk.exchange,
      onAuthStateChange: (listener: Listener) => {
        sdk.listener.current = listener;
        return { data: { subscription: { unsubscribe: sdk.unsubscribe } } };
      },
    },
  }),
}));
vi.mock("../src/auth/state", () => ({
  useAuth: {
    getState: () => ({ ...sdk.state, refresh: sdk.refresh }),
    setState: (next: { recovery: boolean }) => {
      sdk.state.recovery = next.recovery;
    },
  },
}));

import {
  finishAuthCallback,
  requestPasswordReset,
  resendVerification,
  signUpEmail,
  updateRecoveredPassword,
} from "../src/auth/actions";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", {
    location: { origin: "https://learn.example.test" },
  });
  sdk.state.member = { id: a };
  sdk.state.recovery = false;
  sdk.getUser.mockResolvedValue({ data: { user: { id: a } }, error: null });
  sdk.signUp.mockResolvedValue({ data: { session: null }, error: null });
  for (const operation of [
    sdk.reset,
    sdk.resend,
    sdk.exchange,
    sdk.signOut,
    sdk.updateUser,
  ])
    operation.mockResolvedValue({ data: {}, error: null });
});
afterEach(() => {
  forgetRecovery();
  vi.unstubAllGlobals();
});
describe("會員 Email 與一次性 PKCE 操作", () => {
  it("註冊等待驗證信，不把沒有 session 的回應當作已登入", async () => {
    expect(
      await signUpEmail(" Person@Example.com ", "long passphrase!", " Ray "),
    ).toBe(false);
    expect(sdk.signUp).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "long passphrase!",
      options: {
        emailRedirectTo:
          "https://learn.example.test/auth/callback/?next=%2Faccount%2F",
        data: { display_name: "Ray" },
      },
    });
    expect(sdk.refresh).not.toHaveBeenCalled();
  });
  it("重設與重寄導回自己的 callback，不由 query string 啟用重設權限", async () => {
    await requestPasswordReset("person@example.com");
    await resendVerification("person@example.com");
    const [, options] = sdk.reset.mock.calls[0] ?? [];
    expect(options).toEqual({
      redirectTo:
        "https://learn.example.test/auth/callback/?next=%2Faccount%2F%3Fmode%3Drecovery",
    });
    expect(sdk.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "person@example.com",
      options: {
        emailRedirectTo:
          "https://learn.example.test/auth/callback/?next=%2Faccount%2F",
      },
    });
    expect(
      await finishAuthCallback(
        "https://learn.example.test/auth/callback/?code=one-time&next=/account/?mode=recovery",
      ),
    ).toBe("/account/?mode=recovery");
    expect(sdk.state.recovery).toBe(false);
  });
  it("PKCE flow ID 傳給 SDK、拒絕外站返回，失敗也會解除暫時 listener", async () => {
    expect(
      await finishAuthCallback(
        "https://learn.example.test/auth/callback/?code=one-time&sb_flow_id=flow-1&next=https://evil.example",
      ),
    ).toBe("/account/");
    expect(sdk.exchange).toHaveBeenCalledWith("one-time", { flowId: "flow-1" });
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
    sdk.exchange.mockResolvedValue({ error: new Error("expired") });
    await expect(
      finishAuthCallback(
        "https://learn.example.test/auth/callback/?code=expired",
      ),
    ).rejects.toThrow("expired");
    expect(sdk.unsubscribe).toHaveBeenCalledTimes(2);
  });
  it("只允許對應帳號的重設流程，更新後移除標記並登出此裝置", async () => {
    rememberRecovery(a);
    sdk.state.recovery = true;
    sdk.getUser.mockResolvedValueOnce({
      data: { user: { id: b } },
      error: null,
    });
    await expect(
      updateRecoveredPassword("long new passphrase!"),
    ).rejects.toThrow("有效連結");
    expect(sdk.updateUser).not.toHaveBeenCalled();
    await updateRecoveredPassword("long new passphrase!");
    expect(sdk.updateUser).toHaveBeenCalledWith({
      password: "long new passphrase!",
    });
    expect(sdk.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(sdk.state.recovery).toBe(false);
    expect(hasRecovery(a)).toBe(false);
  });
});
