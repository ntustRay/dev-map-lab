"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { locateQuote, readSelection } from "../core/anchors";
import type { Lesson, LessonSummary } from "../core/content-schema";
import type { Note, NoteAnchor } from "../storage/schema";
import { useWorkspace } from "../storage/workspace";
import { AuthoredBlock } from "./authored-block";
import { Icon } from "./icons";
import { NotesPanel } from "./notes-panel";
import { Exercises } from "./question-panel";

export function LessonWorkspace({
  lesson,
  prerequisites,
  next,
}: {
  lesson: Lesson;
  prerequisites: LessonSummary[];
  next: LessonSummary | null;
}) {
  const [tab, setTab] = useState<"read" | "practice">("read");
  const [noteMode, setNoteMode] = useState<"page" | "annotations">("page");
  const [pendingNote, setPendingNote] = useState<NoteAnchor | null>(null);
  const [selection, setSelection] = useState<NoteAnchor | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const ready = useWorkspace((state) => state.ready);
  const progress = useWorkspace((state) => state.progress);
  const notes = useWorkspace((state) => state.notes);
  const markRead = useWorkspace((state) => state.markRead);
  const read =
    ready && progress.some((item) => item.lessonId === lesson.id && item.read);
  useEffect(() => {
    const element = body.current;
    if (!element || tab !== "read") return;
    const capture = () => setSelection(readSelection(element));
    element.addEventListener("pointerup", capture);
    element.addEventListener("keyup", capture);
    return () => {
      element.removeEventListener("pointerup", capture);
      element.removeEventListener("keyup", capture);
    };
  }, [tab]);
  function addNote(anchor: NoteAnchor) {
    setNoteMode("annotations");
    setPendingNote(anchor);
    setSelection(null);
    if (window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() =>
        document
          .querySelector(".notes-panel")
          ?.scrollIntoView({ block: "start" }),
      );
    }
  }
  function locate(note: Note) {
    const anchor = note.anchor;
    if (anchor.kind === "page") {
      setNoteMode("page");
      return;
    }
    setTab("read");
    requestAnimationFrame(() => {
      const element = document.getElementById(`block-${anchor.blockId}`);
      if (!element) {
        setNotice("原段落已不存在；筆記仍保留，可先匯出後重新定位。");
        return;
      }
      if (anchor.kind === "selection") {
        const content =
          element.querySelector("[data-block-content]")?.textContent ?? "";
        if (!locateQuote(content, anchor))
          setNotice("原文已修改或有多個相同位置；已移到原段落，請核對筆記。");
      }
      element.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
      });
      element.focus({ preventScroll: true });
    });
  }
  return (
    <div className="page lesson-page">
      <nav className="breadcrumb" aria-label="所在位置">
        <Link href="/">學習地圖</Link>
        <span>/</span>
        <span>{lesson.tags[0]}</span>
      </nav>
      <header className="lesson-header">
        <div className="lesson-meta">
          <span>{lesson.minutes} 分鐘</span>
          <span>{lesson.questions.length} 題練習</span>
          <span>{lesson.tags.join(" / ")}</span>
        </div>
        <h1>{lesson.title}</h1>
        <p>{lesson.summary}</p>
        {prerequisites.length ? (
          <div className="prerequisites">
            建議先讀：
            {prerequisites.map((item) => (
              <Link key={item.id} href={`/learn/${item.id}/`}>
                {item.title}
              </Link>
            ))}
          </div>
        ) : null}
      </header>
      <div className="lesson-layout">
        <div className="lesson-main">
          <div className="lesson-toolbar">
            <div className="lesson-tabs">
              <button
                type="button"
                aria-pressed={tab === "read"}
                className={tab === "read" ? "selected" : ""}
                onClick={() => setTab("read")}
              >
                <Icon name="book" size={17} />
                教材
              </button>
              <button
                type="button"
                aria-pressed={tab === "practice"}
                className={tab === "practice" ? "selected" : ""}
                onClick={() => {
                  setTab("practice");
                  setSelection(null);
                }}
              >
                <Icon name="code" size={17} />
                練習<span>{lesson.questions.length}</span>
              </button>
            </div>
            <button
              className={`text-button read-button ${read ? "is-read" : ""}`}
              disabled={!ready}
              type="button"
              onClick={() => void markRead(lesson.id, !read)}
            >
              <Icon name="check" size={16} />
              {read ? "已讀完" : "標記已讀"}
            </button>
          </div>
          {notice ? (
            <div className="inline-notice" role="status">
              <p>{notice}</p>
              <button
                className="icon-button"
                aria-label="關閉提示"
                type="button"
                onClick={() => setNotice(null)}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ) : null}
          {tab === "read" ? (
            <>
              <div className="reading-guide">
                <span>邊讀邊記</span>
                <p>選取同一段落的文字可新增註記；程式碼也可以。</p>
              </div>
              <div className="lesson-body" ref={body}>
                {lesson.blocks.map((block) => {
                  const count = notes.filter(
                    (note) =>
                      note.lessonId === lesson.id &&
                      note.anchor.kind !== "page" &&
                      note.anchor.blockId === block.id,
                  ).length;
                  return (
                    <section
                      className="lesson-block"
                      id={`block-${block.id}`}
                      tabIndex={-1}
                      key={block.id}
                    >
                      <div className="block-note-tools">
                        <button
                          type="button"
                          className={`block-note-button ${count ? "has-notes" : ""}`}
                          aria-label={`在段落 ${block.id} 新增筆記`}
                          title="新增段落筆記"
                          disabled={!ready}
                          onClick={() =>
                            addNote({ kind: "block", blockId: block.id })
                          }
                        >
                          {count ? (
                            <span>{count}</span>
                          ) : (
                            <Icon name="plus" size={15} />
                          )}
                        </button>
                      </div>
                      <AuthoredBlock block={block} />
                    </section>
                  );
                })}
              </div>
              {selection ? (
                <div className="selection-action" role="status">
                  <span>
                    已選取{" "}
                    {selection.kind === "selection"
                      ? selection.quote.length
                      : 0}{" "}
                    個字元
                  </span>
                  <button
                    type="button"
                    className="button primary small"
                    disabled={!ready}
                    onClick={() => addNote(selection)}
                  >
                    <Icon name="plus" size={15} />
                    新增選取筆記
                  </button>
                  <button
                    className="icon-button"
                    aria-label="取消選取註記"
                    type="button"
                    onClick={() => setSelection(null)}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ) : null}
              <div className="reading-finish">
                <div>
                  <strong>讀完了，試著自己解釋一次。</strong>
                  <p>選擇、填充、簡答，再用程式驗證。</p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setTab("practice")}
                >
                  開始練習
                  <Icon name="arrow" />
                </button>
              </div>
            </>
          ) : (
            <Exercises lessonId={lesson.id} questions={lesson.questions} />
          )}
          {next ? (
            <Link className="next-lesson" href={`/learn/${next.id}/`}>
              <span>
                下一個單元<strong>{next.title}</strong>
              </span>
              <Icon name="arrow" />
            </Link>
          ) : (
            <Link className="next-lesson" href="/">
              <span>
                回到地圖<strong>選擇接下來的學習方向</strong>
              </span>
              <Icon name="map" />
            </Link>
          )}
        </div>
        <NotesPanel
          lesson={lesson}
          mode={noteMode}
          onMode={setNoteMode}
          pending={pendingNote}
          onDone={() => setPendingNote(null)}
          onLocate={locate}
        />
      </div>
    </div>
  );
}
