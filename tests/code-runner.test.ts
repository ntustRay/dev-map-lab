import variant from "@jitl/quickjs-singlefile-cjs-release-sync";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import { describe, expect, it } from "vitest";
import { loadContent } from "../src/content/load";
import type { CodeRequest } from "../src/core/code-contract";
import { runCode } from "../src/core/code-runner";
import { compareOutput } from "../src/core/compare";
import type { CodeQuestion, Language } from "../src/core/content-schema";

const engine = newQuickJSWASMModuleFromVariant(variant);
function execute(input: CodeRequest) {
  return runCode(input, engine);
}

const content = await loadContent();
const questions = content.lessons.flatMap((lesson) =>
  lesson.questions.filter((question) => question.type === "code"),
);
const languages: Language[] = ["javascript", "typescript"];

describe("真實 QuickJS 執行與測資", () => {
  for (const question of questions) {
    for (const language of languages) {
      it(`${question.id}：${language} 參考解法通過所有測資`, async () => {
        const result = await execute({
          question,
          language,
          source: question.solutions[language],
        });
        expect(result.grade.passed, JSON.stringify(result.tests)).toBe(true);
        expect(result.tests).toHaveLength(question.tests.length);
      });
    }
  }

  function fixture(): CodeQuestion {
    const question = questions[0];
    if (!question) throw new Error("缺少題目");
    return {
      ...question,
      limits: { timeMs: 30, memoryMb: 8 },
      tests: ["a", "b", "c"].map((id) => ({
        id,
        label: id,
        args: [],
        expected: 1,
      })),
    };
  }
  it("死迴圈會中斷，後續仍可正常執行", async () => {
    const question = fixture();
    const timeout = await execute({
      question,
      language: "javascript",
      source: "function solve() { while (true) {} }",
    });
    expect(timeout.tests.every((test) => test.status === "timeout")).toBe(true);
    expect(
      (
        await execute({
          question,
          language: "javascript",
          source: "function solve() { return 1; }",
        })
      ).grade.passed,
    ).toBe(true);
  });
  it("部分通過即使總分很小，也不應顯示滿分", async () => {
    const question = {
      ...fixture(),
      points: 1,
      tests: fixture().tests.map((test, index) => ({
        ...test,
        expected: index === 2 ? 2 : 1,
      })),
    };
    const result = await execute({
      question,
      language: "javascript",
      source: "function solve() { return 1; }",
    });
    expect(result.grade.passed).toBe(false);
    expect(result.grade.score).toBeGreaterThan(0);
    expect(result.grade.score).toBeLessThan(result.grade.maxScore);
  });
  it("語法錯誤和 TS 轉譯錯誤有結構化結果", async () => {
    const question = fixture();
    const js = await execute({
      question,
      language: "javascript",
      source: "function solve( {",
    });
    const ts = await execute({
      question,
      language: "typescript",
      source: "function solve(x: ) {",
    });
    expect(js.tests.every((test) => test.status === "error")).toBe(true);
    expect(ts.tests.every((test) => test.message.includes("轉譯失敗"))).toBe(
      true,
    );
  });
  it("guest 無法直接取得 DOM、fetch、process、localStorage", async () => {
    const question = {
      ...fixture(),
      tests: fixture().tests.map((test) => ({
        ...test,
        expected: ["undefined", "undefined", "undefined", "undefined"],
      })),
    };
    const result = await execute({
      question,
      language: "javascript",
      source:
        "function solve() { return [typeof document, typeof fetch, typeof process, typeof localStorage]; }",
    });
    expect(result.grade.passed).toBe(true);
  });
  it("每筆測資有獨立的執行狀態", async () => {
    const result = await execute({
      question: fixture(),
      language: "javascript",
      source: "let count = 0; function solve() { return ++count; }",
    });
    expect(result.grade.passed).toBe(true);
  });
  it("大量配置記憶體會失敗，不會摧毀下一次執行", async () => {
    const result = await execute({
      question: fixture(),
      language: "javascript",
      source: "function solve() { return new Array(10000000).fill(1); }",
    });
    expect(result.grade.passed).toBe(false);
    expect(
      result.tests.every(
        (test) => test.status === "error" || test.status === "timeout",
      ),
    ).toBe(true);
  });
  it("保留輸入的契約會被執行器檢查", async () => {
    const question = {
      ...fixture(),
      tests: fixture().tests.map((test) => ({ ...test, args: [[1, 2]] })),
    };
    const result = await execute({
      question,
      language: "javascript",
      source: "function solve(values) { values.push(3); return 1; }",
    });
    expect(
      result.tests.every((test) => test.message.includes("保留原始輸入")),
    ).toBe(true);
  });
  it("不接受未定義輸出或沒有等待的 Promise", async () => {
    const question = fixture();
    expect(
      (
        await execute({
          question,
          language: "javascript",
          source: "function solve() {}",
        })
      ).grade.score,
    ).toBe(0);
    const result = await execute({
      question,
      language: "javascript",
      source: "async function solve() { return 1; }",
    });
    expect(
      result.tests.every((test) => test.message.includes("同步函式")),
    ).toBe(true);
  });
});

describe("輸出 comparator", () => {
  it("物件欄位順序不影響，陣列順序會影響", () => {
    expect(
      compareOutput({ a: 1, b: 2 }, { b: 2, a: 1 }, { kind: "deepEqual" }),
    ).toBe(true);
    expect(compareOutput([1, 2], [2, 1], { kind: "deepEqual" })).toBe(false);
  });
  it("無序陣列仍保留重複元素數量", () => {
    expect(
      compareOutput([1, 2, 1], [2, 1, 1], { kind: "unorderedArray" }),
    ).toBe(true);
    expect(
      compareOutput([1, 2, 2], [2, 1, 1], { kind: "unorderedArray" }),
    ).toBe(false);
  });
  it("數字誤差必須依設定比對", () => {
    expect(
      compareOutput(0.1 + 0.2, 0.3, {
        kind: "numericTolerance",
        tolerance: 0.00001,
      }),
    ).toBe(true);
    expect(
      compareOutput(0.31, 0.3, {
        kind: "numericTolerance",
        tolerance: 0.00001,
      }),
    ).toBe(false);
  });
});
