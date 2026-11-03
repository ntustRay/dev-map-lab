import { beforeAll, describe, expect, it } from "vitest";
import { loadContent } from "../src/content/load";
import type {
  ChoiceQuestion,
  FillQuestion,
  ShortQuestion,
} from "../src/core/content-schema";
import { gradeChoice, gradeFill, gradeShort } from "../src/core/grade";

let choice: ChoiceQuestion;
let fill: FillQuestion;
let short: ShortQuestion;
beforeAll(async () => {
  const { lessons } = await loadContent();
  const questions = lessons.flatMap((lesson) => lesson.questions);
  const c = questions.find(
    (question) => question.type === "choice" && question.multiple,
  );
  const f = questions.find(
    (question) =>
      question.type === "fill" && !question.normalization.caseSensitive,
  );
  const s = questions.find((question) => question.type === "short");
  if (c?.type !== "choice" || f?.type !== "fill" || s?.type !== "short")
    throw new Error("缺少測試題型");
  choice = c;
  fill = f;
  short = s;
});

describe("選擇與填充", () => {
  it("多選必須完全符合，少選與多選都不通過", () => {
    expect(gradeChoice(choice, choice.correctIds).passed).toBe(true);
    expect(gradeChoice(choice, choice.correctIds.slice(1)).passed).toBe(false);
    expect(gradeChoice(choice, [...choice.correctIds, "unknown"]).passed).toBe(
      false,
    );
  });
  it("空白答案不通過", () => {
    expect(gradeChoice(choice, []).score).toBe(0);
    expect(gradeFill(fill, "   ").score).toBe(0);
  });
  it("填充依題目設定處理大小寫、全形與空白", () => {
    const question = { ...fill, answers: ["shallow copy"] };
    expect(gradeFill(question, "  SHALLOW   COPY ").passed).toBe(true);
    expect(
      gradeFill(
        {
          ...question,
          normalization: { ...question.normalization, caseSensitive: true },
        },
        "SHALLOW COPY",
      ).passed,
    ).toBe(false);
    expect(gradeFill({ ...question, answers: ["403"] }, "４０３").passed).toBe(
      true,
    );
  });
});

describe("簡答規準", () => {
  it("全空、無關內容不給分", async () => {
    expect((await gradeShort(short, "")).score).toBe(0);
    expect((await gradeShort(short, "今天午餐吃什麼")).score).toBe(0);
  });
  it("依得分點給分，仍要求人工核對", async () => {
    const result = await gradeShort(short, short.referenceAnswer);
    expect(result.score).toBe(short.points);
    expect(result.needsReview).toBe(true);
    expect(result.method).toBe("rubric");
  });
  it("明確的錯誤敘述優先於命中關鍵詞", async () => {
    const first = short.criteria[0];
    if (!first) throw new Error("缺少規準");
    const question = {
      ...short,
      criteria: [
        {
          ...first,
          points: short.points,
          acceptedPhrases: ["快取在伺服器"],
          keywordGroups: [],
          misconceptions: ["快取不在伺服器"],
        },
      ],
    };
    const result = await gradeShort(question, "快取在伺服器。快取不在伺服器。");
    expect(result.score).toBe(0);
  });
  it("只有經校準的門檻可啟用語意比對，且不能把 cosine 直接乘 100", async () => {
    const first = short.criteria[0];
    if (!first) throw new Error("缺少規準");
    const question = {
      ...short,
      criteria: [
        {
          ...first,
          points: short.points,
          keywordGroups: [],
          acceptedPhrases: ["參考敘述"],
          semanticThreshold: 0.85,
        },
      ],
    };
    const high = await gradeShort(question, "另一種說法", {
      version: "test",
      similarity: async () => 0.9,
    });
    const low = await gradeShort(question, "另一種說法", {
      version: "test",
      similarity: async () => 0.8,
    });
    expect(high.score).toBe(short.points);
    expect(low.score).toBe(0);
    expect(high.needsReview).toBe(true);
  });
  it("門檻未校準或模型失敗時不假裝評分成功", async () => {
    const first = short.criteria[0];
    if (!first) throw new Error("缺少規準");
    const question = {
      ...short,
      criteria: [
        {
          ...first,
          points: short.points,
          keywordGroups: [],
          acceptedPhrases: ["參考敘述"],
          semanticThreshold: null,
        },
      ],
    };
    expect(
      (
        await gradeShort(question, "另一種說法", {
          version: "test",
          similarity: async () => 1,
        })
      ).score,
    ).toBe(0);
    const result = await gradeShort(
      {
        ...question,
        criteria: question.criteria.map((criterion) => ({
          ...criterion,
          semanticThreshold: 0.9,
        })),
      },
      "另一種說法",
      {
        version: "test",
        similarity: async () => {
          throw new Error("offline");
        },
      },
    );
    expect(result.score).toBe(0);
    expect(result.feedback[0]?.detail).toContain("無法完成");
  });
  it("所有教材的參考答案可命中自己的規準", async () => {
    const { lessons } = await loadContent();
    for (const question of lessons.flatMap((lesson) => lesson.questions)) {
      if (question.type === "short")
        expect(
          (await gradeShort(question, question.referenceAnswer)).score,
          question.id,
        ).toBe(question.points);
    }
  });
});
