# Dev Map Lab

## Project & Repository

程式與架構學習工作台。Next.js App Router、React、TypeScript，採 static export。
目前階段只完成 GitHub 程式與本機功能；會員、雲端同步、模型下載與正式部署依使用者後續指示接入。

## Setup & Commands

- Node.js 24、Bun 1.4.4。
- `bun install --frozen-lockfile`
- `bun run dev`
- `bun run verify`：Biome、TypeScript、教材驗證、Vitest、production build。

## Engineering Rules

- 教材與題庫放 `content/`，不得在 React component 硬編碼新增課程。
- 題型採 discriminated union；邊界用 Zod 驗證，避免 `any`、型別斷言與 non-null assertion。
- 題目、單元與 block ID 是永久識別，不跟著標題變更；改題意時增加 version。
- 不在主頁面用 `eval`、`Function` 或 Node `vm` 執行學員程式；只經 Worker → QuickJS。
- 每筆測資使用獨立 context，保留 CPU、memory、stack 與 Worker 逾時限制。
- 不向 guest 暴露 DOM、網路、儲存空間或憑證。不得用關鍵詞黑名單冒充隔離。
- 簡答文字規準與語意評分必須明確區分；cosine similarity 不是正確率。
- 本機狀態不可在 SSR 讀取；IndexedDB 初始化與錯誤需有明確狀態。
- 新增 code 題時，JS／TS 參考解法都必須真的執行過全部測資。

## Restricted Files

- 不提交 `.env`、會員憑證、個人作答或筆記備份。
- 不自動變更 Repository visibility、啟用公開部署或新增外部服務。
- 教材 raw HTML 停用；學員與筆記輸入不得注入 HTML。

## Validation & Delivery

- 修改評分、執行器、備份或內容模型時，驗證正常、錯誤與邊界案例。
- 說明實際通過的檢查與限制，區分已完成的本機功能及尚未接入的服務。
- 優先修正已發現的問題；不以 snapshot 或字串斷言取代真實程式執行與資料庫操作。
