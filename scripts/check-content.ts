import { loadContent } from "../src/content/load";

const { catalog, lessons } = await loadContent();
console.log(
  `內容驗證通過：${catalog.tracks.length} 條路線、${lessons.length} 個單元、${lessons.reduce((sum, lesson) => sum + lesson.questions.length, 0)} 題。`,
);
