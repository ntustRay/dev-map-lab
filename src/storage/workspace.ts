"use client";

import { create } from "zustand";
import type { Language, Question } from "../core/content-schema";
import type { GradeResult } from "../core/grade";
import { createLocalId } from "../core/local-id";
import { getDatabase } from "./database";
import type {
  Attempt,
  Backup,
  Draft,
  Note,
  NoteAnchor,
  Progress,
} from "./schema";

type Workspace = {
  ready: boolean;
  error: string | null;
  pendingWrites: number;
  notes: Note[];
  attempts: Attempt[];
  progress: Progress[];
  drafts: Draft[];
  hydrate: () => Promise<void>;
  saveNote: (note: Note) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  recordAttempt: (
    lessonId: string,
    question: Question,
    answer: string,
    grade: GradeResult,
  ) => Promise<void>;
  markRead: (lessonId: string, read: boolean) => Promise<void>;
  saveDraft: (
    question: Question,
    language: Language,
    source: string,
  ) => Promise<void>;
  exportBackup: () => Promise<Backup>;
  importBackup: (raw: unknown) => Promise<void>;
};
let hydration: Promise<void> | null = null;

export const useWorkspace = create<Workspace>((set, get) => {
  async function persist(work: () => Promise<unknown>): Promise<void> {
    set((state) => ({ pendingWrites: state.pendingWrites + 1 }));
    try {
      await work();
    } catch {
      set({
        error:
          "本機儲存失敗，請先匯出備份，確認瀏覽器允許 IndexedDB 與可用空間。",
      });
    } finally {
      set((state) => ({ pendingWrites: state.pendingWrites - 1 }));
    }
  }
  return {
    ready: false,
    error: null,
    pendingWrites: 0,
    notes: [],
    attempts: [],
    progress: [],
    drafts: [],
    hydrate: async () => {
      hydration ??= (async () => {
        try {
          const data = await getDatabase().backup();
          set({ ...data, ready: true });
        } catch {
          set({
            ready: true,
            error:
              "無法開啟本機資料庫；目前內容尚未保存，請確認瀏覽器儲存權限。",
          });
        }
      })();
      await hydration;
    },
    saveNote: async (note) => {
      set((state) => ({
        notes: [...state.notes.filter((item) => item.id !== note.id), note],
      }));
      await persist(() => getDatabase().notes.put(note));
    },
    deleteNote: async (id) => {
      set((state) => ({ notes: state.notes.filter((note) => note.id !== id) }));
      await persist(() => getDatabase().notes.delete(id));
    },
    recordAttempt: async (lessonId, question, answer, grade) => {
      const attempt: Attempt = {
        id: createLocalId(),
        lessonId,
        questionId: question.id,
        questionVersion: question.version,
        graderVersion: "1",
        answer,
        grade,
        createdAt: Date.now(),
      };
      set((state) => ({ attempts: [...state.attempts, attempt] }));
      await persist(() => getDatabase().attempts.put(attempt));
    },
    markRead: async (lessonId, read) => {
      const progress = { lessonId, read, updatedAt: Date.now() };
      set((state) => ({
        progress: [
          ...state.progress.filter((item) => item.lessonId !== lessonId),
          progress,
        ],
      }));
      await persist(() => getDatabase().progress.put(progress));
    },
    saveDraft: async (question, language, source) => {
      const draft: Draft = {
        id: `${question.id}:${question.version}:${language}`,
        questionId: question.id,
        questionVersion: question.version,
        language,
        source,
        updatedAt: Date.now(),
      };
      set((state) => ({
        drafts: [...state.drafts.filter((item) => item.id !== draft.id), draft],
      }));
      await persist(() => getDatabase().drafts.put(draft));
    },
    exportBackup: async () => ({
      schemaVersion: 1,
      exportedAt: Date.now(),
      notes: get().notes,
      attempts: get().attempts,
      progress: get().progress,
      drafts: get().drafts,
    }),
    importBackup: async (raw) => {
      await getDatabase().importBackup(raw);
      const data = await getDatabase().backup();
      set({ ...data, ready: true, error: null });
    },
  };
});

export function createNote(
  lessonId: string,
  lessonVersion: number,
  anchor: NoteAnchor,
): Note {
  const now = Date.now();
  return {
    id: anchor.kind === "page" ? `page:${lessonId}` : createLocalId(),
    lessonId,
    lessonVersion,
    anchor,
    body: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function downloadText(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
