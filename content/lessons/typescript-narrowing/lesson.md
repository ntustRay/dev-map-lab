---

id: "typescript-narrowing"
title: "用 Type Guard 收斂 unknown"
summary: "先檢查值再操作，讓 TypeScript 與執行時驗證保持一致。"
minutes: 16
tags: ["TypeScript", "Type Guard"]
prerequisites: ["javascript-values"]
version: 1
---

<!-- block: unknown-input -->

## unknown 要求先檢查

API、JSON 或使用者輸入不能只靠 TypeScript 型別宣告信任。unknown 允許接收未知資料，但在檢查前限制操作。

```typescript
function readName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim();
}
```

<!-- block: guard-object -->

## 檢查物件也要排除 null

```typescript
function readId(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("id" in value) || typeof value.id !== "number") return null;
  return value.id;
}
```

typeof null 的結果是 object。確認屬性存在後，還要確認屬性的實際型別。若接受數字 ID，也應依需求限制整數、正負與範圍。

<!-- block: runtime-contract -->

## 型別不會代替資料驗證

1. 邊界接收 unknown。
2. 執行型別與業務規則檢查。
3. 成功後回傳明確的型別。
4. 失敗回傳明確結果，讓呼叫端處理。

TypeScript 轉成 JavaScript 後，型別註記會被移除。實作題中的 TS 模式只轉譯，不提供完整專案型別檢查。
