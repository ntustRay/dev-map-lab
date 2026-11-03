---

id: "javascript-values"
title: "值、參照與不修改輸入"
summary: "分清物件共享與變數賦值，寫出不改動原始陣列的函式。"
minutes: 12
tags: ["JavaScript", "資料處理"]
prerequisites: []
version: 1
---

<!-- block: value-and-reference -->

## 先看兩個變數指向哪裡

JavaScript 的賦值會複製值。物件的值是參照，因此兩個變數可以指向同一個物件。

```javascript
const source = { count: 1 };
const alias = source;
alias.count = 2;
console.log(source.count); // 2
```

修改物件屬性會影響所有指向它的參照；重新指定其中一個變數，則不會改掉另一個變數。

<!-- block: shallow-copy -->

## 展開運算子只複製一層

```typescript
const source = { profile: { name: "Ray" } };
const copy = { ...source };
copy.profile.name = "Ming";
// source.profile.name 也會變成 Ming
```

外層物件不同，內層 profile 仍指向同一個物件。需要更新巢狀資料時，沿著修改路徑建立新物件。

<!-- block: pure-transform -->

## 用輸入與輸出描述資料處理

1. 定義接收哪些值。
2. 定義回傳哪些值。
3. 避免修改呼叫者傳入的陣列或物件。
4. 為空陣列、負數、零與重複值加入測資。

```typescript
function double(values: number[]): number[] {
  return values.map((value) => value * 2);
}
```

純函式讓同一組輸入得到相同輸出，也讓測試不必依賴外部狀態。
