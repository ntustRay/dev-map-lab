import { describe, expect, it } from "vitest";
import { loadContent, parseBlocks, validateCatalog } from "../src/content/load";
import { locateQuote } from "../src/core/anchors";
import { validateQuestions } from "../src/core/content-schema";
import type { NoteAnchor } from "../src/storage/schema";

describe("教材與題庫驗證", () => {
  it("所有路線、單元與四種題型都可載入", async () => {
    const { lessons, catalog } = await loadContent();
    expect(catalog.tracks.length).toBeGreaterThan(0);
    expect(lessons.length).toBeGreaterThanOrEqual(6);
    for (const lesson of lessons) {
      expect(
        new Set(lesson.questions.map((question) => question.type)).size,
      ).toBe(4);
      expect(lesson.blocks.every((block) => block.html.length > 0)).toBe(true);
    }
  });
  it("缺失或重複的 block ID 會讓發布檢查失敗", () => {
    expect(() => parseBlocks("沒有標記")).toThrow();
    expect(() =>
      parseBlocks("<!-- block: a -->\n文字\n<!-- block: a -->\n更多文字"),
    ).toThrow();
    expect(parseBlocks("<!-- block: a -->\n文字")[0]?.markdown).toBe("文字");
  });
  it("拒絕不存在的單元與循環先修", () => {
    const catalog = {
      schemaVersion: 1,
      tracks: [
        {
          id: "track",
          title: "路線",
          description: "說明",
          lessonIds: ["one", "two"],
        },
      ],
    };
    expect(() =>
      validateCatalog({ ...catalog, schemaVersion: 1 }, [
        { id: "one", prerequisites: [], questions: [] },
      ]),
    ).toThrow();
    expect(() =>
      validateCatalog({ ...catalog, schemaVersion: 1 }, [
        { id: "one", prerequisites: ["two"], questions: [] },
        { id: "two", prerequisites: ["one"], questions: [] },
      ]),
    ).toThrow("循環");
  });
  it("拒絕正確選項不存在與規準總分不符", async () => {
    const { lessons } = await loadContent();
    for (const question of lessons.flatMap((lesson) => lesson.questions)) {
      if (question.type === "choice") {
        expect(() =>
          validateQuestions([{ ...question, correctIds: ["not-found"] }]),
        ).toThrow();
        break;
      }
    }
    for (const question of lessons.flatMap((lesson) => lesson.questions)) {
      if (question.type === "short") {
        expect(() =>
          validateQuestions([{ ...question, points: question.points + 1 }]),
        ).toThrow();
        break;
      }
    }
  });
});

describe("文字註記重新定位", () => {
  const anchor: Extract<NoteAnchor, { kind: "selection" }> = {
    kind: "selection",
    blockId: "a",
    quote: "Closure",
    prefix: "理解 ",
    suffix: " 的原因",
    start: 3,
    end: 10,
  };
  function input() {
    return { ...anchor };
  }
  it("原文沒變時保持位置", () => {
    expect(locateQuote("理解 Closure 的原因", input())).toEqual({
      start: 3,
      end: 10,
    });
  });
  it("前面增加內容時可透過前後文重新定位", () => {
    expect(locateQuote("先從這裡：理解 Closure 的原因", input())?.start).toBe(
      8,
    );
  });
  it("內容消失或多個符合位置時不猜測", () => {
    expect(locateQuote("沒有原文", input())).toBeNull();
    expect(
      locateQuote("理解 Closure 的原因；理解 Closure 的原因", {
        ...input(),
        start: 100,
        end: 107,
      }),
    ).toBeNull();
  });
});
