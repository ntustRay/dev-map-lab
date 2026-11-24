// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useAuth } from "../src/auth/state";
import { AccountPanel } from "../src/components/account-panel";
import { AppShell } from "../src/components/app-shell";
import { useWorkspace } from "../src/storage/workspace";

vi.mock("next/link", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/account/" }));
vi.mock("../src/components/auth-bridge", () => ({ AuthBridge: () => null }));

vi.mock("../src/components/member-auth-forms", () => ({
  AuthForms: () => createElement("input", { type: "email" }),
}));

it("切換本機資料空間時保留會員表單和已輸入的內容", async () => {
  const previous = useAuth.getState();
  const previousWorkspace = useWorkspace.getState();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv(
    "NEXT_PUBLIC_NEON_DATABASE_URL",
    "https://devmap.example.neon.tech/neondb",
  );
  useAuth.setState({ status: "signed-out", member: null, error: null });
  useWorkspace.setState({ scope: "guest" });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  try {
    await act(async () =>
      root.render(
        createElement(AppShell, {
          catalog: { schemaVersion: 1, tracks: [] },
          lessons: [],
          children: createElement(AccountPanel),
        }),
      ),
    );
    const email = host.querySelector("input");
    if (!email) throw new Error("找不到會員表單。");
    email.value = "member@example.com";

    await act(async () => {
      useAuth.setState({ status: "checking" });
      useWorkspace.getState().lock();
    });
    expect(host.querySelector("input")).toBe(email);
    await act(async () => {
      useAuth.setState({ status: "signed-out" });
      useWorkspace.setState({ scope: "guest" });
    });
    expect(host.querySelector("input")?.value).toBe("member@example.com");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    useAuth.setState(previous);
    useWorkspace.setState(previousWorkspace);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});
