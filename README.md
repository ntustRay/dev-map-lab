# Dev Map Lab

程式與架構學習工作台：學習路線、教材、四種練習題與個人筆記。

目前使用本機資料，不需要註冊服務、API key 或設定環境變數。GitHub Actions 只做驗證與產生 build artifact，不部署網站。

## 已可使用

- 2 條學習路線、6 個單元、24 題練習。
- 選擇題：單選、多選、逐題解析。
- 填充題：可接受多種答案，逐題設定正規化規則。
- 簡答題：依得分點給出文字規準參考分數、缺少的概念與參考答案。
- JS／TS 實作題：CodeMirror highlight、程式草稿、逐筆測資、Console、錯誤、逾時及停止執行。
- 教材：Markdown、Shiki code highlight、固定段落 ID。
- 筆記：整頁、段落、選取文字／程式碼註記、Markdown 匯出。
- IndexedDB 保存筆記、閱讀進度、作答與程式草稿；JSON 備份與合併匯入。
- 單元搜尋、筆記搜尋、行動裝置導覽與鍵盤焦點。

## 本機執行

安裝 Node.js 24 與 Bun 1.4.4 後：

```bash
git clone https://github.com/ntustRay/dev-map-lab.git
cd dev-map-lab
bun install --frozen-lockfile
bun run dev
```

開啟終端機顯示的本機網址。

```bash
bun run check          # Biome
bun run typecheck      # TypeScript
bun run content:check  # 教材、題目、規準、先修關係
bun run test           # QuickJS 執行與 Dexie 資料操作測試
bun run build          # 靜態輸出到 out/
bun run verify        # 一次執行全部檢查
```

無需外部字體、分析服務或執行時 AI API。首次安裝套件需要網路；目前沒有 Service Worker，不承諾關掉網路後可重新載入整站。

## 技術與責任

| 部分      | 使用技術                           | 責任                           |
| --------- | ---------------------------------- | ------------------------------ |
| 網站      | Next.js、React、TypeScript         | 路由、靜態頁與互動工作台       |
| 內容      | Markdown、JSON、Zod                | 教材、題庫、格式與關係驗證     |
| Highlight | Shiki、CodeMirror 6                | 教材閱讀與程式編輯             |
| 執行器    | QuickJS WASM、Web Worker、Sucrase  | 隔離執行 JS、轉譯 TS、測資比對 |
| 資料      | Dexie／IndexedDB、Zustand          | 保存與呈現本機學習資料         |
| 品質      | Bun、Biome、Vitest、GitHub Actions | 可重現安裝、檢查與 build       |

## 教材擴充

新增 `content/lessons/<lesson-id>/lesson.md` 與 `questions.json`，再將 ID 加進 `content/catalog.json`。執行 `bun run content:check` 與 `bun run test`。

完整格式與操作範例見 [內容指南](docs/CONTENT.md)。新增一般單元不必修改 React 元件；新增題型或語言仍需要擴充 renderer、grader 或 runner。

## 目前的邊界

- 尚未接入會員登入、雲端同步、模型下載與網站部署。
- 簡答題目前是規準比對，**沒有偷偷呼叫 AI**。`SemanticEvaluator` 是後續離線模型的接入介面；題庫門檻目前為 `null`，避免使用未校準數值。
- 程式題支援同步 `solve(...)` 函式，輸入輸出為 JSON；不提供 DOM、網路、檔案系統或任意 npm 套件。
- TS 模式只轉譯，不等於完整 TypeScript 型別檢查。
- 測資在客戶端可被檢視，分數用於自學；不作為防作弊或正式考試成績。
- 每筆測資有時間、記憶體與 Stack 限制，Worker 另有總逾時；這是降低執行風險的防線，不是絕對隔離保證。
- 筆記保存在目前瀏覽器與 origin。更換網址、裝置或清除網站資料前，請匯出 JSON 備份。

設計與後續工作見 [架構](docs/ARCHITECTURE.md)、[評分規則](docs/GRADING.md)、[Roadmap](docs/ROADMAP.md)。

## 授權

專案原始碼與原創教材採 MIT。第三方套件保留各自授權；未打包第三方模型權重或第三方題庫。
