import "fake-indexeddb/auto";
import Dexie from "dexie";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getDatabase } from "../src/storage/database";
import type { Backup, Note } from "../src/storage/schema";
import { captureWorkspace, useWorkspace } from "../src/storage/workspace";

type Identity = {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  email_confirmed_at?: string;
};
type Listener = (
  event: string,
  session: { user: { id: string } } | null,
) => void;
const sdk = vi.hoisted(() => {
  const listener: { current: Listener | null } = { current: null };
  const holder: {
    value:
      | import("@ntustray/web-authentication-component").AuthController
      | null;
  } = { value: null };
  return {
    getVerifiedUser: vi.fn<() => Promise<Identity | null>>(),
    listener,
    controller: holder,
  };
});
vi.mock("../src/auth/config", async (original) => ({
  ...(await original<typeof import("../src/auth/config")>()),
  getAuthConfiguration: () => ({
    status: "ready",
    value: {
      url: "https://ep-sessions.neon.tech/neondb",
      projectNamespace: "ep-sessions.neon.tech.neondb",
      providers: [],
    },
  }),
}));
vi.mock("../src/auth/shared", async () => {
  const { createAuthController, passwordOnly, success } = await import(
    "@ntustray/web-authentication-component"
  );
  return {
    getSharedAuth() {
      sdk.controller.value ??= createAuthController({
        methods: passwordOnly,
        adapter: {
          id: "fixture",
          capabilities: {
            ...passwordOnly,
            providers: [],
            recovery: "code",
            verification: "code",
          },
          async getSession() {
            const user = await sdk.getVerifiedUser();
            return success(
              user
                ? {
                    user: {
                      id: user.id,
                      email: user.email,
                      name: null,
                      emailVerified: !!user.email_confirmed_at,
                    },
                    expiresAt: null,
                  }
                : null,
            );
          },
          subscribe(notify) {
            sdk.listener.current = (event) => {
              if (event === "SIGNED_OUT")
                sdk.getVerifiedUser.mockResolvedValue(null);
              notify();
            };
            return () => {
              sdk.listener.current = null;
            };
          },
          signOut: async () => success({ kind: "complete" }),
          signIn: async () => success({ kind: "complete" }),
          signUp: async () =>
            success({ kind: "verification-required", delivery: "code" }),
          requestPasswordReset: async () =>
            success({ kind: "sent", delivery: "code" }),
          resetPassword: async () => success({ kind: "complete" }),
          resendVerification: async () =>
            success({ kind: "sent", delivery: "code" }),
          verifyEmail: async () => success({ kind: "complete" }),
        },
      });
      return sdk.controller.value;
    },
  };
});

import { accountScope } from "../src/auth/identity";
import { startAuth, useAuth } from "../src/auth/state";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const scopeA = accountScope("ep-sessions.neon.tech.neondb", a);
const scopeB = accountScope("ep-sessions.neon.tech.neondb", b);
const scopes = ["guest", scopeA, scopeB];
let stop = () => {};
function user(id: string): Identity {
  return {
    id,
    email: `${id}@example.test`,
    user_metadata: {},
    email_confirmed_at: "2026-11-05T00:00:00Z",
  };
}
function note(body: string): Note {
  return {
    id: "page:lesson",
    lessonId: "lesson",
    lessonVersion: 1,
    anchor: { kind: "page" },
    body,
    createdAt: 100,
    updatedAt: 100,
  };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("Promise not initialized");
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  useWorkspace.getState().lock();
  useAuth.setState({
    status: "checking",
    member: null,
    error: null,
  });
  sdk.controller.value = null;
  sdk.getVerifiedUser.mockReset();
  sdk.getVerifiedUser.mockResolvedValue(user(a));
  for (const scope of scopes) {
    const db = getDatabase(scope);
    for (const table of db.tables) await table.clear();
  }
});
afterEach(() => {
  stop();
  stop = () => {};
  vi.restoreAllMocks();
  useWorkspace.getState().lock();
});
afterAll(async () => {
  for (const scope of scopes) await getDatabase(scope).delete();
});

describe("會員狀態與實際本機工作空間切換", () => {
  it("getVerifiedUser 驗證後只載入該帳號，登出立即移除會員資料", async () => {
    await getDatabase(scopeA).notes.put(note("private A"));
    await getDatabase("guest").notes.put(note("guest"));
    stop = startAuth();
    await vi.waitFor(() => expect(useAuth.getState().member?.id).toBe(a));
    expect(useWorkspace.getState().notes[0]?.body).toBe("private A");
    sdk.listener.current?.("SIGNED_OUT", null);
    expect(useAuth.getState().member).toBeNull();
    expect(useWorkspace.getState().notes).toEqual([]);
    await vi.waitFor(() => expect(useWorkspace.getState().notes[0]?.body).toBe("guest"));
  });
  it("新登入事件會立刻作廢舊 getVerifiedUser 回應，不讓 A 閃回 B 的畫面", async () => {
    const old = deferred<Identity | null>();
    sdk.getVerifiedUser
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(user(b));
    stop = startAuth();
    sdk.listener.current?.("SIGNED_IN", { user: { id: b } });
    old.resolve(user(a));
    await old.promise;
    await Promise.resolve();
    expect(useAuth.getState().member).toBeNull();
    expect(useWorkspace.getState().scope).toBe("locked");
    await vi.waitFor(() => expect(useAuth.getState().member?.id).toBe(b));
    expect(useWorkspace.getState().scope).toBe(scopeB);
  });
  it("登出時尚未返回的驗證請求不能把會員資料放回來", async () => {
    stop = startAuth();
    await vi.waitFor(() => expect(useAuth.getState().member?.id).toBe(a));
    const old = deferred<Identity | null>();
    sdk.getVerifiedUser.mockReturnValueOnce(old.promise);
    const refresh = useAuth.getState().refresh();
    sdk.listener.current?.("SIGNED_OUT", null);
    old.resolve(user(a));
    await refresh;
    await useWorkspace.getState().switchScope("guest");
    await vi.waitFor(() => expect(useAuth.getState().status).toBe("signed-out"));
    expect(useWorkspace.getState().scope).toBe("guest");
  });
  it("驗證失敗顯示錯誤並回到訪客空間，不使用未驗證的會員 ID", async () => {
    await getDatabase("guest").notes.put(note("guest"));
    sdk.getVerifiedUser.mockRejectedValue(new Error("network unavailable"));
    stop = startAuth();
    await vi.waitFor(() =>
      expect(useAuth.getState().status).toBe("unavailable"),
    );
    await useWorkspace.getState().switchScope("guest");
    expect(useAuth.getState().member).toBeNull();
    expect(useWorkspace.getState().notes[0]?.body).toBe("guest");
  });
  it("未驗證信箱不能載入會員資料", async () => {
    sdk.getVerifiedUser.mockResolvedValue({
      ...user(a),
      email_confirmed_at: undefined,
    });
    stop = startAuth();
    await vi.waitFor(() =>
      expect(useAuth.getState().status).toBe("signed-out"),
    );
    expect(useAuth.getState().member).toBeNull();
    expect(useWorkspace.getState().scope).toBe("guest");
  });
  it("舊 IndexedDB 載入晚到，也不會覆蓋新帳號空間", async () => {
    const old = deferred<Backup>();
    const first = {
      schemaVersion: 1,
      exportedAt: 100,
      notes: [note("private A")],
      attempts: [],
      progress: [],
      drafts: [],
    };
    vi.spyOn(getDatabase(scopeA), "backup").mockReturnValueOnce(old.promise);
    const loadingA = useWorkspace.getState().switchScope(scopeA);
    await useWorkspace.getState().switchScope(scopeB);
    old.resolve({ ...first, schemaVersion: 1 });
    await loadingA;
    expect(useWorkspace.getState().scope).toBe(scopeB);
    expect(useWorkspace.getState().notes).toEqual([]);
  });
  it("切換期間完成的舊寫入仍留在 A，不寫入 B，也不修改 B 的畫面", async () => {
    await useWorkspace.getState().switchScope(scopeA);
    const finished = deferred<void>();
    const table = getDatabase(scopeA).notes;
    const put = table.put.bind(table);
    vi.spyOn(table, "put").mockImplementationOnce((value) =>
      Dexie.Promise.resolve(finished.promise).then(() => put(value)),
    );
    const isCurrent = captureWorkspace();
    const saving = useWorkspace.getState().saveNote(note("private A"));
    await useWorkspace.getState().switchScope(scopeB);
    expect(isCurrent()).toBe(false);
    finished.resolve();
    await saving;
    expect((await getDatabase(scopeA).notes.get("page:lesson"))?.body).toBe(
      "private A",
    );
    expect(await getDatabase(scopeB).notes.count()).toBe(0);
    expect(useWorkspace.getState().notes).toEqual([]);
    expect(useWorkspace.getState().pendingWrites).toBe(0);
  });
});
