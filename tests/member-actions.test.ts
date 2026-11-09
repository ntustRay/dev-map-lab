import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => {
  const state: { member: { id: string } | null } = { member: null };
  return {
    state,
    getVerifiedUser: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    fetch: vi.fn(),
    refresh: vi.fn(),
  };
});
vi.mock("../src/auth/client", () => ({
  getVerifiedUser: sdk.getVerifiedUser,
  getEmailAuthClient: () => ({
    getSession: async () => ({ data: null, error: null }),
    signIn: {
      email: async () => ({ error: null }),
      social: async () => ({ error: null }),
    },
    signOut: sdk.signOut,
    signUp: { email: sdk.signUp },
    $fetch: sdk.fetch,
  }),
  requireMemberClient: () => ({
    auth: {
      signOut: sdk.signOut,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
  }),
}));
vi.mock("../src/auth/state", () => ({
  useAuth: { getState: () => ({ ...sdk.state, refresh: sdk.refresh }) },
}));

let actions: typeof import("../src/auth/actions");
async function signUpEmail(...args: Parameters<typeof actions.signUpEmail>) {
  return actions.signUpEmail(...args);
}
async function verifyEmailCode(
  ...args: Parameters<typeof actions.verifyEmailCode>
) {
  return actions.verifyEmailCode(...args);
}
async function requestPasswordReset(
  ...args: Parameters<typeof actions.requestPasswordReset>
) {
  return actions.requestPasswordReset(...args);
}
async function resendVerification(
  ...args: Parameters<typeof actions.resendVerification>
) {
  return actions.resendVerification(...args);
}
async function resetPasswordWithCode(
  ...args: Parameters<typeof actions.resetPasswordWithCode>
) {
  return actions.resetPasswordWithCode(...args);
}
async function finishAuthCallback(
  ...args: Parameters<typeof actions.finishAuthCallback>
) {
  return actions.finishAuthCallback(...args);
}

const id = "11111111-1111-4111-8111-111111111111";
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("window", {
    location: { origin: "https://learn.example.test" },
  });
  vi.stubEnv(
    "NEXT_PUBLIC_NEON_DATABASE_URL",
    "https://ep-actions.neon.tech/neondb",
  );
  actions = await import("../src/auth/actions");
  vi.clearAllMocks();
  sdk.state.member = { id };
  sdk.getVerifiedUser.mockResolvedValue({ id });
  sdk.signUp.mockResolvedValue({
    data: { user: { id, emailVerified: false } },
    error: null,
  });
  sdk.fetch.mockResolvedValue({ data: {}, error: null });
  sdk.signOut.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Neon Managed SDK 的 Email OTP 與 callback 邊界", () => {
  it("未驗證註冊不當作已登入；使用 native signup 避免相容 adapter 要求 session", async () => {
    expect(
      await signUpEmail(" Person@Example.com ", "long passphrase!", " Ray "),
    ).toBe(false);
    expect(sdk.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "person@example.com",
        password: "long passphrase!",
        name: "Ray",
      }),
    );
    expect(sdk.refresh).not.toHaveBeenCalled();
  });
  it("驗證成功才重新讀取會員；沒有 session 則回登入頁", async () => {
    sdk.state.member = null;
    expect(await verifyEmailCode("Person@Example.com", "123456")).toBe(false);
    expect(sdk.fetch).toHaveBeenCalledWith("/email-otp/verify-email", {
      method: "POST",
      body: { email: "person@example.com", otp: "123456" },
    });
    expect(sdk.refresh).toHaveBeenCalledOnce();
  });
  it("控制台尚未要求驗證時，註冊主動寄 OTP，仍不開放會員空間", async () => {
    sdk.signUp.mockResolvedValueOnce({
      data: { token: "test-session", user: { id, emailVerified: false } },
      error: null,
    });
    expect(
      await signUpEmail("person@example.com", "long passphrase!", "Ray"),
    ).toBe(false);
    expect(sdk.fetch).toHaveBeenCalledWith("/email-otp/send-verification-otp", {
      method: "POST",
      body: { email: "person@example.com", type: "email-verification" },
    });
    expect(sdk.refresh).not.toHaveBeenCalled();
  });
  it("寄送驗證與重設都走 SDK 的 OTP 端點，不依賴重設連結", async () => {
    vi.useFakeTimers();
    await requestPasswordReset("Person@Example.com");
    await vi.advanceTimersByTimeAsync(61_000);
    await resendVerification("Person@Example.com");
    expect(sdk.fetch).toHaveBeenNthCalledWith(
      1,
      "/email-otp/request-password-reset",
      { method: "POST", body: { email: "person@example.com" } },
    );
    expect(sdk.fetch).toHaveBeenNthCalledWith(
      2,
      "/email-otp/send-verification-otp",
      {
        method: "POST",
        body: { email: "person@example.com", type: "email-verification" },
      },
    );
  });
  it("無效驗證碼在送出前拒絕；重設成功才登出此裝置", async () => {
    await expect(
      resetPasswordWithCode(
        "person@example.com",
        "12345",
        "long new passphrase!",
      ),
    ).rejects.toThrow();
    expect(sdk.fetch).not.toHaveBeenCalled();
    sdk.fetch.mockResolvedValueOnce({ error: { code: "otp_expired" } });
    await expect(
      resetPasswordWithCode(
        "person@example.com",
        "123456",
        "long new passphrase!",
      ),
    ).rejects.toThrow("expired");
    expect(sdk.signOut).not.toHaveBeenCalled();
    await resetPasswordWithCode(
      "person@example.com",
      "123456",
      "long new passphrase!",
    );
    expect(sdk.fetch).toHaveBeenLastCalledWith("/email-otp/reset-password", {
      method: "POST",
      body: {
        email: "person@example.com",
        otp: "123456",
        password: "long new passphrase!",
      },
    });
    expect(sdk.signOut).toHaveBeenCalledOnce();
    expect(sdk.refresh).toHaveBeenCalledOnce();
  });
  it("callback 由 SDK 處理 session verifier，再限制站內跳轉", async () => {
    expect(
      await finishAuthCallback(
        "https://learn.example.test/auth/callback/?neon_auth_session_verifier=one-time&next=https://evil.example",
      ),
    ).toBe("/account/");
    expect(sdk.getVerifiedUser).toHaveBeenCalledOnce();
    expect(sdk.refresh).toHaveBeenCalledOnce();
    sdk.getVerifiedUser.mockResolvedValueOnce(null);
    await expect(
      finishAuthCallback("https://learn.example.test/auth/callback/"),
    ).rejects.toThrow("登入狀態");
    sdk.getVerifiedUser.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(
      finishAuthCallback("https://learn.example.test/auth/callback/"),
    ).rejects.toThrow("network unavailable");
    await expect(
      finishAuthCallback(
        "https://learn.example.test/auth/callback/?error=denied",
      ),
    ).rejects.toThrow("驗證未完成");
  });
});
