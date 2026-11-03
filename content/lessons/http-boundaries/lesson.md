---

id: "http-boundaries"
title: "API 邊界與可辨識的錯誤"
summary: "將外部輸入轉成可用資料，用 discriminated union 表達成功與失敗。"
minutes: 18
tags: ["API", "TypeScript", "架構"]
prerequisites: ["typescript-narrowing"]
version: 1
---

<!-- block: boundary-contract -->

## 先定義 Input 與 Output

API 邊界負責把外部資料轉成程式可以使用的資料。先對齊必填欄位、型別、範圍與失敗行為。

```typescript
type ReadIdResult =
  | { ok: true; value: number }
  | { ok: false; error: "invalid-id" };
```

用 ok 區分成功與失敗，呼叫端不用猜 null、空字串或例外各自代表什麼。

<!-- block: validate-first -->

## 驗證與業務處理分開

1. 取得 unknown 輸入。
2. 檢查物件、必要欄位與數字範圍。
3. 不符合契約就回傳明確錯誤。
4. 驗證通過後才查資料或進行業務處理。

```typescript
function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
```

<!-- block: http-errors -->

## HTTP 狀態與領域結果各自表達一件事

| 狀況             | 常見 HTTP 狀態 |
| ---------------- | -------------- |
| 輸入格式不符     | 400            |
| 尚未驗證身分     | 401            |
| 沒有操作權限     | 403            |
| 目標不存在       | 404            |
| 未預期的服務失敗 | 500            |

實際契約仍由專案決定。不要把驗證失敗直接當成伺服器故障，也不要把完整 stack trace 或內部憑證回傳給使用者。
