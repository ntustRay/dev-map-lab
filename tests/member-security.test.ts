import { describe, expect, it } from "vitest";
import {
  callbackUrl,
  otpSchema,
  parseAuthConfiguration,
  passwordSchema,
  safeReturnPath,
} from "../src/auth/config";
import { accountScope, memberFromUser } from "../src/auth/identity";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const databaseUrl = "https://ep-example.c-8.us-east-2.aws.neon.tech/neondb";
const config = { url: databaseUrl, github: "true", google: "false" };

describe("會員設定與 callback 邊界", () => {
  it("缺少設定時保留訪客模式；只接受不含帳密的 Neon HTTPS database URL", () => {
    expect(parseAuthConfiguration({ ...config, url: undefined }).status).toBe(
      "disabled",
    );
    expect(parseAuthConfiguration(config)).toMatchObject({
      status: "ready",
      value: { url: databaseUrl, providers: ["github"] },
    });
    for (const url of [
      "postgresql://user:secret@ep-example.neon.tech/neondb",
      "https://user:secret@ep-example.neon.tech/neondb",
      `${databaseUrl}?password=secret`,
      `${databaseUrl}#secret`,
      "https://ep-example.neon.tech",
      "https://ep-example.neon.tech/neondb/rest/v1",
      "https://ep-example.neon.tech.evil.test/neondb",
      "http://localhost:54321/neondb",
    ])
      expect(parseAuthConfiguration({ ...config, url }).status).toBe("invalid");
  });
  it("URL 尾斜線不會變成本機新空間；不同 database 必須隔離", () => {
    expect(parseAuthConfiguration(config)).toEqual(
      parseAuthConfiguration({ ...config, url: `${databaseUrl}/` }),
    );
    expect(parseAuthConfiguration(config)).not.toEqual(
      parseAuthConfiguration({
        ...config,
        url: databaseUrl.replace("neondb", "otherdb"),
      }),
    );
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
  it("密碼驗證計入 UTF-8 bytes；驗證碼只能是 6 個數字", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(
      passwordSchema.safeParse("a long passphrase with spaces").success,
    ).toBe(true);
    expect(passwordSchema.safeParse("密".repeat(25)).success).toBe(false);
    expect(otpSchema.parse("012345")).toBe("012345");
    for (const code of ["12345", "1234567", "12345a", "１２３４５６"])
      expect(otpSchema.safeParse(code).success).toBe(false);
  });
  it("project 與帳號各自命名空間，metadata 不作角色授權", () => {
    expect(accountScope("a.neon.tech.neondb", owner)).not.toBe(
      accountScope("b.neon.tech.neondb", owner),
    );
    expect(accountScope("a.neon.tech.neondb", owner)).not.toBe(
      accountScope("a.neon.tech.neondb", other),
    );
    const member = memberFromUser({
      id: owner,
      email: "member@example.com",
      user_metadata: { displayName: "Ray", role: "admin" },
    });
    expect(member).not.toHaveProperty("role");
    expect(member.displayName).toBe("Ray");
  });
});
