"use client";

import Link from "next/link";
import { useState } from "react";
import type { Catalog, LessonSummary } from "../core/content-schema";
import { useWorkspace } from "../storage/workspace";
import { Icon } from "./icons";

export function Dashboard({
  catalog,
  lessons,
}: {
  catalog: Catalog;
  lessons: LessonSummary[];
}) {
  const [query, setQuery] = useState("");
  const ready = useWorkspace((state) => state.ready);
  const progress = useWorkspace((state) => state.progress);
  const attempts = useWorkspace((state) => state.attempts);
  const notes = useWorkspace((state) => state.notes);
  const completed = new Set(
    progress.filter((item) => item.read).map((item) => item.lessonId),
  );
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const ordered = [
    ...new Set(catalog.tracks.flatMap((track) => track.lessonIds)),
  ].flatMap((id) => {
    const lesson = byId.get(id);
    return lesson ? [lesson] : [];
  });
  const next =
    ordered.find((lesson) => !completed.has(lesson.id)) ?? ordered[0];
  const search = query.trim().toLocaleLowerCase();
  const visible = (lesson: LessonSummary) =>
    `${lesson.title} ${lesson.summary} ${lesson.tags.join(" ")}`
      .toLocaleLowerCase()
      .includes(search);
  const count = lessons.filter(visible).length;
  return (
    <div className="page dashboard">
      <div className="page-intro">
        <div>
          <p className="page-location">
            <Icon name="map" />
            學習地圖
          </p>
          <h1>程式與架構學習地圖</h1>
          <p className="intro-copy">
            從語言基礎到應用架構。讀懂一個概念，寫一段程式，
            <br className="desktop-break" />
            再把自己的理解留在旁邊。
          </p>
        </div>
        <div className="progress-overview">
          <span>學習進度</span>
          <strong>
            {ready ? completed.size : "—"}
            <small> / {lessons.length} 單元已讀</small>
          </strong>
          <div className="progress-bar">
            <span
              style={{
                width: `${ready ? (completed.size / Math.max(1, lessons.length)) * 100 : 0}%`,
              }}
            />
          </div>
          <p>
            {ready
              ? new Set(attempts.map((attempt) => attempt.questionId)).size
              : "—"}{" "}
            題已練習
            <span>
              {ready ? notes.filter((note) => note.body.trim()).length : "—"}{" "}
              則筆記
            </span>
          </p>
        </div>
      </div>
      {next ? (
        <section className="continue-panel" aria-label="繼續學習">
          <div className="continue-symbol">
            <Icon name="book" size={25} />
          </div>
          <div>
            <span>{completed.size > 0 ? "接著往下走" : "從這裡開始"}</span>
            <h2>{next.title}</h2>
            <p>{next.summary}</p>
          </div>
          <Link href={`/learn/${next.id}/`} className="button primary">
            {completed.size > 0 ? "繼續學習" : "開始學習"}
            <Icon name="arrow" />
          </Link>
        </section>
      ) : null}
      <div className="section-toolbar">
        <div>
          <h2>選一條學習路線</h2>
          <p>可以依序前進，也能直接打開想了解的單元。</p>
        </div>
        <label className="search-field">
          <Icon name="search" />
          <span className="sr-only">搜尋單元與主題</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋概念、主題…"
            type="search"
          />
        </label>
      </div>
      {count === 0 ? (
        <div className="empty-state">
          <Icon name="search" size={26} />
          <h3>找不到符合的單元</h3>
          <p>試試「TypeScript」、「API」或「快取」。</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => setQuery("")}
          >
            清除搜尋
          </button>
        </div>
      ) : (
        <div className="learning-tracks">
          {catalog.tracks.map((track, trackIndex) => {
            const items = track.lessonIds.flatMap((id) => {
              const lesson = byId.get(id);
              return lesson && visible(lesson) ? [lesson] : [];
            });
            if (items.length === 0) return null;
            return (
              <section
                className={`track track-${trackIndex % 2}`}
                key={track.id}
              >
                <header className="track-header">
                  <span className="track-glyph">
                    <Icon
                      name={trackIndex % 2 === 0 ? "code" : "map"}
                      size={22}
                    />
                  </span>
                  <div>
                    <h3>{track.title}</h3>
                    <p>{track.description}</p>
                  </div>
                </header>
                <ol className="track-lessons">
                  {items.map((lesson) => {
                    const sequence = track.lessonIds.indexOf(lesson.id) + 1;
                    const done = ready && completed.has(lesson.id);
                    return (
                      <li key={lesson.id}>
                        <span
                          className={`step-number ${done ? "completed" : ""}`}
                        >
                          {done ? <Icon name="check" size={15} /> : sequence}
                        </span>
                        <Link
                          className="lesson-node"
                          href={`/learn/${lesson.id}/`}
                        >
                          <div className="lesson-node-meta">
                            <span>{lesson.tags.join(" / ")}</span>
                            <span>{lesson.minutes} 分鐘</span>
                          </div>
                          <h4>{lesson.title}</h4>
                          <p>{lesson.summary}</p>
                          <div className="lesson-node-footer">
                            <span>{lesson.questionCount} 題練習</span>
                            <span>
                              {done ? "已讀" : "閱讀與練習"}
                              <Icon name="arrow" size={16} />
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}
      <div className="learning-hint">
        <Icon name="note" size={21} />
        <div>
          <strong>理解到哪裡，筆記就留在哪裡。</strong>
          <p>教材可選取文字或段落新增筆記；每個單元也有一份整頁筆記。</p>
        </div>
        <Link href="/notes/">
          整理我的筆記
          <Icon name="arrow" size={16} />
        </Link>
      </div>
    </div>
  );
}
