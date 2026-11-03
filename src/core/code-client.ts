import {
  type CodeRequest,
  type CodeResult,
  codeWorkerResponseSchema,
} from "./code-contract";

export function runCodeInWorker(
  request: CodeRequest,
  signal: AbortSignal,
): Promise<CodeResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("已停止執行"));
      return;
    }
    const worker = new Worker(
      new URL("../workers/code.worker.ts", import.meta.url),
      { type: "module" },
    );
    const hardLimit =
      request.question.tests.length * request.question.limits.timeMs + 10000;
    const timeout = window.setTimeout(
      () => finish(new Error("執行器逾時，已停止。請重新執行。")),
      hardLimit,
    );
    function finish(error: Error | null, result: CodeResult | null = null) {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      worker.terminate();
      if (error) reject(error);
      else if (result) resolve(result);
    }
    function abort() {
      finish(new Error("已停止執行"));
    }
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const parsed = codeWorkerResponseSchema.safeParse(event.data);
      if (!parsed.success) {
        finish(new Error("執行器回傳格式錯誤"));
        return;
      }
      if (parsed.data.ok) finish(null, parsed.data.result);
      else finish(new Error(parsed.data.error));
    };
    worker.onerror = () =>
      finish(new Error("程式執行器載入失敗，請重新整理後再試。"));
    worker.postMessage(request);
  });
}
