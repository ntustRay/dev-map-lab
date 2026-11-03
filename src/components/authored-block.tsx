// biome-ignore-all lint/security/noDangerouslySetInnerHtml: Build-time author Markdown has raw HTML disabled and code escaped by Shiki. User input and notes never enter this renderer.
import type { LessonBlock } from "../core/content-schema";

export function AuthoredBlock({ block }: { block: LessonBlock }) {
  return (
    <div
      className="prose"
      data-block-content={block.id}
      dangerouslySetInnerHTML={{ __html: block.html }}
    />
  );
}
