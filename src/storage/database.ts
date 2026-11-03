import Dexie, { type Table } from "dexie";
import {
  type Attempt,
  type Backup,
  backupSchema,
  type Draft,
  type Note,
  type Progress,
} from "./schema";

export class WorkspaceDatabase extends Dexie {
  notes!: Table<Note, string>;
  attempts!: Table<Attempt, string>;
  progress!: Table<Progress, string>;
  drafts!: Table<Draft, string>;

  constructor(name = "dev-map-lab-v1") {
    super(name);
    this.version(1).stores({
      notes: "id, lessonId, updatedAt",
      attempts: "id, lessonId, questionId, createdAt",
      progress: "lessonId",
      drafts: "id, questionId",
    });
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

let instance: WorkspaceDatabase | null = null;
export function getDatabase(): WorkspaceDatabase {
  instance ??= new WorkspaceDatabase();
  return instance;
}
