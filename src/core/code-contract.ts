import { z } from "zod";
import {
  codeQuestionSchema,
  jsonValueSchema,
  languageSchema,
} from "./content-schema";
import { gradeResultSchema } from "./grade";
import { MAX_CODE_LENGTH } from "./limits";

export const codeRequestSchema = z.object({
  question: codeQuestionSchema,
  language: languageSchema,
  source: z.string().min(1).max(MAX_CODE_LENGTH),
});
export type CodeRequest = z.infer<typeof codeRequestSchema>;
export const testResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["passed", "failed", "timeout", "error"]),
  args: z.array(jsonValueSchema),
  expected: jsonValueSchema,
  actual: jsonValueSchema.nullable(),
  message: z.string(),
  logs: z.array(z.string()),
  durationMs: z.number().min(0),
});
export const codeResultSchema = z.object({
  grade: gradeResultSchema,
  tests: z.array(testResultSchema),
});
export type TestResult = z.infer<typeof testResultSchema>;
export type CodeResult = z.infer<typeof codeResultSchema>;
export const codeWorkerResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: codeResultSchema }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
