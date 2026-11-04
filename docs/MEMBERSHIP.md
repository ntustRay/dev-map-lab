# 會員與雲端備份

會員程式已實作，線上後端尚未啟用。未設定環境變數時仍可正常使用訪客教材、練習與筆記，會員頁會顯示尚未啟用。

## 本次範圍與目前阻擋

- Email 註冊、確認信、重寄確認信、登入、此裝置登出、忘記密碼與設定新密碼。
- 可選的 GitHub／Google OAuth 登入。
- 訪客、不同會員與不同 Supabase 專案各自的本機空間。
- 顯示名稱、明確的訪客匯入、手動雲端備份與備份合併。
- 版本化 SQL migration、RLS、預期帳號及 revision 衝突檢查。

2026-11-04 再次檢查時，MingRay Org 的兩個免費 Supabase 專案用於 `visual-regression-hub` 與 `engineer-stock-web`，沒有 Dev Map Lab 專用專案。本次未修改這兩個應用，也未停用專案、建立付費資源或複製它們的憑證。

預設方案是獨立專案，讓會員與寄信設定可以獨立管理。啟用前需選定可用的免費專案，或另行架設 Supabase。若決定共用既有專案，必須先確認：Auth 使用者池、密碼與 Auth 設定會共用；表名稱不同不能隔離 Auth。不能只因免費額度已滿就自行改用其他應用的後端。

## 啟用步驟

### 1. 選定後端並套用 migration

在選定的 Supabase 專案，先檢查既有資料表，確定沒有同名資源，再以 migration 工具套用：

[`supabase/migrations/20261103142006_member_workspace.sql`](../supabase/migrations/20261103142006_member_workspace.sql)

也可在該專案的 SQL Editor 執行這份檔案一次。後續異動應新增 migration，避免重跑已存在的建表 SQL。

Migration 建立：

| 資源                    | 用途                                 | 權限                                                    |
| ----------------------- | ------------------------------------ | ------------------------------------------------------- |
| `devmap_profiles`       | user_id、顯示名稱、更新時間          | 會員僅讀寫自己的列                                      |
| `devmap_workspaces`     | user_id、revision、v1 備份、更新時間 | 會員僅讀寫自己的列                                      |
| `devmap_save_workspace` | 原子保存與版本檢查                   | authenticated、security invoker；比對實際身分與預期帳號 |

兩張表都參照 `auth.users`，啟用 RLS；匿名使用者沒有表或 RPC 的執行權限。前端不會拿到 service_role。資料庫中的備份不是正式考試成績，也不應用來授予管理權限。

### 2. 設定 Auth callback

在 Supabase Auth 的 URL Configuration 設定 Site URL，並加入允許的 Redirect URL。

| 環境     | Site URL 範例             | Redirect URL 範例                      |
| -------- | ------------------------- | -------------------------------------- |
| 本機開發 | `http://localhost:3000`   | `http://localhost:3000/auth/callback/` |
| 正式網站 | 選定後的實際 HTTPS origin | 該 origin 的 `/auth/callback/`         |

不要把範例網域直接當正式設定。正式 callback 使用明確網址；預覽環境有需要時再加入。Email 與 OAuth 都回到同一 callback，`next` 只接受站內路徑。

使用 PKCE：發起註冊／重設的瀏覽器保存驗證資料，因此確認信應在同一瀏覽器開啟。過期、缺少 code、OAuth 錯誤與缺少 PKCE 狀態會顯示錯誤，不會顯示假登入成功。SDK 支援 callback 的 `sb_flow_id`。

### 3. 啟用 Email 與寄信

保留 Email confirmation；正式開放註冊前設定並驗證 custom SMTP。Supabase 內建寄信只適用有限的測試收件人與額度，不能把「管理者信箱收得到」當作公開註冊已完成。

SMTP host、port、sender、username 與 password 設定在 Supabase 的伺服器端；不要寫進 `NEXT_PUBLIC_*`、本 repo 或聊天內容。選用寄信服務時另外確認當下免費額度與寄件者要求。未選定寄信服務之前，不假設特定供應商一定免費或一定可寄信。

本機流程的密碼至少 12 個字元，UTF-8 最多 72 bytes。Supabase 後台應設定相容的密碼政策；若後端要求更嚴格，以後端驗證為準。

### 4. 設定前端環境變數

複製 `.env.example` 為 `.env.local`，填入**選定專案**的 URL 與 publishable key：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
NEXT_PUBLIC_AUTH_GITHUB_ENABLED=false
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false
```

這些值會出現在靜態前端 bundle。URL 與 publishable key 是公開設定；RLS 負責資料權限。程式拒絕 secret key、service_role 與舊式 JWT key，請由專案取得新的 publishable key。

```bash
bun run dev
```

正式 static export 會在 build 時固定 `NEXT_PUBLIC_*`，設定變更後必須重新 build；只改執行環境不會更新既有 `out/`。

### 5. 可選的社群登入

要開啟 GitHub 或 Google 登入，先依 Supabase 的 provider 指南建立 OAuth app，將 client ID／secret 設在 Supabase，再將該 provider 的前端旗標改為 `true`。

Provider 的 OAuth callback 指向 Supabase 提供的 `/auth/v1/callback`；Supabase 完成後再導向本網站的 `/auth/callback/`。這兩個 callback 不能混用。沒有設定 provider 時保留 `false`，不顯示無法使用的登入按鈕。

## 資料規則

### 本機與訪客

- 訪客原本的 IndexedDB 資料不會因升級而搬走或刪除。
- 登入後載入該 project + user UUID 的獨立 DB；先清除畫面中的舊空間，再載入新空間。
- 登出回到訪客。會員 DB 仍保存在此瀏覽器，不會自動清除，也不是加密儲存；公用電腦宜用私人視窗並在結束後關閉。
- UI 的空間隔離不能防止持有該瀏覽器本機存取權的人查看 IndexedDB；雲端資料權限另外由 RLS 保護。
- 「訪客資料」勾選確認後才可匯入；原始訪客資料保留，可隨時匯出 JSON。

| 匯入時衝突     | 處理方式                                                            |
| -------------- | ------------------------------------------------------------------- |
| 整頁筆記       | 同 ID 不同本文時附加訪客內容；超過單則 100,000 字元則整筆交易不套用 |
| 段落／文字註記 | 同 ID 不同本文時保留訪客副本及其原始 anchor                         |
| 程式草稿       | 同 ID 不同程式時保留會員版本，訪客版本留在原空間並回報數量          |
| 作答紀錄       | 同 ID 不同內容時保留會員版本，回報衝突；來源不刪除                  |
| 閱讀進度       | 同 lesson ID 保留更新時間較新的資料                                 |

同一個本機會員 DB 會記錄訪客筆記匯入來源，重複匯入同一份不會重複附加；新的訪客編輯仍可再次匯入。匯入紀錄不包含在可攜備份中。

### 雲端手動備份

1. 登入後先查詢自己的雲端版本；新裝置若已有備份，不能直接上傳空白資料。
2. 按「讀取雲端並合併」，保留現有本機資料；相同 note／draft／progress ID 採更新時間較新者，attempt ID 去重。
3. 按「備份到雲端」，送出預期 user_id 與 revision；資料庫在同一操作檢查版本並加一。
4. 若別台裝置先保存，回報衝突，必須重新合併後再上傳。

每帳號只保存最新一份、每份最多 5 MB，不是備份歷史。SQL 依 JSONB 儲存表示計算大小，接近上限時仍可能在後端被拒絕；失敗時保留本機內容，可改用檔案備份。

這不是自動同步：沒有背景上傳、刪除墓碑、離線同步佇列或逐欄位衝突解決。合併也可能讓曾在單一裝置刪除、但仍存在另一份備份的資料再次出現。重要資料在合併前先匯出 JSON；同 ID 衝突採時間比較，無法識別兩台裝置的時鐘誤差或保留所有編輯版本。

## 驗證與上線門檻

`bun run verify` 包含以下可離線測試的行為，沒有向實際會員寄信：

- 既有教材、QuickJS runner、評分與資料庫測試。
- fake-indexeddb 下的真實 Dexie 交易、帳號切換、過期讀取／待存寫入、訪客匯入與交易回復。
- SDK 邊界的受控替身：驗證結果、登出事件、舊請求晚到、cloud owner／revision／回傳格式。
- PGlite 真實 PostgreSQL 引擎：執行實際 migration，以不同角色與 JWT subject 驗證 SELECT、UPDATE、匿名拒絕、RLS WITH CHECK、invoker、版本衝突與大小限制。這不取代 GoTrue／PostgREST／SMTP 的線上驗證。

完成專案與寄信設定後，仍須在實際網站驗證：

- [ ] 新信箱註冊 → 收確認信 → 同瀏覽器 callback → 登入成功。
- [ ] 未驗證信箱不能直接登入；重寄確認信可用，過期 callback 正確報錯。
- [ ] 忘記密碼 → 收信 → 設定新密碼 → 此裝置登出 → 新密碼可登入。
- [ ] 重新整理、登出與兩個測試帳號切換，不出現別人的筆記或編輯內容。
- [ ] 訪客不會自動匯入；明確匯入後原資料仍可匯出。
- [ ] 兩個真實帳號透過前端與直接 API 均不能讀寫對方 profile／backup。
- [ ] 第二裝置先合併再保存；兩個舊 revision 的保存只接受第一份。
- [ ] 實際專案的 security／performance advisors 沒有本次資源造成的未解決問題。
- [ ] 若啟用 OAuth，實際驗證該 provider；未啟用的不列為已完成。

目前尚未通過上述線上清單，不應對外宣稱會員已正式啟用。正式部署與公開網址另行處理。

## 官方參考

- [Supabase Auth PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [SMTP 與寄信限制](https://supabase.com/docs/guides/auth/auth-smtp)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [API keys](https://supabase.com/docs/guides/api/api-keys)
- [GitHub OAuth](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase 自行架設](https://supabase.com/docs/guides/self-hosting)
