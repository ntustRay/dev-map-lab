import { z } from "zod";
import type {
  ChoiceQuestion,
  FillQuestion,
  ShortQuestion,
} from "./content-schema";

export const gradeResultSchema = z.object({
  score: z.number().min(0),
  maxScore: z.number().positive(),
  passed: z.boolean(),
  method: z.enum(["exact", "rubric", "semantic-rubric", "tests"]),
  feedback: z.array(
    z.object({
      label: z.string(),
      earned: z.number().min(0),
      possible: z.number().min(0),
      detail: z.string(),
    }),
  ),
  needsReview: z.boolean(),
});
export type GradeResult = z.infer<typeof gradeResultSchema>;

export function gradeChoice(
  question: ChoiceQuestion,
  selected: string[],
): GradeResult {
  const unique = new Set(selected);
  const passed =
    unique.size === question.correctIds.length &&
    question.correctIds.every((answer) => unique.has(answer));
  return {
    score: passed ? question.points : 0,
    maxScore: question.points,
    passed,
    method: "exact",
    needsReview: false,
    feedback: [
      {
        label: passed ? "答案正確" : "再核對一次選項",
        earned: passed ? question.points : 0,
        possible: question.points,
        detail: question.explanation,
      },
    ],
  };
}

function normalizeFill(
  value: string,
  rule: FillQuestion["normalization"],
): string {
  let result = value.normalize("NFKC");
  if (rule.trim) result = result.trim();
  if (rule.collapseWhitespace) result = result.replace(/\s+/g, " ");
  if (!rule.caseSensitive) result = result.toLocaleLowerCase("en-US");
  return result;
}

export function gradeFill(question: FillQuestion, answer: string): GradeResult {
  const value = normalizeFill(answer, question.normalization);
  const passed =
    value.length > 0 &&
    question.answers.some(
      (accepted) => normalizeFill(accepted, question.normalization) === value,
    );
  return {
    score: passed ? question.points : 0,
    maxScore: question.points,
    passed,
    method: "exact",
    needsReview: false,
    feedback: [
      {
        label: passed ? "答案正確" : "答案尚未符合",
        earned: passed ? question.points : 0,
        possible: question.points,
        detail: question.explanation,
      },
    ],
  };
}

export interface SemanticEvaluator {
  readonly version: string;
  similarity(answer: string, reference: string): Promise<number>;
}

function normalizeRubric(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function gradeShort(
  question: ShortQuestion,
  answer: string,
  semantic: SemanticEvaluator | null = null,
): Promise<GradeResult> {
  const value = normalizeRubric(answer);
  let needsReview = true; // Reference feedback, never an authoritative correctness claim.
  const feedback: GradeResult["feedback"] = [];
  for (const criterion of question.criteria) {
    const contradiction = criterion.misconceptions.some((phrase) =>
      value.includes(normalizeRubric(phrase)),
    );
    const phraseMatch = criterion.acceptedPhrases.some((phrase) =>
      value.includes(normalizeRubric(phrase)),
    );
    const groupsMatch =
      criterion.keywordGroups.length > 0 &&
      criterion.keywordGroups.every((group) =>
        group.some((word) => value.includes(normalizeRubric(word))),
      );
    let matched =
      value.length > 0 && !contradiction && (phraseMatch || groupsMatch);
    let detail = contradiction
      ? "含有題庫標記的錯誤敘述，請核對解析。"
      : matched
        ? "符合此得分點的文字規準。"
        : "尚未比對到此得分點；換句話說仍可能正確，請核對參考答案。";
    if (
      !matched &&
      !contradiction &&
      value.length > 0 &&
      semantic &&
      criterion.semanticThreshold !== null
    ) {
      try {
        const scores = await Promise.all(
          criterion.acceptedPhrases.map((reference) =>
            semantic.similarity(answer, reference),
          ),
        );
        const valid = scores.filter(
          (score) => Number.isFinite(score) && score >= -1 && score <= 1,
        );
        if (
          valid.length > 0 &&
          Math.max(...valid) >= criterion.semanticThreshold
        ) {
          matched = true;
          detail = "通過本題校準門檻；語意相近仍需核對技術正確性。";
        }
      } catch {
        needsReview = true;
        detail = "語意評分無法完成，本得分點依文字規準保留，請自行核對。";
      }
    }
    feedback.push({
      label: criterion.label,
      earned: matched ? criterion.points : 0,
      possible: criterion.points,
      detail,
    });
  }
  const score = feedback.reduce((sum, item) => sum + item.earned, 0);
  return {
    score,
    maxScore: question.points,
    passed: score === question.points,
    feedback,
    method: semantic ? "semantic-rubric" : "rubric",
    needsReview,
  };
}
