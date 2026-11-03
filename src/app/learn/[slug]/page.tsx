import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonWorkspace } from "../../../components/lesson-workspace";
import { loadContent } from "../../../content/load";

export async function generateStaticParams() {
  const { lessons } = await loadContent();
  return lessons.map((lesson) => ({ slug: lesson.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { lessons } = await loadContent();
  const lesson = lessons.find((item) => item.id === slug);
  return lesson ? { title: lesson.title, description: lesson.summary } : {};
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { catalog, lessons } = await loadContent();
  const lesson = lessons.find((item) => item.id === slug);
  if (!lesson) notFound();
  const summaries = lessons.map(({ blocks: _blocks, questions, ...meta }) => ({
    ...meta,
    questionCount: questions.length,
  }));
  const track = catalog.tracks.find((item) => item.lessonIds.includes(slug));
  const index = track?.lessonIds.indexOf(slug) ?? -1;
  const nextId = track?.lessonIds[index + 1];
  return (
    <LessonWorkspace
      key={slug}
      lesson={lesson}
      prerequisites={summaries.filter((item) =>
        lesson.prerequisites.includes(item.id),
      )}
      next={summaries.find((item) => item.id === nextId) ?? null}
    />
  );
}
