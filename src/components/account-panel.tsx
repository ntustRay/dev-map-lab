"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ZodError } from "zod";
import {
  requestPasswordReset,
  resendVerification,
  signInEmail,
  signInSocial,
  signOutMember,
  signUpEmail,
  updateRecoveredPassword,
} from "../auth/actions";
import {
  type CloudSnapshot,
  readCloudSnapshot,
  readDisplayName,
  saveCloudSnapshot,
  saveDisplayName,
} from "../auth/cloud";
import { getAuthConfiguration } from "../auth/config";
import { authErrorMessage, MemberOperationError } from "../auth/errors";
import type { Member } from "../auth/identity";
import { useAuth } from "../auth/state";
import { GuestImportError, getDatabase } from "../storage/database";
import { downloadText, useWorkspace } from "../storage/workspace";
import { Icon } from "./icons";

function message(error: unknown): string {
  if (error instanceof GuestImportError) return error.message;
  return error instanceof ZodError
    ? (error.issues[0]?.message ?? "請檢查輸入內容。")
    : authErrorMessage(error);
}

export function AccountPanel() {
  const status = useAuth((state) => state.status);
  const member = useAuth((state) => state.member);
  const error = useAuth((state) => state.error);
  const recovery = useAuth((state) => state.recovery);
  const config = getAuthConfiguration();
  return (
    <div className="page account-page">
      <p className="page-location">
        <Icon name="member" />
        會員與備份
      </p>
      <h1>管理帳號與學習資料</h1>
      <p className="intro-copy">
        登入後使用自己的學習空間，並選擇何時備份到雲端。
      </p>
      {status === "checking" ? (
        <div className="account-card">
          <p role="status">確認會員狀態與本機資料空間…</p>
        </div>
      ) : config.status !== "ready" ? (
        <div className="account-card">
          <h2>會員功能尚未啟用</h2>
          <p>{config.reason}</p>
          <p>
            現有筆記與進度保存在這個瀏覽器。設定完成後，可選擇將訪客資料匯入自己的帳號。
          </p>
          <div className="account-actions">
            <Link className="button primary" href="/">
              繼續本機學習
            </Link>
            <a
              className="button secondary"
              href="https://github.com/ntustRay/dev-map-lab/blob/main/docs/MEMBERSHIP.md"
              target="_blank"
              rel="noreferrer"
            >
              會員服務設定指南
            </a>
          </div>
        </div>
      ) : member ? (
        recovery ? (
          <RecoveryForm />
        ) : (
          <MemberAccount key={member.id} member={member} />
        )
      ) : (
        <>
          <div className="account-layout">
            <AuthForms />{" "}
            <aside className="account-info">
              <h2>登入後的資料怎麼保存？</h2>
              <ul>
                <li>每個帳號有自己的本機筆記與進度。</li>
                <li>訪客資料會留在原本空間，可自行決定是否匯入。</li>
                <li>雲端備份採手動操作，先合併已有備份再上傳。</li>
                <li>登出後回到訪客空間，畫面會移除會員資料。</li>
              </ul>
            </aside>
          </div>
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function AuthForms() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "resend">(
    "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const config = getAuthConfiguration();
  function changeMode(next: typeof mode) {
    setMode(next);
    setPassword("");
    setConfirmation("");
    setError(null);
    setNotice(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") await signInEmail(email, password);
      else if (mode === "signup") {
        if (password !== confirmation)
          throw new MemberOperationError("兩次密碼不一致。");
        const signedIn = await signUpEmail(email, password, displayName);
        if (!signedIn) {
          setNotice(
            "請查看信箱，開啟確認信完成驗證。請使用發起註冊的同一個瀏覽器開啟連結。",
          );
          setPassword("");
          setConfirmation("");
        }
      } else if (mode === "forgot") {
        await requestPasswordReset(email);
        setNotice(
          "如果這個信箱已註冊，會收到密碼重設信。請使用同一個瀏覽器開啟連結。",
        );
      } else {
        await resendVerification(email);
        setNotice("如果這個信箱需要驗證，會收到新的確認信。請稍後檢查收件匣。");
      }
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "signup"
      ? "建立會員"
      : mode === "forgot"
        ? "忘記密碼"
        : mode === "resend"
          ? "重寄確認信"
          : "登入會員";
  return (
    <section className="account-card">
      <fieldset className="account-mode">
        <legend className="sr-only">會員操作</legend>
        <button
          type="button"
          disabled={busy}
          className={mode === "signin" ? "selected" : ""}
          aria-pressed={mode === "signin"}
          onClick={() => changeMode("signin")}
        >
          登入
        </button>
        <button
          type="button"
          disabled={busy}
          className={mode === "signup" ? "selected" : ""}
          aria-pressed={mode === "signup"}
          onClick={() => changeMode("signup")}
        >
          註冊
        </button>
      </fieldset>
      <h2>{title}</h2>
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        <label>
          Email
          <input
            className="text-input"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {mode === "signup" ? (
          <label>
            顯示名稱（選填）
            <input
              className="text-input"
              autoComplete="nickname"
              maxLength={80}
              value={displayName}
              disabled={busy}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
        ) : null}
        {mode === "signin" || mode === "signup" ? (
          <label>
            密碼
            <input
              className="text-input"
              type="password"
              required
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              disabled={busy}
              maxLength={mode === "signin" ? 1000 : 72}
              minLength={mode === "signup" ? 12 : 1}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === "signup" ? (
              <span className="field-help">
                至少 12 個字元；密碼 UTF-8 長度最多 72 bytes。
              </span>
            ) : null}
          </label>
        ) : null}
        {mode === "signup" ? (
          <label>
            再次輸入密碼
            <input
              className="text-input"
              type="password"
              required
              autoComplete="new-password"
              maxLength={72}
              value={confirmation}
              disabled={busy}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
        ) : null}
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? "處理中…" : title}
        </button>
      </form>
      <div className="auth-secondary-actions">
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => changeMode("forgot")}
        >
          忘記密碼
        </button>
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => changeMode("resend")}
        >
          重寄確認信
        </button>
      </div>
      {config.status === "ready" && config.value.providers.length ? (
        <div className="social-signin">
          <p>或使用其他帳號</p>
          {config.value.providers.map((provider) => (
            <button
              className="button secondary"
              key={provider}
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void signInSocial(provider).catch((cause) => {
                  setError(message(cause));
                  setBusy(false);
                });
              }}
            >
              使用 {provider === "github" ? "GitHub" : "Google"} 登入
            </button>
          ))}
        </div>
      ) : null}
      {notice ? (
        <p className="inline-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function RecoveryForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="account-card recovery-card">
      <h2>設定新密碼</h2>
      <p>更新完成後，請使用新密碼重新登入。</p>
      <form
        className="account-form"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          void (async () => {
            try {
              if (password !== confirmation)
                throw new MemberOperationError("兩次密碼不一致。");
              await updateRecoveredPassword(password);
            } catch (cause) {
              setError(message(cause));
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <label>
          新密碼
          <input
            className="text-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={72}
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          再次輸入新密碼
          <input
            className="text-input"
            type="password"
            autoComplete="new-password"
            required
            maxLength={72}
            value={confirmation}
            disabled={busy}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? "更新中…" : "更新密碼並登出"}
        </button>
      </form>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function MemberAccount({ member }: { member: Member }) {
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState(member.displayName);
  const [cloud, setCloud] = useState<CloudSnapshot | null>(null);
  const [checked, setChecked] = useState(false);
  const [merged, setMerged] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState({
    notes: 0,
    attempts: 0,
    drafts: 0,
  });
  const [allowGuestImport, setAllowGuestImport] = useState(false);
  const ready = useWorkspace((state) => state.ready);
  const pendingWrites = useWorkspace((state) => state.pendingWrites);
  function isCurrent() {
    return (
      useAuth.getState().member?.id === member.id &&
      useWorkspace.getState().scope.startsWith("member-") &&
      useWorkspace.getState().ready
    );
  }
  useEffect(() => {
    let active = true;
    void Promise.all([readDisplayName(member.id), readCloudSnapshot(member.id)])
      .then(([name, snapshot]) => {
        if (!active) return;
        if (name !== null) setDisplayName(name);
        setCloud(snapshot);
        setRevision(snapshot?.revision ?? 0);
        setMerged(snapshot === null);
        setChecked(true);
      })
      .catch((cause) => {
        if (active) setError(message(cause));
      });
    void getDatabase("guest")
      .backup()
      .then((backup) => {
        if (active)
          setGuestCount({
            notes: backup.notes.length,
            attempts: backup.attempts.length,
            drafts: backup.drafts.length,
          });
      })
      .catch(() => {
        if (active) setError("無法讀取訪客資料，請先從訪客空間匯出檔案備份。");
      });
    return () => {
      active = false;
    };
  }, [member.id]);
  async function operate(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!isCurrent())
        throw new MemberOperationError("帳號資料正在切換，請稍後重試。");
      await work();
    } catch (cause) {
      if (isCurrent()) setError(message(cause));
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  async function mergeCloud() {
    if (useWorkspace.getState().error)
      throw new MemberOperationError(
        "本機儲存有錯誤，請先從「我的筆記」匯出備份，再重新整理後合併。",
      );
    const latest = await readCloudSnapshot(member.id);
    if (!isCurrent()) return;
    if (latest) await useWorkspace.getState().importBackup(latest.payload);
    if (!isCurrent()) return;
    setCloud(latest);
    setRevision(latest?.revision ?? 0);
    setMerged(true);
    setChecked(true);
    setNotice(
      latest
        ? "已合併雲端資料；相同 ID 保留更新時間較新的版本。"
        : "目前沒有雲端備份，可以建立第一份備份。",
    );
  }
  async function upload() {
    if (!checked || !merged)
      throw new MemberOperationError("請先讀取並合併雲端資料。");
    const backup = await useWorkspace.getState().exportBackup();
    try {
      const receipt = await saveCloudSnapshot(member.id, revision, backup);
      if (!isCurrent()) return;
      setRevision(receipt.revision);
      setCloud({
        user_id: member.id,
        revision: receipt.revision,
        payload: backup,
        updated_at: receipt.savedAt,
      });
      setNotice("已建立雲端備份。之後新增的本機資料，需要再次備份。");
    } catch (cause) {
      if (isCurrent()) setMerged(false);
      throw cause;
    }
  }
  return (
    <>
      <div className="member-summary">
        <div>
          <span className="type-label">已登入</span>
          <strong>{member.email ?? "會員帳號"}</strong>
          <p>目前顯示的是這個帳號的本機學習資料。</p>
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            void signOutMember().catch((cause) => setError(message(cause)));
          }}
        >
          登出此裝置
        </button>
      </div>
      {notice ? (
        <p className="inline-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="member-sections">
        <section className="account-card">
          <h2>顯示名稱</h2>
          <form
            className="account-form"
            onSubmit={(event) => {
              event.preventDefault();
              void operate(async () => {
                await saveDisplayName(member.id, displayName);
                if (isCurrent()) setNotice("顯示名稱已儲存。");
              });
            }}
          >
            <label>
              顯示名稱
              <input
                className="text-input"
                autoComplete="nickname"
                maxLength={80}
                value={displayName}
                disabled={busy || !checked}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <button
              className="button secondary"
              type="submit"
              disabled={busy || !checked || !ready}
            >
              儲存名稱
            </button>
          </form>
        </section>
        <section className="account-card">
          <h2>雲端備份</h2>
          <p>
            {!checked
              ? "尚未讀取雲端狀態。"
              : cloud
                ? `目前雲端版本 ${revision}，包含 ${cloud.payload.notes.length} 則筆記、${cloud.payload.attempts.length} 次作答。`
                : "還沒有雲端備份。"}
          </p>
          <p className="field-help">
            採手動備份，每份上限 5
            MB。已有備份時，先讀取並合併，再上傳本機資料。合併時相同 ID
            保留更新時間較新的版本。
          </p>
          <div className="account-actions">
            <button
              className="button secondary"
              type="button"
              disabled={busy || !ready || pendingWrites > 0}
              onClick={() => void operate(mergeCloud)}
            >
              <Icon name="download" />
              讀取雲端並合併
            </button>
            <button
              className="button primary"
              type="button"
              disabled={
                busy || !ready || pendingWrites > 0 || !checked || !merged
              }
              onClick={() => void operate(upload)}
            >
              <Icon name="upload" />
              備份到雲端
            </button>
          </div>
          {checked && cloud && !merged ? (
            <p className="field-help">
              先合併既有備份，避免用這個裝置的舊資料覆蓋雲端版本。
            </p>
          ) : null}
        </section>
        <section className="account-card">
          <h2>訪客資料</h2>
          <p>
            這個瀏覽器的訪客空間有 {guestCount.notes} 則筆記、
            {guestCount.attempts} 次作答與 {guestCount.drafts} 份程式草稿。
          </p>
          <p className="field-help">
            匯入後保留訪客原始資料。整頁筆記衝突會合併本文；程式草稿衝突保留會員版本，訪客版本仍可匯出。
          </p>
          <label className="guest-consent">
            <input
              type="checkbox"
              checked={allowGuestImport}
              disabled={busy}
              onChange={(event) => setAllowGuestImport(event.target.checked)}
            />
            我確認將這個瀏覽器的訪客資料加入 {member.email ?? "目前帳號"}。
          </label>
          <div className="account-actions">
            <button
              className="button secondary"
              type="button"
              disabled={
                busy || !ready || !allowGuestImport || pendingWrites > 0
              }
              onClick={() =>
                void operate(async () => {
                  if (useWorkspace.getState().error)
                    throw new MemberOperationError(
                      "本機儲存有錯誤，請先匯出會員備份，再重新整理後匯入訪客資料。",
                    );
                  const result = await useWorkspace.getState().importGuest();
                  if (isCurrent()) {
                    setNotice(
                      `已處理 ${result.notes} 則訪客筆記；${result.draftConflicts} 份草稿與 ${result.attemptConflicts} 次作答衝突保留在訪客空間。尚未上傳雲端。`,
                    );
                    setAllowGuestImport(false);
                  }
                })
              }
            >
              匯入訪客資料
            </button>
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() =>
                void operate(async () => {
                  const backup = await getDatabase("guest").backup();
                  if (isCurrent())
                    downloadText(
                      "dev-map-lab-guest-backup.json",
                      JSON.stringify(backup, null, 2),
                      "application/json",
                    );
                })
              }
            >
              匯出訪客備份
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
