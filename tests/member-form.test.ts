// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useAuth } from "../src/auth/state";
import { AccountPanel } from "../src/components/account-panel";

vi.mock("../src/components/member-auth-forms", () => ({
  AuthForms: () => createElement("input", { type: "email" }),
}));

it("確認登入狀態時保留會員表單和已輸入的內容", async () => {
  const previous = useAuth.getState();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv(
    "NEXT_PUBLIC_NEON_DATABASE_URL",
    "https://devmap.example.neon.tech/neondb",
  );
  useAuth.setState({ status: "signed-out", member: null, error: null });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  try {
    await act(async () => root.render(createElement(AccountPanel)));
    const email = host.querySelector("input");
    if (!email) throw new Error("找不到會員表單。");
    email.value = "member@example.com";

    await act(async () => useAuth.setState({ status: "checking" }));
    expect(host.querySelector("input")).toBe(email);
    await act(async () => useAuth.setState({ status: "signed-out" }));
    expect(host.querySelector("input")?.value).toBe("member@example.com");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    useAuth.setState(previous);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});
