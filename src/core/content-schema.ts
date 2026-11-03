import { z } from "zod";

export const jsonValueSchema = z.json();
export type JsonValue = z.infer<typeof jsonValueSchema>;
export const languageSchema = z.enum(["javascript", "typescript"]);
export type Language = z.infer<typeof languageSchema>;
const id = z.string().regex(/^[a-z][a-z0-9-]*$/);

const base = {
  id,
  version: z.number().int().positive(),
  title: z.string().min(1),
  prompt: z.string().min(1),
  points: z.number().int().positive().max(100),
  explanation: z.string().min(1),
};

export const choiceQuestionSchema = z.object({
  ...base,
  type: z.literal("choice"),
  multiple: z.boolean(),
  options: z.array(z.object({ id, text: z.string().min(1) })).min(2),
  correctIds: z.array(id).min(1),
});

export const fillQuestionSchema = z.object({
  ...base,
  type: z.literal("fill"),
  answers: z.array(z.string().min(1)).min(1),
  normalization: z.object({
    trim: z.boolean(),
    caseSensitive: z.boolean(),
    collapseWhitespace: z.boolean(),
  }),
});

export const shortQuestionSchema = z.object({
  ...base,
  type: z.literal("short"),
  referenceAnswer: z.string().min(1),
  criteria: z
    .array(
      z.object({
        id,
        label: z.string().min(1),
        points: z.number().int().positive(),
        acceptedPhrases: z.array(z.string().min(1)),
        keywordGroups: z.array(z.array(z.string().min(1)).min(1)),
        misconceptions: z.array(z.string().min(1)),
        semanticThreshold: z.number().min(0).max(1).nullable(),
      }),
    )
    .min(1),
});

export const comparatorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("deepEqual") }),
  z.object({ kind: z.literal("unorderedArray") }),
  z.object({
    kind: z.literal("numericTolerance"),
    tolerance: z.number().positive(),
  }),
]);

export const codeQuestionSchema = z.object({
  ...base,
  type: z.literal("code"),
  entrypoint: z.literal("solve"),
  preserveInput: z.boolean().default(true),
  starters: z.object({
    javascript: z.string().min(1),
    typescript: z.string().min(1),
  }),
  solutions: z.object({
    javascript: z.string().min(1),
    typescript: z.string().min(1),
  }),
  comparison: comparatorSchema,
  limits: z.object({
    timeMs: z.number().int().min(10).max(2000),
    memoryMb: z.number().int().min(8).max(64),
  }),
  tests: z
    .array(
      z.object({
        id,
        label: z.string().min(1),
        args: z.array(jsonValueSchema),
        expected: jsonValueSchema,
      }),
    )
    .min(3)
    .max(30),
});

export const questionSchema = z.discriminatedUnion("type", [
  choiceQuestionSchema,
  fillQuestionSchema,
  shortQuestionSchema,
  codeQuestionSchema,
]);
export const questionFileSchema = z.object({
  schemaVersion: z.literal(1),
  lessonId: id,
  questions: z.array(questionSchema).min(1),
});
export type Question = z.infer<typeof questionSchema>;
export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;
export type FillQuestion = z.infer<typeof fillQuestionSchema>;
export type ShortQuestion = z.infer<typeof shortQuestionSchema>;
export type CodeQuestion = z.infer<typeof codeQuestionSchema>;
export type Comparator = z.infer<typeof comparatorSchema>;

export const lessonMetaSchema = z.object({
  id,
  version: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  minutes: z.number().int().positive(),
  tags: z.array(z.string().min(1)).min(1),
  prerequisites: z.array(id),
});
export type LessonMeta = z.infer<typeof lessonMetaSchema>;
export type LessonBlock = { id: string; markdown: string; html: string };
export type Lesson = LessonMeta & {
  blocks: LessonBlock[];
  questions: Question[];
};
export type LessonSummary = LessonMeta & { questionCount: number };

export const catalogSchema = z.object({
  schemaVersion: z.literal(1),
  tracks: z
    .array(
      z.object({
        id,
        title: z.string().min(1),
        description: z.string().min(1),
        lessonIds: z.array(id).min(1),
      }),
    )
    .min(1),
});
export type Catalog = z.infer<typeof catalogSchema>;

export function validateQuestions(questions: Question[]): void {
  for (const question of questions) {
    if (question.type === "choice") {
      const ids = question.options.map((option) => option.id);
      if (
        new Set(ids).size !== ids.length ||
        new Set(question.correctIds).size !== question.correctIds.length
      ) {
        throw new Error(`${question.id}: 選項 ID 或正確答案重複`);
      }
      if (question.correctIds.some((correct) => !ids.includes(correct))) {
        throw new Error(`${question.id}: 正確答案不存在於選項`);
      }
      if (!question.multiple && question.correctIds.length !== 1) {
        throw new Error(`${question.id}: 單選題只能有一個答案`);
      }
    }
    if (question.type === "short") {
      if (
        question.criteria.reduce(
          (sum, criterion) => sum + criterion.points,
          0,
        ) !== question.points
      ) {
        throw new Error(`${question.id}: 得分點總分與題目分數不一致`);
      }
      const ids = question.criteria.map((criterion) => criterion.id);
      if (new Set(ids).size !== ids.length)
        throw new Error(`${question.id}: 得分點 ID 重複`);
      if (
        question.criteria.some(
          (criterion) =>
            criterion.acceptedPhrases.length === 0 &&
            criterion.keywordGroups.length === 0,
        )
      ) {
        throw new Error(`${question.id}: 每個得分點需要比對規則`);
      }
    }
    if (question.type === "code") {
      const ids = question.tests.map((test) => test.id);
      if (new Set(ids).size !== ids.length)
        throw new Error(`${question.id}: 測資 ID 重複`);
    }
  }
}
