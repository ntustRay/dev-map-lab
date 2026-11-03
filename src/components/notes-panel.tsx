"use client";

import { useState } from "react";
import type { Lesson } from "../core/content-schema";
import type { Note, NoteAnchor } from "../storage/schema";
import { createNote, downloadText, useWorkspace } from "../storage/workspace";
import { Icon } from "./icons";

export function NotesPanel({
  lesson,
  mode,
  onMode,
  pending,
  onDone,
  onLocate,
}: {
  lesson: Lesson;
  mode: "page" | "annotations";
  onMode: (mode: "page" | "annotations") => void;
  pending: NoteAnchor | null;
  onDone: () => void;
  onLocate: (note: Note) => void;
}) {
  const notes = useWorkspace((state) => state.notes);
  const ready = useWorkspace((state) => state.ready);
  const saveNote = useWorkspace((state) => state.saveNote);
  const deleteNote = useWorkspace((state) => state.deleteNote);
  const pageNote = notes.find(
    (note) => note.lessonId === lesson.id && note.anchor.kind === "page",
  );
  const annotations = notes
    .filter(
      (note) => note.lessonId === lesson.id && note.anchor.kind !== "page",
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  function updatePage(body: string) {
    const note =
      pageNote ?? createNote(lesson.id, lesson.version, { kind: "page" });
    void saveNote({ ...note, body, updatedAt: Date.now() });
  }
  function exportMarkdown() {
    const parts = [
      `# ${lesson.title}：我的筆記`,
      "",
      "## 整頁筆記",
      "",
      pageNote?.body ?? "",
      "",
      "## 段落筆記",
    ];
    for (const note of annotations) {
      parts.push(
        "",
        note.anchor.kind === "selection"
          ? `> ${note.anchor.quote.replace(/\n/g, "\n> ")}`
          : `### ${note.anchor.kind === "block" ? note.anchor.blockId : ""}`,
        "",
        note.body,
      );
    }
    downloadText(
      `${lesson.id}-notes.md`,
      parts.join("\n"),
      "text/markdown;charset=utf-8",
    );
  }
  return (
    <aside className="notes-panel" aria-label="單元筆記">
      <header>
        <div>
          <Icon name="note" />
          <h2>我的筆記</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="匯出本單元 Markdown 筆記"
          title="匯出 Markdown"
          disabled={!ready}
          onClick={exportMarkdown}
        >
          <Icon name="download" size={16} />
        </button>
      </header>
      <div className="notes-tabs">
        <button
          type="button"
          className={mode === "page" ? "selected" : ""}
          aria-pressed={mode === "page"}
          onClick={() => onMode("page")}
        >
          整頁筆記
        </button>
        <button
          type="button"
          className={mode === "annotations" ? "selected" : ""}
          aria-pressed={mode === "annotations"}
          onClick={() => onMode("annotations")}
        >
          段落筆記<span>{annotations.length}</span>
        </button>
      </div>
      {!ready ? (
        <p className="loading-text">載入筆記…</p>
      ) : mode === "page" ? (
        <div className="page-note">
          <label className="sr-only" htmlFor="page-note">
            本單元整頁筆記
          </label>
          <textarea
            id="page-note"
            value={pageNote?.body ?? ""}
            maxLength={100000}
            onChange={(event) => updatePage(event.target.value)}
            placeholder={
              "記下你自己的理解。\n\n可以寫：\n- 這個概念解決什麼問題？\n- 我還沒懂的是什麼？\n- 下次可以用在哪裡？\n\n支援輸入 Markdown，會自動保存在本機。"
            }
          />
          <p className="note-help">
            自動儲存於這個瀏覽器。支援 Markdown 文字與匯出。
          </p>
        </div>
      ) : (
        <div className="annotation-list">
          {pending ? (
            <AnnotationComposer
              key={
                pending.kind === "selection"
                  ? `${pending.blockId}:${pending.quote}:${pending.start}`
                  : pending.kind === "block"
                    ? pending.blockId
                    : "page"
              }
              anchor={pending}
              onCancel={onDone}
              onSave={(body) => {
                const note = createNote(lesson.id, lesson.version, pending);
                void saveNote({ ...note, body });
                onDone();
              }}
            />
          ) : null}
          {!pending && annotations.length === 0 ? (
            <div className="notes-empty">
              <Icon name="plus" size={22} />
              <strong>把問題留在發生的地方</strong>
              <p>選取教材文字後新增筆記，或按段落旁的「＋」。</p>
            </div>
          ) : null}
          {annotations.map((note) => (
            <div className="annotation" key={note.id}>
              <div className="annotation-top">
                <span>
                  {note.anchor.kind === "selection" ? "文字註記" : "段落註記"}
                </span>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="刪除這則筆記"
                  onClick={() => {
                    if (window.confirm("刪除這則筆記？可先匯出備份。"))
                      void deleteNote(note.id);
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
              {note.anchor.kind === "selection" ? (
                <blockquote>{note.anchor.quote}</blockquote>
              ) : null}
              <label className="sr-only" htmlFor={`note-${note.id}`}>
                編輯段落筆記
              </label>
              <textarea
                id={`note-${note.id}`}
                value={note.body}
                rows={4}
                maxLength={100000}
                onChange={(event) =>
                  void saveNote({
                    ...note,
                    body: event.target.value,
                    updatedAt: Date.now(),
                  })
                }
              />
              <div className="annotation-footer">
                <span>
                  {note.lessonVersion !== lesson.version
                    ? "教材已更新，請核對位置"
                    : "已連結教材"}
                </span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onLocate(note)}
                >
                  查看段落
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function AnnotationComposer({
  anchor,
  onSave,
  onCancel,
}: {
  anchor: NoteAnchor;
  onSave: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  return (
    <form
      className="annotation-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim()) onSave(body);
      }}
    >
      <strong>新增註記</strong>
      {anchor.kind === "selection" ? (
        <blockquote>{anchor.quote}</blockquote>
      ) : (
        <p>筆記會連結到這個段落。</p>
      )}
      <label className="sr-only" htmlFor="annotation-draft">
        新增註記內容
      </label>
      <textarea
        id="annotation-draft"
        rows={5}
        value={body}
        maxLength={100000}
        onChange={(event) => setBody(event.target.value)}
        placeholder="寫下你的問題或理解…"
      />
      <div>
        <button
          className="button secondary small"
          type="button"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          className="button primary small"
          disabled={!body.trim()}
          type="submit"
        >
          儲存筆記
        </button>
      </div>
    </form>
  );
}
