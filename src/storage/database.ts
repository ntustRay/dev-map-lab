import Dexie, { type Table } from "dexie";
import { createLocalId } from "../core/local-id";
import {
  type Attempt,
  type Backup,
  backupSchema,
  type Draft,
  type Note,
  type Progress,
} from "./schema";

export class GuestImportError extends Error {}

export class WorkspaceDatabase extends Dexie {
  notes!: Table<Note, string>;
  attempts!: Table<Attempt, string>;
  progress!: Table<Progress, string>;
  drafts!: Table<Draft, string>;
  imports!: Table<{ id: string; source: string }, string>;

  constructor(name = "dev-map-lab-v1") {
    super(name);
    this.version(1).stores({
      notes: "id, lessonId, updatedAt",
      attempts: "id, lessonId, questionId, createdAt",
      progress: "lessonId",
      drafts: "id, questionId",
    });
    this.version(2).stores({ imports: "id" });
  }

  async backup(): Promise<Backup> {
    return this.transaction("r", this.tables, async () =>
      backupSchema.parse({
        schemaVersion: 1,
        exportedAt: Date.now(),
        notes: await this.notes.toArray(),
        attempts: await this.attempts.toArray(),
        progress: await this.progress.toArray(),
        drafts: await this.drafts.toArray(),
      }),
    );
  }

  async importBackup(raw: unknown): Promise<void> {
    const data = backupSchema.parse(raw);
    await this.transaction("rw", this.tables, async () => {
      await mergeByTime(this.notes, data.notes, (note) => note.id);
      await mergeByTime(
        this.progress,
        data.progress,
        (progress) => progress.lessonId,
      );
      await mergeByTime(this.drafts, data.drafts, (draft) => draft.id);
      for (const attempt of data.attempts) {
        if (!(await this.attempts.get(attempt.id)))
          await this.attempts.add(attempt);
      }
    });
  }

  async importGuest(raw: unknown): Promise<{
    notes: number;
    draftConflicts: number;
    attemptConflicts: number;
  }> {
    const guest = backupSchema.parse(raw);
    const result = { notes: 0, draftConflicts: 0, attemptConflicts: 0 };
    await this.transaction("rw", this.tables, async () => {
      for (const note of guest.notes) {
        const receiptId = `guest-note:${note.id}`;
        const source = JSON.stringify(note);
        if ((await this.imports.get(receiptId))?.source === source) continue;
        const existing = await this.notes.get(note.id);
        if (!existing) await this.notes.put(note);
        else if (existing.body !== note.body && note.body.trim()) {
          if (existing.anchor.kind === "page" && note.anchor.kind === "page") {
            const body = `${existing.body}\n\n---\n\n### 訪客筆記匯入\n\n${note.body}`;
            if (body.length > 100000)
              throw new GuestImportError(
                "整頁筆記合併後超過 100,000 字元，這次匯入未套用。請先匯出訪客備份並整理筆記。",
              );
            await this.notes.put({
              ...existing,
              body,
              updatedAt: Math.max(Date.now(), existing.updatedAt + 1),
            });
          } else await this.notes.put({ ...note, id: createLocalId() });
        }
        await this.imports.put({ id: receiptId, source });
        result.notes++;
      }
      await mergeByTime(
        this.progress,
        guest.progress,
        (progress) => progress.lessonId,
      );
      for (const draft of guest.drafts) {
        const existing = await this.drafts.get(draft.id);
        if (!existing) await this.drafts.put(draft);
        else if (existing.source !== draft.source) result.draftConflicts++;
      }
      for (const attempt of guest.attempts) {
        const existing = await this.attempts.get(attempt.id);
        if (!existing) await this.attempts.put(attempt);
        else if (JSON.stringify(existing) !== JSON.stringify(attempt))
          result.attemptConflicts++;
      }
    });
    return result;
  }
}

async function mergeByTime<T extends { updatedAt: number }>(
  table: Table<T, string>,
  records: T[],
  key: (record: T) => string,
) {
  for (const record of records) {
    const existing = await table.get(key(record));
    if (!existing || record.updatedAt > existing.updatedAt)
      await table.put(record);
  }
}

const instances = new Map<string, WorkspaceDatabase>();
export function getDatabase(scope = "guest"): WorkspaceDatabase {
  if (!/^[a-zA-Z0-9.-]+$/.test(scope) || scope === "locked")
    throw new Error("本機資料空間尚未就緒。");
  let instance = instances.get(scope);
  if (!instance) {
    instance = new WorkspaceDatabase(
      scope === "guest" ? "dev-map-lab-v1" : `dev-map-lab-${scope}-v1`,
    );
    instances.set(scope, instance);
  }
  return instance;
}
