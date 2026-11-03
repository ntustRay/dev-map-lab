# 教材與題庫

## 檔案

| 路徑                                  | 內容                             |
| ------------------------------------- | -------------------------------- |
| `content/catalog.json`                | 路線、順序與單元 ID              |
| `content/lessons/<id>/lesson.md`      | 單元 metadata 與教材             |
| `content/lessons/<id>/questions.json` | 題型、答案、規準、測資與參考解法 |

先複製一個既有單元，替換所有單元與題目 ID，再加入 catalog。不得重複使用其他單元的 question ID。

## Markdown

```markdown
---

id: my-topic
version: 1
title: 我的單元
summary: 學完後可以完成什麼事情。
minutes: 15
tags: [TypeScript]
prerequisites: [javascript-values]
---

<!-- block: concept -->

## 這個概念解決什麼問題

教材內容。

<!-- block: example -->

## 用例子驗證

教材內容。
```

- 內容必須從 block 標記開始，每個 block 只能出現一次。
- block ID 只使用小寫英文字母、數字與連字號，且以英文字母開頭。
- 修改標題不用更換 ID；刪除或改名會影響已存的筆記定位。
- 原始 HTML 停用。程式碼使用 fenced code block，指定 `javascript`、`typescript`、`json`、`bash` 或 `sql`；不支援的語言回退為純文字。
- 先修關係會檢查存在性與循環；不強制鎖住單元，使用者可自由瀏覽。

## 共用題目欄位

`questions.json` 最外層為 `schemaVersion: 1`、`lessonId` 與 `questions` 陣列。每題都有：

| 欄位              | 用途                              |
| ----------------- | --------------------------------- |
| `id`              | 全站唯一、永久 ID                 |
| `version`         | 修改題意、答案或規準時增加        |
| `type`            | `choice`／`fill`／`short`／`code` |
| `title`、`prompt` | 題名與完整契約                    |
| `points`          | 本題分數                          |
| `explanation`     | 解析                              |

## 題型

### choice

`multiple` 指定多選；`options` 包含 `id` 與 `text`；`correctIds` 列出正確選項。單選只能一個正確答案，多選必須完全符合才給分。

### fill

`answers` 列出可接受答案。`normalization` 逐題設定 `trim`、`caseSensitive`、`collapseWhitespace`。不會全域刪除所有空白或忽略大小寫，避免改變程式碼題意。

### short

`referenceAnswer` 提供完整參考答案，`criteria` 列出得分點：

| 欄位                | 規則                                     |
| ------------------- | ---------------------------------------- |
| `points`            | 各得分點總分必須等於題目總分             |
| `acceptedPhrases`   | 命中任一完整片語可符合該點               |
| `keywordGroups`     | 每一組至少命中一個詞，才符合該點         |
| `misconceptions`    | 命中時該點不給分；僅覆蓋題庫已列出的錯誤 |
| `semanticThreshold` | 未校準一律 `null`；預留離線模型用        |

應實際準備正確、部分正確、同義改寫、否定與錯誤論述等案例。文字規準不會理解所有表達，不得宣稱可證明答案正確。

### code

- `entrypoint` 固定 `solve`。
- `starters` 與 `solutions` 都包含 `javascript`、`typescript`。
- `tests` 每題 3–30 筆，包含 `id`、`label`、`args`、`expected`。
- `preserveInput` 預設 `true`：檢查呼叫後輸入的 JSON 值未改變；若題目允許修改輸入，明確設 `false`。
- `comparison` 可用 `{ "kind": "deepEqual" }`、`{ "kind": "unorderedArray" }` 或 `{ "kind": "numericTolerance", "tolerance": 0.00001 }`。
- `limits.timeMs` 範圍 10–2000 ms、`limits.memoryMb` 範圍 8–64 MB，逐筆套用。
- 題目參考解法會由 Vitest 真的執行 JS／TS 全部測資，不能只檢查字串。
- 輸出需是 JSON 值，序列化最多 100,000 字元。不能回傳 undefined、BigInt、循環物件或未等待的 Promise。

可先對照 `content/lessons/http-boundaries/questions.json` 與 `cache-aside/questions.json`。

## 發布前

```bash
bun run content:check
bun run test
bun run build
```

教材內的程式碼是可信任作者內容；學員提交的程式則必須走隔離執行器。
