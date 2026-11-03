---

id: "cache-aside"
title: "Cache-Aside 與資料一致性的邊界"
summary: "用可執行的事件序列觀察快取命中、回源與失效。"
minutes: 20
tags: ["系統設計", "Cache", "架構"]
prerequisites: ["http-boundaries"]
version: 1
---

<!-- block: read-path -->

## 讀取：先查快取，再查資料庫

Cache-Aside 由應用程式管理快取。

1. 讀取快取。
2. 命中就回傳資料。
3. 未命中才查資料庫。
4. 把結果寫回快取，再回傳。

```typescript
const cached = cache.get(key);
if (cached !== undefined) return cached;
const value = database.get(key);
cache.set(key, value);
return value;
```

範例用 undefined 表達不存在；實際設計必須區分「沒快取」與「快取的值是空值」。

<!-- block: write-path -->

## 寫入：更新資料後使快取失效

本單元採用「更新資料庫，再刪除快取」的寫入策略。下一次讀取會重新回源。

這個順序不會自動提供強一致性。並行讀寫、刪除失敗與舊請求延遲寫回，都可能讓舊資料再次出現在快取；需要依容忍度設計版本、重試、TTL 或其他機制。

<!-- block: simulation-scope -->

## 用序列驗證規則，再處理並行問題

| 事件         | 資料庫讀取次數 | 快取狀態   |
| ------------ | -------------: | ---------- |
| read，未命中 |             +1 | 寫入資料   |
| read，已命中 |             +0 | 保留資料   |
| write        |             +0 | 清除資料   |
| 下一次 read  |             +1 | 寫入新資料 |

本題使用單一資料 key 與依序事件，沒有並行或 TTL。測資通過只證明這組序列規則；無法證明真實分散式系統沒有競態。
