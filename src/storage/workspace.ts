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
  scope: string;
  ready: boolean;
  error: string | null;
  pendingWrites: number;
  notes: Note[];
  attempts: Attempt[];
  progress: Progress[];
  drafts: Draft[];
  hydrate: () => Promise<void>;
  switchScope: (scope: string) => Promise<void>;
  lock: () => void;
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
  importGuest: () => Promise<{
    notes: number;
    draftConflicts: number;
    attemptConflicts: number;
  }>;
};

const empty = { notes: [], attempts: [], progress: [], drafts: [] };
let generation = 0;
let hydration: { scope: string; promise: Promise<void> } | null = null;

export const useWorkspace = create<Workspace>((set, get) => {
  function current() {
    const state = get();
    if (!state.ready || state.scope === "locked")
      throw new Error("資料空間正在切換，請稍候。");
    return { token: generation, database: getDatabase(state.scope) };
  }
  async function persist(
    token: number,
    work: () => Promise<unknown>,
  ): Promise<void> {
    set((state) => ({ pendingWrites: state.pendingWrites + 1 }));
    try {
      await work();
    } catch {
      if (token === generation)
        set({
          error: "本機儲存失敗，請先匯出備份，確認瀏覽器儲存權限與可用空間。",
        });
    } finally {
      if (token === generation)
        set((state) => ({
          pendingWrites: Math.max(0, state.pendingWrites - 1),
        }));
    }
  }
  async function switchScope(scope: string) {
    if (get().ready && get().scope === scope) return;
    if (hydration?.scope === scope) return hydration.promise;
    const token = ++generation;
    set({ ...empty, scope, ready: false, error: null, pendingWrites: 0 });
    const promise = (async () => {
      try {
        const data = await getDatabase(scope).backup();
        if (token === generation)
          set({
            notes: data.notes,
            attempts: data.attempts,
            progress: data.progress,
            drafts: data.drafts,
            ready: true,
          });
      } catch {
        if (token === generation)
          set({
            ready: true,
            error: "無法開啟本機資料庫；請確認瀏覽器儲存權限，再重新整理。",
          });
      } finally {
        if (token === generation) hydration = null;
      }
    })();
    hydration = { scope, promise };
    await promise;
  }
  return {
    ...empty,
    scope: "guest",
    ready: false,
    error: null,
    pendingWrites: 0,
    hydrate: () =>
      switchScope(get().scope === "locked" ? "guest" : get().scope),
    switchScope,
    lock: () => {
      generation++;
      hydration = null;
      set({
        ...empty,
        scope: "locked",
        ready: false,
        error: null,
        pendingWrites: 0,
      });
    },
    saveNote: async (note) => {
      const { token, database } = current();
      set((state) => ({
        notes: [...state.notes.filter((item) => item.id !== note.id), note],
      }));
      await persist(token, () => database.notes.put(note));
    },
    deleteNote: async (id) => {
      const { token, database } = current();
      set((state) => ({ notes: state.notes.filter((note) => note.id !== id) }));
      await persist(token, () => database.notes.delete(id));
    },
    recordAttempt: async (lessonId, question, answer, grade) => {
      const { token, database } = current();
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
      await persist(token, () => database.attempts.put(attempt));
    },
    markRead: async (lessonId, read) => {
      const { token, database } = current();
      const progress = { lessonId, read, updatedAt: Date.now() };
      set((state) => ({
        progress: [
          ...state.progress.filter((item) => item.lessonId !== lessonId),
          progress,
        ],
      }));
      await persist(token, () => database.progress.put(progress));
    },
    saveDraft: async (question, language, source) => {
      const { token, database } = current();
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
      await persist(token, () => database.drafts.put(draft));
    },
    exportBackup: async () => {
      current();
      return {
        schemaVersion: 1,
        exportedAt: Date.now(),
        notes: get().notes,
        attempts: get().attempts,
        progress: get().progress,
        drafts: get().drafts,
      };
    },
    importBackup: async (raw) => {
      const { token, database } = current();
      await database.importBackup(raw);
      const data = await database.backup();
      if (token === generation)
        set({
          notes: data.notes,
          attempts: data.attempts,
          progress: data.progress,
          drafts: data.drafts,
          ready: true,
          error: null,
        });
    },
    importGuest: async () => {
      const { token, database } = current();
      if (!get().scope.startsWith("member-"))
        throw new Error("請先登入，再匯入訪客資料。");
      const guest = await getDatabase("guest").backup();
      const result = await database.importGuest(guest);
      const data = await database.backup();
      if (token !== generation)
        throw new Error("帳號已切換，匯入結果保留在原帳號。");
      set({
        notes: data.notes,
        attempts: data.attempts,
        progress: data.progress,
        drafts: data.drafts,
        error: null,
      });
      return result;
    },
  };
});

// Check after an async operation, before writing data captured by the previous account.
export function captureWorkspace(): () => boolean {
  const token = generation;
  return () => token === generation && useWorkspace.getState().ready;
}

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
