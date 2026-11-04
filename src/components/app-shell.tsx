"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode, useState } from "react";
import { useAuth } from "../auth/state";
import type { Catalog, LessonSummary } from "../core/content-schema";
import { useWorkspace } from "../storage/workspace";
import { AuthBridge } from "./auth-bridge";
import { Brand, Icon } from "./icons";

export function AppShell({
  catalog,
  lessons,
  children,
}: {
  catalog: Catalog;
  lessons: LessonSummary[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const ready = useWorkspace((state) => state.ready);
  const scope = useWorkspace((state) => state.scope);
  const error = useWorkspace((state) => state.error);
  const pendingWrites = useWorkspace((state) => state.pendingWrites);
  const member = useAuth((state) => state.member);
  const progress = useWorkspace((state) => state.progress);
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  return (
    <div className="app-shell">
      <AuthBridge />
      <button
        className="mobile-menu icon-button"
        type="button"
        aria-label={menuOpen ? "關閉導覽" : "開啟導覽"}
        aria-expanded={menuOpen}
        aria-controls="app-navigation"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <Icon name={menuOpen ? "close" : "menu"} />
      </button>
      {menuOpen ? (
        <button
          type="button"
          className="navigation-backdrop"
          aria-label="關閉導覽"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside
        id="app-navigation"
        className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}
      >
        <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
          <Brand />
          <span>
            Dev Map Lab<small>程式學習工作台</small>
          </span>
        </Link>
        <nav aria-label="主要導覽">
          <Link
            className={`nav-item ${pathname === "/" ? "active" : ""}`}
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="map" />
            學習地圖
          </Link>
          <Link
            className={`nav-item ${pathname.startsWith("/notes") ? "active" : ""}`}
            href="/notes/"
            aria-current={pathname.startsWith("/notes") ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="note" />
            我的筆記
          </Link>
          <Link
            className={`nav-item ${pathname.startsWith("/account") || pathname.startsWith("/auth") ? "active" : ""}`}
            href="/account/"
            aria-current={pathname.startsWith("/account") ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="member" />
            {member ? "會員與備份" : "登入與會員"}
          </Link>
          <p className="nav-section-label">學習路線</p>
          {catalog.tracks.map((track) => (
            <div className="nav-track" key={track.id}>
              <p>{track.title}</p>
              {track.lessonIds.map((id) => {
                const lesson = byId.get(id);
                if (!lesson) return null;
                const active =
                  pathname === `/learn/${id}/` || pathname === `/learn/${id}`;
                const read =
                  ready &&
                  progress.some((item) => item.lessonId === id && item.read);
                return (
                  <Link
                    key={id}
                    href={`/learn/${id}/`}
                    className={`lesson-nav ${active ? "active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className={`nav-dot ${read ? "done" : ""}`}>
                      {read ? <Icon name="check" size={11} /> : null}
                    </span>
                    <span>{lesson.title}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <strong>{member ? "會員學習空間" : "訪客學習空間"}</strong>
          <p>筆記與進度保存在這個瀏覽器。可從「我的筆記」匯出備份。</p>
          <a
            href="https://github.com/ntustRay/dev-map-lab"
            target="_blank"
            rel="noreferrer"
          >
            GitHub 原始碼
            <Icon name="arrow" size={14} />
          </a>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>教材、練習與筆記</span>
          <span className="save-state" role="status">
            <span className={`status-dot ${error ? "status-error" : ""}`} />
            {!ready
              ? "載入本機資料…"
              : error
                ? "有資料尚未保存"
                : pendingWrites > 0
                  ? "儲存中…"
                  : "本機資料已就緒"}
          </span>
        </header>
        {error ? (
          <div className="storage-error" role="alert">
            {error}
            <Link href="/notes/">前往備份</Link>
          </div>
        ) : null}
        <main id="main-content">
          <Fragment key={pathname.startsWith("/auth/") ? "auth-flow" : scope}>
            {children}
          </Fragment>
        </main>
        <footer className="app-footer">
          <span>Dev Map Lab</span>
          <span>程式與架構學習</span>
        </footer>
      </div>
    </div>
  );
}
