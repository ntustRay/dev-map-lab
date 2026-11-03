import type { QuickJSWASMModule } from "quickjs-emscripten-core";
import { transform } from "sucrase";
import {
  type CodeRequest,
  type CodeResult,
  codeRequestSchema,
  type TestResult,
} from "./code-contract";
import { compareOutput } from "./compare";
import { jsonValueSchema } from "./content-schema";

function describe(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  )
    return value.message;
  return typeof value === "string"
    ? value
    : (JSON.stringify(value) ?? "執行失敗");
}

export async function runCode(
  input: CodeRequest,
  engine: Promise<QuickJSWASMModule>,
): Promise<CodeResult> {
  const request = codeRequestSchema.parse(input);
  const { question } = request;
  let source: string;
  try {
    source =
      request.language === "typescript"
        ? transform(request.source, {
            transforms: ["typescript"],
            disableESTransforms: true,
          }).code
        : request.source;
  } catch (error) {
    return makeResult(
      request,
      question.tests.map((test) => ({
        ...test,
        status: "error",
        actual: null,
        message: `TypeScript 轉譯失敗：${describe(error)}`,
        logs: [],
        durationMs: 0,
      })),
    );
  }
  const QuickJS = await engine;
  const results: TestResult[] = [];
  for (const test of question.tests) {
    const start = performance.now();
    const context = QuickJS.newContext();
    let timedOut = false;
    const logs: string[] = [];
    context.runtime.setMemoryLimit(question.limits.memoryMb * 1024 * 1024);
    context.runtime.setMaxStackSize(512 * 1024);
    context.runtime.setInterruptHandler(() => {
      timedOut = performance.now() - start > question.limits.timeMs;
      return timedOut;
    });
    try {
      // Only console is bridged. The guest receives no DOM, fetch, storage, or host objects.
      const consoleHandle = context.newObject();
      const log = context.newFunction("log", (...args) => {
        if (logs.length < 20)
          logs.push(
            args
              .map((arg) => describe(context.dump(arg)))
              .join(" ")
              .slice(0, 1000),
          );
      });
      context.setProp(consoleHandle, "log", log);
      context.setProp(consoleHandle, "error", log);
      context.setProp(context.global, "console", consoleHandle);
      log.dispose();
      consoleHandle.dispose();
      const program = `(() => { "use strict";\n${source}\n;const __devMapArgs = ${JSON.stringify(test.args)}; const __devMapBefore = JSON.stringify(__devMapArgs); const __devMapResult = solve(...__devMapArgs); if (__devMapResult && typeof __devMapResult.then === "function") throw new Error("本版題目請使用同步函式"); ${question.preserveInput ? 'if (JSON.stringify(__devMapArgs) !== __devMapBefore) throw new Error("題目要求保留原始輸入，請避免修改傳入的陣列或物件");' : ""} return JSON.stringify(__devMapResult); })()`;
      const result = context.evalCode(program);
      if (result.error) {
        const message = describe(context.dump(result.error));
        result.error.dispose();
        results.push({
          ...test,
          status: timedOut ? "timeout" : "error",
          actual: null,
          message: timedOut ? `超過 ${question.limits.timeMs} ms` : message,
          logs,
          durationMs: performance.now() - start,
        });
        continue;
      }
      const dumped: unknown = context.dump(result.value);
      result.value.dispose();
      if (typeof dumped !== "string" || dumped.length > 100000)
        throw new Error("請回傳可序列化的 JSON 值，輸出最多 100,000 字元。");
      const actual = jsonValueSchema.parse(JSON.parse(dumped));
      const passed = compareOutput(actual, test.expected, question.comparison);
      results.push({
        ...test,
        status: passed ? "passed" : "failed",
        actual,
        message: passed ? "輸出符合" : "輸出與預期不同",
        logs,
        durationMs: performance.now() - start,
      });
    } catch (error) {
      results.push({
        ...test,
        status: timedOut ? "timeout" : "error",
        actual: null,
        message: describe(error),
        logs,
        durationMs: performance.now() - start,
      });
    } finally {
      context.dispose();
    }
  }
  return makeResult(request, results);
}

function makeResult(request: CodeRequest, tests: TestResult[]): CodeResult {
  const passed = tests.filter((test) => test.status === "passed").length;
  const score =
    Math.round((passed / tests.length) * request.question.points * 100) / 100;
  return {
    tests,
    grade: {
      score,
      maxScore: request.question.points,
      passed: passed === tests.length,
      method: "tests",
      needsReview: false,
      feedback: [
        {
          label: `${passed} / ${tests.length} 筆測資通過`,
          earned: score,
          possible: request.question.points,
          detail: "分數按通過測資比例計算。測試只檢查輸出，不判定時間複雜度。",
        },
      ],
    },
  };
}
