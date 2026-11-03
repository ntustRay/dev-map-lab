"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { CodeResult } from "../core/code-contract";
import type { CodeQuestion, Language, Question } from "../core/content-schema";
import {
  type GradeResult,
  gradeChoice,
  gradeFill,
  gradeShort,
} from "../core/grade";
import { useWorkspace } from "../storage/workspace";
import { Icon } from "./icons";

const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => <div className="editor-loading">載入程式碼編輯器…</div>,
});
const labels: Record<Question["type"], string> = {
  choice: "選擇題",
  fill: "填充題",
  short: "簡答題",
  code: "實作題",
};

export function Exercises({
  lessonId,
  questions,
}: {
  lessonId: string;
  questions: Question[];
}) {
  const [activeId, setActiveId] = useState(questions[0]?.id ?? "");
  const ready = useWorkspace((state) => state.ready);
  const attempts = useWorkspace((state) => state.attempts);
  const active =
    questions.find((question) => question.id === activeId) ?? questions[0];
  if (!active) return <p>這個單元尚未加入練習。</p>;
  return (
    <div className="exercises">
      <fieldset className="question-tabs">
        <legend className="sr-only">選擇練習題</legend>
        {questions.map((question, index) => {
          const passed =
            ready &&
            attempts.some(
              (attempt) =>
                attempt.questionId === question.id &&
                attempt.questionVersion === question.version &&
                attempt.grade.passed,
            );
          return (
            <button
              key={question.id}
              type="button"
              className={active.id === question.id ? "selected" : ""}
              aria-pressed={active.id === question.id}
              onClick={() => setActiveId(question.id)}
            >
              <span>{index + 1}</span>
              {labels[question.type]}
              {passed ? <Icon name="check" size={14} /> : null}
            </button>
          );
        })}
      </fieldset>
      {ready ? (
        <QuestionPanel key={active.id} question={active} lessonId={lessonId} />
      ) : (
        <p className="loading-text">載入作答紀錄…</p>
      )}
    </div>
  );
}

function QuestionPanel({
  question,
  lessonId,
}: {
  question: Question;
  lessonId: string;
}) {
  const attempts = useWorkspace((state) => state.attempts);
  const recordAttempt = useWorkspace((state) => state.recordAttempt);
  const previous = attempts
    .filter(
      (attempt) =>
        attempt.questionId === question.id &&
        attempt.questionVersion === question.version,
    )
    .at(-1);
  const [answer, setAnswer] = useState(previous?.answer ?? "");
  const [selected, setSelected] = useState<string[]>(() => {
    if (question.type !== "choice" || !previous) return [];
    try {
      const parsed = z.array(z.string()).safeParse(JSON.parse(previous.answer));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  });
  const [grade, setGrade] = useState<GradeResult | null>(
    previous?.grade ?? null,
  );
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      let result: GradeResult;
      if (question.type === "choice") result = gradeChoice(question, selected);
      else if (question.type === "fill") result = gradeFill(question, answer);
      else if (question.type === "short")
        result = await gradeShort(question, answer);
      else return;
      setGrade(result);
      await recordAttempt(
        lessonId,
        question,
        question.type === "choice" ? JSON.stringify(selected) : answer,
        result,
      );
    } finally {
      setBusy(false);
    }
  }
  function updateAnswer(value: string) {
    setAnswer(value);
    setGrade(null);
  }
  return (
    <section className="question-panel">
      <div className="question-heading">
        <span className="type-label">
          {labels[question.type]}
          {question.type === "choice" && question.multiple ? "・多選" : ""}
        </span>
        <span>{question.points} 分</span>
      </div>
      <h2>{question.title}</h2>
      <p className="question-prompt">{question.prompt}</p>
      {question.type === "choice" ? (
        <fieldset className="choice-options">
          <legend className="sr-only">{question.prompt}</legend>
          {question.options.map((option, index) => (
            <label
              className={`choice-option ${selected.includes(option.id) ? "chosen" : ""}`}
              key={option.id}
            >
              <input
                type={question.multiple ? "checkbox" : "radio"}
                name={question.id}
                value={option.id}
                checked={selected.includes(option.id)}
                onChange={() => {
                  setGrade(null);
                  setSelected((current) =>
                    question.multiple
                      ? current.includes(option.id)
                        ? current.filter((id) => id !== option.id)
                        : [...current, option.id]
                      : [option.id],
                  );
                }}
              />
              <span className="choice-letter">
                {String.fromCharCode(65 + index)}
              </span>
              <span>{option.text}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {question.type === "fill" ? (
        <label className="answer-label">
          你的答案
          <input
            className="text-input"
            value={answer}
            onChange={(event) => updateAnswer(event.target.value)}
            maxLength={1000}
            autoComplete="off"
            placeholder="輸入關鍵詞或答案"
          />
        </label>
      ) : null}
      {question.type === "short" ? (
        <>
          <label className="answer-label">
            你的理解
            <textarea
              className="answer-textarea"
              value={answer}
              onChange={(event) => updateAnswer(event.target.value)}
              maxLength={5000}
              placeholder="先寫出原因，再補上例子或限制。"
              rows={7}
            />
          </label>
          <p className="field-help">
            目前依題庫的文字規準提供參考分數。換句話說可能未被識別，請一起核對解析；尚未使用語意模型。
          </p>
        </>
      ) : null}
      {question.type === "code" ? (
        <CodeExercise
          key={question.id}
          question={question}
          lessonId={lessonId}
        />
      ) : (
        <>
          <div className="question-actions">
            <button
              className="button primary"
              type="button"
              disabled={
                busy ||
                (question.type === "choice"
                  ? selected.length === 0
                  : answer.trim().length === 0)
              }
              onClick={() => void submit()}
            >
              {busy ? "評分中…" : "檢查答案"}
              <Icon name="check" />
            </button>
          </div>
          {grade ? <GradeFeedback grade={grade} /> : null}
        </>
      )}
      {question.type !== "code" && grade ? (
        <details className="reference-answer">
          <summary>
            查看解析{question.type === "short" ? "與參考答案" : ""}
          </summary>
          <p>{question.explanation}</p>
        </details>
      ) : null}
    </section>
  );
}

function CodeExercise({
  question,
  lessonId,
}: {
  question: CodeQuestion;
  lessonId: string;
}) {
  const [language, setLanguage] = useState<Language>("javascript");
  const drafts = useWorkspace((state) => state.drafts);
  const saveDraft = useWorkspace((state) => state.saveDraft);
  const recordAttempt = useWorkspace((state) => state.recordAttempt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CodeResult | null>(null);
  const controller = useRef<AbortController | null>(null);
  const source =
    drafts.find(
      (draft) => draft.id === `${question.id}:${question.version}:${language}`,
    )?.source ?? question.starters[language];
  useEffect(() => () => controller.current?.abort(), []);
  function changeSource(value: string) {
    setResult(null);
    setError(null);
    void saveDraft(question, language, value);
  }
  async function run() {
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const { runCodeInWorker } = await import("../core/code-client");
      const output = await runCodeInWorker(
        { question, language, source },
        abort.signal,
      );
      if (abort.signal.aborted) return;
      setResult(output);
      await recordAttempt(lessonId, question, source, output.grade);
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(cause instanceof Error ? cause.message : "執行失敗，請重試。");
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div className="code-exercise">
      <div className="editor-toolbar">
        <fieldset className="segmented-control">
          <legend className="sr-only">程式語言</legend>
          <button
            type="button"
            disabled={busy}
            aria-pressed={language === "javascript"}
            className={language === "javascript" ? "selected" : ""}
            onClick={() => {
              setLanguage("javascript");
              setResult(null);
            }}
          >
            JavaScript
          </button>
          <button
            type="button"
            disabled={busy}
            aria-pressed={language === "typescript"}
            className={language === "typescript" ? "selected" : ""}
            onClick={() => {
              setLanguage("typescript");
              setResult(null);
            }}
          >
            TypeScript
          </button>
        </fieldset>
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("恢復起始程式碼？目前這個語言的草稿會被取代。"))
              changeSource(question.starters[language]);
          }}
        >
          恢復起始碼
        </button>
      </div>
      <CodeEditor
        key={language}
        value={source}
        language={language}
        onChange={changeSource}
        readOnly={busy}
      />
      <div className="runner-hint">
        <span>
          同步函式 · 每筆 {question.limits.timeMs} ms ·{" "}
          {question.limits.memoryMb} MB
        </span>
        <span>TS 僅轉譯，程式碼最多 50,000 字元</span>
      </div>
      <div className="question-actions">
        {busy ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              controller.current?.abort();
              setError("已停止執行，可以修改後重試。");
            }}
          >
            <Icon name="stop" />
            停止執行
          </button>
        ) : (
          <button
            className="button primary"
            type="button"
            disabled={!source.trim()}
            onClick={() => void run()}
          >
            <Icon name="play" />
            執行全部測資
          </button>
        )}
        <span className="field-help">
          {busy
            ? "正在隔離環境執行…"
            : `${question.tests.length} 筆測資，包含邊界條件`}
        </span>
      </div>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {result ? <GradeFeedback grade={result.grade} /> : null}
      <div className="test-results">
        <h3>{result ? "執行結果" : "測資"}</h3>
        {question.tests.map((test) => {
          const outcome = result?.tests.find((item) => item.id === test.id);
          return (
            <details
              key={test.id}
              className={`test-case ${outcome?.status ?? ""}`}
            >
              <summary>
                <span className="test-status">
                  {outcome?.status === "passed" ? (
                    <Icon name="check" size={15} />
                  ) : outcome ? (
                    <Icon name="close" size={15} />
                  ) : (
                    <span className="test-dot" />
                  )}
                </span>
                <span>{test.label}</span>
                <span className="test-case-status">
                  {outcome
                    ? outcome.status === "passed"
                      ? "通過"
                      : outcome.status === "timeout"
                        ? "逾時"
                        : outcome.status === "failed"
                          ? "輸出不同"
                          : "執行錯誤"
                    : "待執行"}
                </span>
              </summary>
              <dl>
                <dt>輸入參數</dt>
                <dd>
                  <code>{JSON.stringify(test.args)}</code>
                </dd>
                <dt>預期輸出</dt>
                <dd>
                  <code>{JSON.stringify(test.expected)}</code>
                </dd>
                {outcome ? (
                  <>
                    <dt>實際結果</dt>
                    <dd>
                      <code>
                        {outcome.status === "error" ||
                        outcome.status === "timeout"
                          ? outcome.message
                          : JSON.stringify(outcome.actual)}
                      </code>
                    </dd>
                    {outcome.logs.length ? (
                      <>
                        <dt>Console</dt>
                        <dd>
                          <pre>{outcome.logs.join("\n")}</pre>
                        </dd>
                      </>
                    ) : null}
                  </>
                ) : null}
              </dl>
            </details>
          );
        })}
      </div>
      <details className="reference-answer">
        <summary>查看參考解法</summary>
        <p>測資只驗證輸出。這題的寫法與複雜度，仍值得自行檢查。</p>
        <pre>
          <code>{question.solutions[language]}</code>
        </pre>
      </details>
    </div>
  );
}

function GradeFeedback({ grade }: { grade: GradeResult }) {
  return (
    <div
      className={`grade-feedback ${grade.passed ? "grade-passed" : ""}`}
      role="status"
    >
      <div className="grade-score">
        <strong>
          {grade.score}
          <small> / {grade.maxScore}</small>
        </strong>
        <span>
          {grade.method === "rubric" || grade.method === "semantic-rubric"
            ? "規準參考分數"
            : grade.passed
              ? "這次全部通過"
              : "繼續驗證你的理解"}
        </span>
      </div>
      <ul>
        {grade.feedback.map((item) => (
          <li key={item.label}>
            <div>
              <strong>{item.label}</strong>
              <span>
                {item.earned} / {item.possible}
              </span>
            </div>
            <p>{item.detail}</p>
          </li>
        ))}
      </ul>
      {grade.needsReview ? (
        <p className="review-hint">
          請核對參考答案。這個分數用來回顧學習，不代表已證明論述正確。
        </p>
      ) : null}
    </div>
  );
}
