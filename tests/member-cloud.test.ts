import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Backup } from "../src/storage/schema";

const sdk = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("../src/auth/client", () => ({
  requireSupabaseClient: () => ({
    auth: { getUser: sdk.getUser },
    rpc: sdk.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: sdk.maybeSingle }) }),
    }),
  }),
}));

import {
  readCloudSnapshot,
  saveCloudSnapshot,
  validateCloudBackup,
} from "../src/auth/cloud";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const backup: Backup = {
  schemaVersion: 1,
  exportedAt: 100,
  notes: [],
  attempts: [],
  progress: [],
  drafts: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  sdk.getUser.mockResolvedValue({ data: { user: { id: a } }, error: null });
  sdk.rpc.mockResolvedValue({
    data: [{ new_revision: 2, saved_at: "2026-11-03T00:00:00+00:00" }],
    error: null,
  });
});
describe("Supabase SDK 邊界：帳號、payload 與 RPC 收據", () => {
  it("先驗證身分，帳號不同時不讀寫雲端", async () => {
    sdk.getUser.mockResolvedValue({ data: { user: { id: b } }, error: null });
    await expect(saveCloudSnapshot(a, 1, backup)).rejects.toThrow("帳號已切換");
    await expect(readCloudSnapshot(a)).rejects.toThrow("帳號已切換");
    expect(sdk.rpc).not.toHaveBeenCalled();
    expect(sdk.maybeSingle).not.toHaveBeenCalled();
  });
  it("RPC 會帶入原本帳號與預期版本，且只接受有效收據", async () => {
    expect(await saveCloudSnapshot(a, 1, backup)).toEqual({
      revision: 2,
      savedAt: "2026-11-03T00:00:00+00:00",
    });
    expect(sdk.rpc).toHaveBeenCalledWith("devmap_save_workspace", {
      expected_user_id: a,
      expected_revision: 1,
      new_payload: backup,
    });
    sdk.rpc.mockResolvedValue({ data: [], error: null });
    await expect(saveCloudSnapshot(a, 1, backup)).rejects.toThrow();
  });
  it("雲端回傳錯誤 owner 或毀損資料時不匯入", async () => {
    sdk.maybeSingle.mockResolvedValue({
      data: {
        user_id: b,
        revision: 1,
        payload: backup,
        updated_at: "2026-11-03T00:00:00Z",
      },
      error: null,
    });
    await expect(readCloudSnapshot(a)).rejects.toThrow("格式不相容");
    sdk.maybeSingle.mockResolvedValue({
      data: {
        user_id: a,
        revision: 1,
        payload: { ...backup, notes: [5] },
        updated_at: "2026-11-03T00:00:00Z",
      },
      error: null,
    });
    await expect(readCloudSnapshot(a)).rejects.toThrow("格式不相容");
  });
  it("過大且含多位元組文字的合法備份會在網路呼叫前拒絕", async () => {
    const large = {
      ...backup,
      notes: Array.from({ length: 30 }, (_, index) => ({
        id: `note-${index}`,
        lessonId: "lesson",
        lessonVersion: 1,
        anchor: { kind: "page" },
        body: "文".repeat(70000),
        createdAt: 100,
        updatedAt: 100,
      })),
    };
    expect(() => validateCloudBackup(large)).toThrow("5 MB");
    await expect(saveCloudSnapshot(a, 0, large)).rejects.toThrow("5 MB");
    expect(sdk.getUser).not.toHaveBeenCalled();
  });
});
