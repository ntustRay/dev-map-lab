import { afterEach, describe, expect, it } from "vitest";
import {
  callbackUrl,
  parseAuthConfiguration,
  passwordSchema,
  safeReturnPath,
} from "../src/auth/config";
import { accountScope, memberFromUser } from "../src/auth/identity";
import {
  forgetRecovery,
  hasRecovery,
  rememberRecovery,
} from "../src/auth/recovery";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

describe("會員設定與 callback 邊界", () => {
  it("設定缺少時不宣稱已連線；拒絕私密金鑰", () => {
    const empty = {
      url: undefined,
      publishableKey: undefined,
      github: undefined,
      google: undefined,
    };
    expect(parseAuthConfiguration(empty).status).toBe("disabled");
    expect(
      parseAuthConfiguration({ ...empty, url: "https://project.supabase.co" })
        .status,
    ).toBe("invalid");
    expect(
      parseAuthConfiguration({
        ...empty,
        url: "https://project.supabase.co",
        publishableKey: "sb_secret_never_public",
      }).status,
    ).toBe("invalid");
  });
  it("只開放 HTTPS 與本機 HTTP，不接受網址中的憑證", () => {
    const config = {
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test_only",
      github: "true",
      google: "false",
    };
    expect(parseAuthConfiguration(config).status).toBe("ready");
    expect(
      parseAuthConfiguration({ ...config, url: "http://localhost:54321" })
        .status,
    ).toBe("ready");
    expect(
      parseAuthConfiguration({ ...config, url: "http://project.example.com" })
        .status,
    ).toBe("invalid");
    expect(
      parseAuthConfiguration({
        ...config,
        url: "https://password@project.example.com",
      }).status,
    ).toBe("invalid");
  });
  it("拒絕外站、protocol-relative、反斜線與 callback 循環跳轉", () => {
    const origin = "https://learn.example.com";
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/auth/callback/?code=x",
      "javascript:alert(1)",
    ])
      expect(safeReturnPath(value, origin)).toBe("/account/");
    expect(
      safeReturnPath("/learn/javascript-values/?tab=practice#test", origin),
    ).toBe("/learn/javascript-values/?tab=practice#test");
    expect(
      new URL(callbackUrl(origin, "//evil.example")).searchParams.get("next"),
    ).toBe("/account/");
  });
  it("密碼驗證計入 UTF-8 bytes，不改動使用者輸入", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(
      passwordSchema.safeParse("a long passphrase with spaces").success,
    ).toBe(true);
    expect(passwordSchema.safeParse("密".repeat(25)).success).toBe(false);
  });
  it("project 與帳號各自命名空間，metadata 不作角色授權", () => {
    expect(accountScope("a.supabase.co", owner)).not.toBe(
      accountScope("b.supabase.co", owner),
    );
    expect(accountScope("a.supabase.co", owner)).not.toBe(
      accountScope("a.supabase.co", other),
    );
    const member = memberFromUser({
      id: owner,
      email: "member@example.com",
      user_metadata: { display_name: "Ray", role: "admin" },
    });
    expect(member).not.toHaveProperty("role");
    expect(member.displayName).toBe("Ray");
  });
});

describe("密碼重設的 UI 流程標記", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  afterEach(() => {
    forgetRecovery(storage);
    values.clear();
  });
  it("同一帳號可重新整理，不可套用另一帳號，且會過期", () => {
    rememberRecovery(owner, storage, 1000);
    expect(hasRecovery(owner, storage, 2000)).toBe(true);
    expect(hasRecovery(other, storage, 2000)).toBe(false);
    expect(hasRecovery(owner, storage, 1000 + 15 * 60 * 1000)).toBe(false);
    forgetRecovery(storage);
    expect(hasRecovery(owner, storage, 2000)).toBe(false);
  });
  it("毀損的標記不會啟用重設表單", () => {
    storage.setItem("dev-map-lab-password-recovery", "invalid json");
    expect(hasRecovery(owner, storage)).toBe(false);
  });
  it("瀏覽器禁止 sessionStorage 時，當頁仍可使用短期標記", () => {
    const blocked = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    rememberRecovery(owner, blocked, 1000);
    expect(hasRecovery(owner, blocked, 2000)).toBe(true);
    expect(hasRecovery(other, blocked, 2000)).toBe(false);
    forgetRecovery(blocked);
    expect(hasRecovery(owner, blocked, 2000)).toBe(false);
  });
});
