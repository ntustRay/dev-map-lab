import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import { createHighlighter } from "shiki";
import {
  type Catalog,
  catalogSchema,
  type Lesson,
  lessonMetaSchema,
  questionFileSchema,
  validateQuestions,
} from "../core/content-schema";

const root = path.join(process.cwd(), "content");
const highlighter = createHighlighter({
  themes: ["github-light"],
  langs: ["javascript", "typescript", "json", "bash", "sql", "text"],
});
let loaded: Promise<{ catalog: Catalog; lessons: Lesson[] }> | null = null;

export function loadContent(): Promise<{
  catalog: Catalog;
  lessons: Lesson[];
}> {
  loaded ??= readContent();
  return loaded;
}

async function readContent() {
  const [catalogRaw, entries, codeHighlighter] = await Promise.all([
    readFile(path.join(root, "catalog.json"), "utf8"),
    readdir(path.join(root, "lessons"), { withFileTypes: true }),
    highlighter,
  ]);
  const catalog = catalogSchema.parse(JSON.parse(catalogRaw));
  const markdown = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false,
    highlight: (code, language) =>
      codeHighlighter.codeToHtml(code, {
        lang: codeHighlighter.getLoadedLanguages().includes(language)
          ? language
          : "text",
        theme: "github-light",
      }),
  });
  const lessons = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry): Promise<Lesson> => {
        const directory = path.join(root, "lessons", entry.name);
        const [source, questionSource] = await Promise.all([
          readFile(path.join(directory, "lesson.md"), "utf8"),
          readFile(path.join(directory, "questions.json"), "utf8"),
        ]);
        const document = matter(source);
        const meta = lessonMetaSchema.parse(document.data);
        if (meta.id !== entry.name)
          throw new Error(`${entry.name}: 目錄與 lesson id 不一致`);
        const questionFile = questionFileSchema.parse(
          JSON.parse(questionSource),
        );
        if (questionFile.lessonId !== meta.id)
          throw new Error(`${meta.id}: 題庫 lessonId 不一致`);
        validateQuestions(questionFile.questions);
        const blocks = parseBlocks(document.content).map((block) => ({
          ...block,
          html: markdown.render(block.markdown),
        }));
        return { ...meta, blocks, questions: questionFile.questions };
      }),
  );
  validateCatalog(catalog, lessons);
  return { catalog, lessons };
}

export function parseBlocks(
  content: string,
): { id: string; markdown: string }[] {
  const marker = /<!-- block: ([a-z][a-z0-9-]*) -->/g;
  const matches = [...content.matchAll(marker)];
  if (matches.length === 0 || content.slice(0, matches[0]?.index ?? 0).trim())
    throw new Error("教材必須從固定的 block 標記開始");
  const blocks = matches.map((match, index) => {
    const id = match[1];
    if (!id) throw new Error("區塊 ID 缺失");
    const markdown = content
      .slice(
        (match.index ?? 0) + match[0].length,
        matches[index + 1]?.index ?? content.length,
      )
      .trim();
    if (!markdown) throw new Error(`${id}: 區塊內容不能空白`);
    return { id, markdown };
  });
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length)
    throw new Error("教材 block ID 重複");
  return blocks;
}

export function validateCatalog(
  catalog: Catalog,
  lessons: Pick<Lesson, "id" | "prerequisites" | "questions">[],
) {
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  const trackIds = catalog.tracks.map((track) => track.id);
  if (new Set(trackIds).size !== trackIds.length)
    throw new Error("學習路線 ID 重複");
  const referenced = catalog.tracks.flatMap((track) => track.lessonIds);
  if (referenced.some((id) => !lessonIds.has(id)))
    throw new Error("路線包含不存在的單元");
  if (lessons.some((lesson) => !referenced.includes(lesson.id)))
    throw new Error("有單元未加入任何路線");
  const questionIds = lessons.flatMap((lesson) =>
    lesson.questions.map((question) => question.id),
  );
  if (new Set(questionIds).size !== questionIds.length)
    throw new Error("跨單元題目 ID 重複");
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error(`先修關係形成循環：${id}`);
    if (visited.has(id)) return;
    const lesson = byId.get(id);
    if (!lesson) throw new Error(`先修單元不存在：${id}`);
    visiting.add(id);
    for (const prerequisite of lesson.prerequisites) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  }
  for (const lesson of lessons) visit(lesson.id);
}
