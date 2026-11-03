import { Dashboard } from "../components/dashboard";
import { loadContent } from "../content/load";

export default async function HomePage() {
  const { catalog, lessons } = await loadContent();
  return (
    <Dashboard
      catalog={catalog}
      lessons={lessons.map(({ blocks: _blocks, questions, ...meta }) => ({
        ...meta,
        questionCount: questions.length,
      }))}
    />
  );
}
