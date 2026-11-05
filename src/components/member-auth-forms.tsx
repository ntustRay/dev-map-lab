"use client";

import { type FormEvent, useState } from "react";
import { ZodError } from "zod";
import {
  requestPasswordReset,
  resendVerification,
  resetPasswordWithCode,
  signInEmail,
  signInSocial,
  signUpEmail,
  verifyEmailCode,
} from "../auth/actions";
import { getAuthConfiguration } from "../auth/config";
import { authErrorMessage, MemberOperationError } from "../auth/errors";

type Mode = "signin" | "signup" | "verify" | "forgot" | "reset";
const titles: Record<Mode, string> = {
  signin: "登入會員",
  signup: "建立會員",
  verify: "驗證信箱",
  forgot: "寄送重設驗證碼",
  reset: "設定新密碼",
};
function message(error: unknown) {
  return error instanceof ZodError
    ? (error.issues[0]?.message ?? "請檢查輸入內容。")
    : authErrorMessage(error);
}

export function AuthForms() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const config = getAuthConfiguration();
  function changeMode(next: Mode) {
    setMode(next);
    setPassword("");
    setConfirmation("");
    setCode("");
    setError(null);
    setNotice(null);
  }
  async function operate(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await operate(async () => {
      if (mode === "signin") await signInEmail(email, password);
      else if (mode === "signup") {
        if (password !== confirmation)
          throw new MemberOperationError("兩次密碼不一致。");
        const signedIn = await signUpEmail(email, password, displayName);
        if (!signedIn) {
          changeMode("verify");
          setNotice(
            "請查看信箱，輸入 6 位數驗證碼。沒有收到時可按「重寄驗證碼」。",
          );
        }
      } else if (mode === "verify") {
        const signedIn = await verifyEmailCode(email, code);
        if (!signedIn) {
          changeMode("signin");
          setNotice("信箱已驗證，請使用密碼登入。");
        }
      } else if (mode === "forgot") {
        await requestPasswordReset(email);
        changeMode("reset");
        setNotice(
          "如果這個信箱已註冊，會收到密碼重設驗證碼。請輸入驗證碼與新密碼。",
        );
      } else {
        if (password !== confirmation)
          throw new MemberOperationError("兩次密碼不一致。");
        await resetPasswordWithCode(email, code, password);
        changeMode("signin");
        setNotice("密碼已更新，請使用新密碼登入。");
      }
    });
  }
  const hasPassword =
    mode === "signin" || mode === "signup" || mode === "reset";
  const newPassword = mode === "signup" || mode === "reset";
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
      <h2>{titles[mode]}</h2>
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        <label>
          Email
          <input
            className="text-input"
            type="email"
            autoComplete="username"
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
        {mode === "verify" || mode === "reset" ? (
          <label>
            6 位數驗證碼
            <input
              className="text-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              maxLength={6}
              value={code}
              disabled={busy}
              onChange={(event) => setCode(event.target.value)}
            />
            <span className="field-help">輸入寄到信箱的驗證碼。</span>
          </label>
        ) : null}
        {hasPassword ? (
          <label>
            {mode === "reset" ? "新密碼" : "密碼"}
            <input
              className="text-input"
              type="password"
              required
              autoComplete={newPassword ? "new-password" : "current-password"}
              value={password}
              disabled={busy}
              maxLength={newPassword ? 72 : 1000}
              minLength={newPassword ? 12 : 1}
              onChange={(event) => setPassword(event.target.value)}
            />
            {newPassword ? (
              <span className="field-help">至少 12 個字元。</span>
            ) : null}
          </label>
        ) : null}
        {newPassword ? (
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
          {busy ? "處理中…" : titles[mode]}
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
          onClick={() => changeMode("verify")}
        >
          輸入信箱驗證碼
        </button>
        {mode === "verify" || mode === "reset" ? (
          <button
            className="text-button"
            type="button"
            disabled={busy || !email.trim()}
            onClick={() =>
              void operate(async () => {
                if (mode === "reset") await requestPasswordReset(email);
                else await resendVerification(email);
                setNotice(
                  "如果這個信箱符合條件，將會收到新的驗證碼，請稍後檢查信箱。",
                );
              })
            }
          >
            重寄驗證碼
          </button>
        ) : null}
      </div>
      {config.status === "ready" && config.value.providers.length > 0 ? (
        <div className="social-signin">
          <p>或使用其他帳號</p>
          {config.value.providers.map((provider) => (
            <button
              className="button secondary"
              key={provider}
              type="button"
              disabled={busy}
              onClick={() => void operate(() => signInSocial(provider))}
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
