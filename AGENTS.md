# Dev Map Lab

## Project & Repository

程式與架構學習工作台。Next.js App Router、React、TypeScript，採 static export。
使用者已授權優先實作會員與相關服務，選用獨立 Neon 專案。會員採 Managed Better Auth、Neon Data API、帳號各自的 IndexedDB 空間與手動雲端備份；實際啟用狀態見 `docs/MEMBERSHIP.md`。自動同步、模型下載與正式公開部署另行處理。

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
- 會員身分以 Neon SDK 強制重新查詢 server session 驗證；拒絕未驗證信箱。不得以可自行修改的 metadata 作角色授權。
- 切換帳號立即清空畫面狀態，舊的非同步工作不可寫入新帳號。訪客資料只經明確操作匯入。
- 所有公開 schema 的會員表啟用 RLS，另以 restrictive policy 檢查 signed JWT 的 emailVerified；更新 policy 同時有 USING 與 WITH CHECK。RPC 使用 invoker，保存時驗證預期帳號與 revision。
- 真實資料庫修改使用 `database/migrations` 的 versioned migration，先在開發分支驗證；不得任意共用、停用或修改其他應用的雲端專案。
- 新增 code 題時，JS／TS 參考解法都必須真的執行過全部測資。

## Restricted Files

- 不提交 `.env`、會員憑證、個人作答或筆記備份。
- 不自動變更 Repository visibility、啟用公開部署或付費資源。會員服務以免費方案及使用者選定的專案為範圍。
- 教材 raw HTML 停用；學員與筆記輸入不得注入 HTML。

## Validation & Delivery

- 修改評分、執行器、備份或內容模型時，驗證正常、錯誤與邊界案例。
- 說明實際通過的檢查與限制，區分 SDK 邊界測試、PGlite 的 PostgreSQL/RLS 測試及線上服務驗證；不得宣稱尚未配置的後端已啟用。
- 優先修正已發現的問題；不以 snapshot 或字串斷言取代真實程式執行與資料庫操作。

## Shared authentication

Use the published @ntustray/web-authentication-component npm package for authentication UI, state and adapters. Preserve the Managed Neon SDK, existing user IDs, six-digit OTP, server verification, RLS and account-isolated IndexedDB. Update shared behavior in the package before updating this dependency and lockfile. Existing short passwords remain valid for sign-in.
