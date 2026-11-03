import { codeRequestSchema } from "../core/code-contract";
import { runCode } from "../core/code-runner";

const engine = newQuickJSWASMModuleFromVariant(variant);

self.onmessage = async (event: MessageEvent<unknown>) => {
  try {
    const result = await runCode(codeRequestSchema.parse(event.data), engine);
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "執行器無法啟動",
    });
  }
};

import variant from "@jitl/quickjs-singlefile-browser-release-sync";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
