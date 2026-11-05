# 會員與雲端備份

本專案改接使用者建立的獨立 Neon 免費專案 `dev-map-lab`，不共用其他應用的會員或資料庫。網站仍採 static export；GitHub Actions 只產生 build artifact，沒有公開部署。

## 目前狀態

| 部分         | 狀態                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Neon 專案    | `spring-heart-24139390`，AWS us-east-2，免費方案                                                     |
| 正式資料庫   | `production`；Auth、Data API、兩份 migration 已配置並驗證 RLS                                        |
| 測試資料庫   | `dev-member-integration`，獨立 branch；測試帳號與備份不進正式資料庫                                  |
| 會員程式     | Email 註冊、6 位數 OTP 驗證、登入／登出、OTP 忘記密碼                                                |
| 本機與雲端   | 每帳號的 IndexedDB、顯示名稱、明確訪客匯入、手動備份與合併                                           |
| 信箱驗證設定 | 控制台的 Require email verification 尚待啟用；前端與 PostgreSQL 都已強制拒絕未驗證信箱的會員資料存取 |
| 寄信服務     | Neon shared SMTP 僅供開發；實際收信尚未驗證，正式公開前另設 custom SMTP                              |
| OAuth        | GitHub／Google 程式保留，前端預設關閉；未宣稱已驗證                                                  |

未設定環境變數時仍能使用訪客教材、題目與本機筆記。免費方案有用量限制，不保證不限流量或永久不變；沒有啟用付費資源。

## 本機連線

複製 `.env.example` 為 `.env.local`：

```dotenv
NEXT_PUBLIC_NEON_DATABASE_URL=https://ep-billowing-moon-bd20lbox.c-8.us-east-2.aws.neon.tech/neondb
NEXT_PUBLIC_AUTH_GITHUB_ENABLED=false
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false
```

這是可公開的 **HTTPS database URL**；不能填 `postgresql://user:password@...`、API key 或資料庫密碼。SDK 由這個 URL 推導 Auth 與 Data API；前端不需要資料庫帳密。

```bash
bun install --frozen-lockfile
bun run dev
```

`NEXT_PUBLIC_*` 會在靜態 build 時固定，變更後須重新 build。CI 已配置相同公開 endpoint，沒有部署網站。

測試時可將 HTTPS database URL 改成開發 branch 的：

```text
https://ep-winter-dream-bdvu662b.c-8.us-east-2.aws.neon.tech/neondb
```

本機資料空間包含 endpoint、database 與 user UUID；切換測試／正式環境不會混用會員筆記。訪客資料維持原 DB。

## Auth 設定與使用流程

### 完成信箱驗證設定

Neon Console → `dev-map-lab` → 選 `production` branch → Settings → Better Auth：

1. 啟用 Email／Password 的 **Require email verification**。
2. 保留 **verification codes / OTP**；shared SMTP 不支援 verification links。
3. 建議啟用重設密碼後撤銷其他 sessions（若控制台提供此選項）。

此設定目前無法透過已連接的 Neon MCP 更新，且控制台需要登入。即使尚未切換，應用的 restrictive RLS 仍檢查服務簽署 JWT 的 `emailVerified = true`，未驗證帳號不能讀寫會員資料。這個欄位不是前端可編輯的 metadata。

註冊時使用 native Managed SDK，避免相容 adapter 在等待驗證時錯誤要求立即取得 session。如果控制台尚未要求驗證而回傳 session，程式會主動寄 OTP，仍不開放會員資料。驗證完成後重新向 Auth 查詢 session；未自動登入時回到密碼登入。

忘記密碼採「Email → 收 OTP → 輸入 OTP 與新密碼 → 此裝置登出 → 新密碼登入」。重設權限由 Auth 檢查 OTP，不由 query string 或本機標記決定。應用要求密碼至少 12 字元、UTF-8 最多 72 bytes；服務端政策更嚴格時以服務端為準。

### 正式開放前的服務設定

- 在 Better Auth 的 trusted domains 加入實際網站 origin；目前僅使用內建 localhost 開發許可，未加入虛構正式網域。
- 公開環境與開發環境宜分開管理 trusted domains；正式環境確認不需要 localhost 後關閉該許可。
- 設定並驗證 custom SMTP。shared SMTP 的 OTP 與 password reset 適用開發，不能以 API 回傳成功代替實際收信測試。
- SMTP 帳密、OAuth client secret 只放 Neon 後端，不放 repo、`NEXT_PUBLIC_*` 或聊天。
- 如需 Google／GitHub，先設定自己的 OAuth app 與 Neon 提供的 provider callback，再開啟對應旗標。網站 callback 是 `/auth/callback/`；SDK 處理 Neon session verifier，完成後才移除網址中的驗證參數。

## 資料庫與 migration

使用 `database/migrations`，按檔名依序執行一次。先在開發 branch 測試，再套用正式 branch；不要重跑已存在的建表語句。

| 資源                                | 用途                        | 權限                                                         |
| ----------------------------------- | --------------------------- | ------------------------------------------------------------ |
| `public.devmap_profiles`            | 顯示名稱                    | authenticated、已驗證信箱、只能自己的列                      |
| `public.devmap_workspaces`          | 最新一份 v1 備份與 revision | 相同 RLS；JSON 格式與 5 MB 限制                              |
| `public.devmap_save_workspace`      | 原子保存與 CAS              | security invoker；比對實際 user ID、預期 user ID 與 revision |
| `devmap_internal.schema_migrations` | 已套用版本                  | 不對 Data API 暴露；會員及匿名均無存取權                     |

應用表參照 `neon_auth."user"(id)`。Managed Auth 的 user ID 是 UUID，policy 使用 `auth.uid()`；驗證狀態讀取 `auth.jwt()`。Neon 管理 Auth schema 的 ACL；RPC 透過在建立時綁定 `auth.uid()` 的 SQL helper 取得身分，所有函式仍使用 invoker，不授予讀取 Managed Auth 使用者表的權限。

Data API 僅暴露 `public`，關閉自動 grants，由 migration 明確配置應用表的 SELECT／INSERT／UPDATE 與 RPC EXECUTE。匿名沒有表／RPC 權限，會員沒有 DELETE／TRUNCATE 或修改 policy 的權限。RLS 是真正的資料授權，前端預先驗證改善錯誤回饋。

保留 typed PostgREST 呼叫，以 `@neon/neon-js/supabase` 相容 adapter 處理現有 `.from()`、`.rpc()`、登入與事件；它只連 Neon，沒有連 Supabase。OTP 使用同套 Managed SDK native client 的 `$fetch`，保留 SDK 的 cookie／verifier 與 token 行為，不自製 OAuth。

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

## 驗證紀錄與待完成項目

`bun run verify` 涵蓋既有教材／QuickJS、fake-indexeddb 的實際 Dexie 交易、SDK 邊界，以及 PGlite 真實 PostgreSQL 執行 migration。測試包含：帳號切換競態、未驗證信箱拒絕、metadata 不能冒充驗證、RLS WITH CHECK、匿名拒絕、invoker RPC、revision 衝突、私有 migration ledger、格式與大小限制。

PGlite 的 JWT helper 是測試替身；線上測試另外驗證 Neon 簽署的 JWT 與 Data API，不能把單元測試當成收信成功。

2026-11-05 線上驗證結果：

- 開發 branch 使用合成信箱與隨機密碼，實測 Managed Auth 註冊、登入、讀取 session 與登出，未寄信至真實使用者。
- 加上驗證信箱的 restrictive policy 前，以兩個真實簽署 JWT 驗證 profile owner 隔離、WITH CHECK、備份 owner 檢查、首次保存、並發 CAS（一筆成功、一筆 40001）與 payload 拒絕。
- 套用最終 restrictive policy 後，以官方 Neon SDK 再驗證兩個未驗證帳號：SELECT 回空、profile upsert／備份 RPC 回 42501；pre-bound identity helper 正常執行，無需提升權限。
- 匿名 JWT 讀表回 403／42501；沒有 bearer token 的請求由 gateway 拒絕。未驗證信箱不是已完成會員登入的測試替代品。
- 正式 branch 套用兩份 migration；與開發 branch schema diff 為空。兩張表都啟用 RLS、兩份 restrictive policy、兩個函式均 invoker；正式會員、profile 與備份皆為 0。
- 本機 `bun run verify`：84 項測試、Biome、TypeScript、教材驗證與 production build 通過。
- 本次瀏覽器預覽路由無法連線，因此沒有把新版表單的瀏覽器操作列為通過；實際收信與完整 UI 流程仍待驗證。

開發 branch 保留合成帳號與少量測試資料；正式資料庫沒有測試帳號。測試用密碼的暫存已移除。尚未驗證的項目：

- [ ] 真實信箱註冊 → 收到 OTP → 驗證 → 前端登入成功。
- [ ] 忘記密碼收 OTP → 重設 → 新密碼登入，舊 sessions 依服務設定撤銷。
- [ ] 兩個已驗證信箱在前端與第二裝置完成備份／合併流程。
- [ ] 正式 custom SMTP、網站 origin 與 OAuth（如需）驗證。
- [ ] 正式網站部署；目前沒有公開網址。

## 官方參考

- [Neon JavaScript SDK](https://neon.com/docs/reference/javascript-sdk)
- [Email OTP](https://neon.com/docs/auth/guides/plugins/email-otp)
- [Email verification](https://neon.com/docs/auth/guides/email-verification)
- [Production checklist](https://neon.com/docs/auth/production-checklist)
- [Data API access control](https://neon.com/docs/data-api/access-control)
- [Row-Level Security](https://neon.com/docs/guides/row-level-security)
