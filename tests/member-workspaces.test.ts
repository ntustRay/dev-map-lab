import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceDatabase } from "../src/storage/database";
import type { Backup, Note } from "../src/storage/schema";

const databases: WorkspaceDatabase[] = [];
function database() {
  const value = new WorkspaceDatabase(`member-test-${crypto.randomUUID()}`);
  databases.push(value);
  return value;
}
function pageNote(body: string, updatedAt = 100): Note {
  return {
    id: "page:lesson",
    lessonId: "lesson",
    lessonVersion: 1,
    anchor: { kind: "page" },
    body,
    createdAt: 100,
    updatedAt,
  };
}
function backup(notes: Note[] = []): Backup {
  return {
    schemaVersion: 1,
    exportedAt: 100,
    notes,
    attempts: [],
    progress: [],
    drafts: [],
  };
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});

describe("會員本機空間與明確的訪客匯入", () => {
  it("訪客、帳號 A、帳號 B 的內容互不混用", async () => {
    const guest = database();
    const a = database();
    const b = database();
    await guest.notes.put(pageNote("guest"));
    await a.notes.put(pageNote("private A"));
    expect(await b.notes.count()).toBe(0);
    expect((await guest.backup()).notes[0]?.body).toBe("guest");
    expect((await a.backup()).notes[0]?.body).toBe("private A");
  });
  it("匯入整頁筆記衝突保留兩邊本文，重複操作不重複加入", async () => {
    const member = database();
    await member.notes.put(pageNote("會員筆記", 200));
    const guest = backup([pageNote("訪客筆記")]);
    await member.importGuest(guest);
    const first = (await member.notes.get("page:lesson"))?.body;
    expect(first).toContain("會員筆記");
    expect(first).toContain("訪客筆記");
    await member.importGuest(guest);
    expect((await member.notes.get("page:lesson"))?.body).toBe(first);
  });
  it("相同段落 ID 但不同本文會保留副本與原始 anchor", async () => {
    const member = database();
    const anchorNote: Note = {
      ...pageNote("會員註記"),
      id: "same-id",
      anchor: { kind: "block", blockId: "one" },
    };
    await member.notes.put(anchorNote);
    await member.importGuest(
      backup([
        {
          ...anchorNote,
          body: "訪客註記",
          anchor: { kind: "block", blockId: "two" },
        },
      ]),
    );
    expect(await member.notes.count()).toBe(2);
    expect(
      (await member.notes.toArray()).some(
        (note) => note.anchor.kind === "block" && note.anchor.blockId === "two",
      ),
    ).toBe(true);
  });
  it("程式草稿衝突不覆蓋會員版本，來源訪客資料也保留", async () => {
    const member = database();
    const guest = database();
    const draft = {
      id: "q:1:typescript",
      questionId: "q",
      questionVersion: 1,
      language: "typescript",
      source: "member code",
      updatedAt: 100,
    };
    await member.drafts.put({ ...draft, language: "typescript" });
    await guest.drafts.put({
      ...draft,
      language: "typescript",
      source: "guest code",
      updatedAt: 200,
    });
    const result = await member.importGuest(await guest.backup());
    expect(result.draftConflicts).toBe(1);
    expect((await member.drafts.get(draft.id))?.source).toBe("member code");
    expect((await guest.drafts.get(draft.id))?.source).toBe("guest code");
  });
  it("格式錯誤時整包不匯入", async () => {
    const member = database();
    await member.notes.put(pageNote("會員筆記"));
    await expect(
      member.importGuest({ ...backup(), notes: [{ body: 5 }] }),
    ).rejects.toThrow();
    expect((await member.notes.get("page:lesson"))?.body).toBe("會員筆記");
  });
  it("整頁筆記合併超過上限時，交易回復並保留雙方原稿", async () => {
    const member = database();
    await member.notes.put(pageNote("a".repeat(60000)));
    await expect(
      member.importGuest(backup([pageNote("b".repeat(60000))])),
    ).rejects.toThrow("超過 100,000 字元");
    expect((await member.backup()).notes[0]?.body).toBe("a".repeat(60000));
    expect(await member.imports.count()).toBe(0);
  });
});
