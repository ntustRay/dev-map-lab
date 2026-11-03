import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceDatabase } from "../src/storage/database";
import type { Note } from "../src/storage/schema";

let database: WorkspaceDatabase;
beforeEach(() => {
  database = new WorkspaceDatabase(`test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await database.delete();
});
function note(updatedAt = 100): Note {
  return {
    id: "page:lesson",
    lessonId: "lesson",
    lessonVersion: 1,
    anchor: { kind: "page" },
    body: "我的筆記",
    createdAt: 100,
    updatedAt,
  };
}

describe("IndexedDB API 操作與備份（fake-indexeddb）", () => {
  it("關閉再開啟仍可讀取筆記與草稿", async () => {
    const name = database.name;
    await database.notes.put(note());
    await database.drafts.put({
      id: "question:1:typescript",
      questionId: "question",
      questionVersion: 1,
      language: "typescript",
      source: "function solve(): number { return 1; }",
      updatedAt: 100,
    });
    database.close();
    database = new WorkspaceDatabase(name);
    expect((await database.notes.get(note().id))?.body).toBe("我的筆記");
    expect((await database.drafts.toArray())[0]?.language).toBe("typescript");
  });
  it("匯出與匯入保留資料，重複匯入不產生副本", async () => {
    await database.notes.put(note());
    const backup = await database.backup();
    await database.notes.clear();
    await database.importBackup(backup);
    await database.importBackup(backup);
    expect(await database.notes.count()).toBe(1);
    expect((await database.notes.get(note().id))?.body).toBe("我的筆記");
  });
  it("匯入舊備份不覆蓋較新筆記，也不清除其他資料", async () => {
    await database.notes.put(note());
    const old = await database.backup();
    await database.notes.put({ ...note(200), body: "新版本" });
    await database.notes.put({ ...note(), id: "other-note", body: "另一則" });
    await database.importBackup(old);
    expect((await database.notes.get(note().id))?.body).toBe("新版本");
    expect(await database.notes.count()).toBe(2);
  });
  it("格式錯誤或版本不符時拒絕整包匯入", async () => {
    await database.notes.put(note());
    const data = await database.backup();
    await expect(
      database.importBackup({ ...data, schemaVersion: 2 }),
    ).rejects.toThrow();
    await expect(
      database.importBackup({ ...data, notes: [{ ...note(), body: 123 }] }),
    ).rejects.toThrow();
    expect((await database.notes.toArray())[0]?.body).toBe("我的筆記");
  });
});
