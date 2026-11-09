import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "../components/app-shell";
import { loadContent } from "../content/load";
import "./globals.css";
import "@ntustray/web-authentication-component/styles.css";

export const metadata: Metadata = {
  title: {
    default: "Dev Map Lab｜程式與架構學習",
    template: "%s｜Dev Map Lab",
  },
  description:
    "以學習路線連接 JavaScript、TypeScript 與應用架構，搭配練習題、程式測資與個人筆記。",
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { catalog, lessons } = await loadContent();
  const summaries = lessons.map(({ blocks: _blocks, questions, ...meta }) => ({
    ...meta,
    questionCount: questions.length,
  }));
  return (
    <html lang="zh-Hant">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要內容
        </a>
        <AppShell catalog={catalog} lessons={summaries}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
