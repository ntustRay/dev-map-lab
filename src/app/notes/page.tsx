import type { Metadata } from "next";
import { Notebook } from "../../components/notebook";
import { loadContent } from "../../content/load";

export const metadata: Metadata = { title: "我的筆記" };
export default async function NotesPage() {
  const { lessons } = await loadContent();
  return (
    <Notebook
      lessons={lessons.map(({ blocks: _blocks, questions, ...meta }) => ({
        ...meta,
        questionCount: questions.length,
      }))}
    />
  );
}
