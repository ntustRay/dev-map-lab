"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { LessonSummary } from "../core/content-schema";
import { downloadText, useWorkspace } from "../storage/workspace";
import { Icon } from "./icons";

export function Notebook({ lessons }: { lessons: LessonSummary[] }) {
  const [query, setQuery] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const notes = useWorkspace((state) => state.notes);
  const ready = useWorkspace((state) => state.ready);
  const saveNote = useWorkspace((state) => state.saveNote);
  const deleteNote = useWorkspace((state) => state.deleteNote);
  const exportBackup = useWorkspace((state) => state.exportBackup);
  const importBackup = useWorkspace((state) => state.importBackup);
  const titles = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
  const search = query.trim().toLocaleLowerCase();
  const visible = notes
    .filter(
      (note) =>
        (!lessonId || note.lessonId === lessonId) &&
        `${titles.get(note.lessonId) ?? note.lessonId} ${note.body} ${note.anchor.kind === "selection" ? note.anchor.quote : ""}`
          .toLocaleLowerCase()
          .includes(search),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  async function exportAll() {
    const data = await exportBackup();
    downloadText(
      `dev-map-lab-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    setNotice("已下載包含筆記、進度、作答與程式草稿的備份。");
  }
  async function importFile(file: File) {
    setBusy(true);
    setNotice(null);
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("備份檔案超過 10 MB，請先縮小檔案。");
      const raw: unknown = JSON.parse(await file.text());
      await importBackup(raw);
      setNotice("已合併備份。同一則資料保留較新的版本，不會清除現有筆記。");
    } catch {
      setNotice(
        "無法匯入：請使用本網站匯出的 v1 JSON 備份，檔案需小於 10 MB。",
      );
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = "";
    }
  }
  return (
    <div className="page notebook-page">
      <div className="page-intro">
        <div>
          <p className="page-location">
            <Icon name="note" />
            我的筆記
          </p>
          <h1>我的學習筆記</h1>
          <p className="intro-copy">
            集中回顧整頁與段落筆記，也能回到原單元繼續閱讀。
          </p>
        </div>
        <div className="backup-actions">
          <button
            className="button secondary"
            type="button"
            disabled={!ready || busy}
            onClick={() => picker.current?.click()}
          >
            <Icon name="upload" />
            {busy ? "匯入中…" : "匯入備份"}
          </button>
          <button
            className="button primary"
            type="button"
            disabled={!ready || busy}
            onClick={() => void exportAll()}
          >
            <Icon name="download" />
            匯出全部資料
          </button>
          <input
            className="sr-only"
            type="file"
            accept="application/json,.json"
            ref={picker}
            aria-label="選擇備份 JSON"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
        </div>
      </div>
      <div className="backup-notice">
        <Icon name="note" />
        <p>
          資料保存在目前瀏覽器；更換裝置或清除網站資料前，先匯出備份。備份包含筆記、作答紀錄、閱讀進度與程式草稿。
        </p>
      </div>
      {notice ? (
        <p className="inline-notice" role="status">
          {notice}
        </p>
      ) : null}
      <div className="notebook-filters">
        <label className="search-field">
          <Icon name="search" />
          <span className="sr-only">搜尋筆記</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋筆記或選取的原文…"
          />
        </label>
        <label>
          <span className="sr-only">依單元篩選</span>
          <select
            className="text-input"
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
          >
            <option value="">所有單元</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        </label>
        <span>{visible.length} 則筆記</span>
      </div>
      {!ready ? (
        <p className="loading-text">載入本機筆記…</p>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <Icon name="note" size={32} />
          <h2>{query || lessonId ? "沒有符合的筆記" : "還沒有筆記"}</h2>
          <p>打開單元，記下整頁重點，或在不理解的段落旁加一則註記。</p>
          <Link className="button primary" href="/">
            打開學習地圖
            <Icon name="arrow" />
          </Link>
        </div>
      ) : (
        <div className="notebook-list">
          {visible.map((note) => (
            <article className="notebook-entry" key={note.id}>
              <header>
                <div>
                  <span className="type-label">
                    {note.anchor.kind === "page" ? "整頁筆記" : "段落筆記"}
                  </span>
                  <Link href={`/learn/${note.lessonId}/`}>
                    {titles.get(note.lessonId) ?? note.lessonId}
                  </Link>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="刪除筆記"
                  onClick={() => {
                    if (window.confirm("刪除這則筆記？可先匯出備份。"))
                      void deleteNote(note.id);
                  }}
                >
                  <Icon name="trash" size={17} />
                </button>
              </header>
              {note.anchor.kind === "selection" ? (
                <blockquote>{note.anchor.quote}</blockquote>
              ) : null}
              <label className="sr-only" htmlFor={`notebook-${note.id}`}>
                編輯筆記內容
              </label>
              <textarea
                id={`notebook-${note.id}`}
                value={note.body}
                maxLength={100000}
                rows={5}
                onChange={(event) =>
                  void saveNote({
                    ...note,
                    body: event.target.value,
                    updatedAt: Date.now(),
                  })
                }
              />
              <footer>
                <span>
                  更新時間 {new Date(note.updatedAt).toLocaleString("zh-TW")}
                </span>
                <Link
                  href={`/learn/${note.lessonId}/${note.anchor.kind === "page" ? "" : `#block-${encodeURIComponent(note.anchor.blockId)}`}`}
                >
                  回到單元
                  <Icon name="arrow" size={15} />
                </Link>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
