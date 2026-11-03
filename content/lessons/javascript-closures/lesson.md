---

id: "javascript-closures"
title: "Closure 與保留下來的狀態"
summary: "用 lexical scope 解釋 closure，並建立互不干擾的計數器。"
minutes: 15
tags: ["JavaScript", "Closure"]
prerequisites: ["javascript-values"]
version: 1
---

<!-- block: lexical-scope -->

## 變數從定義位置尋找

Lexical scope 指的是：函式可存取哪些變數，取決於函式定義時的程式結構。呼叫它的位置不會直接改變這個關係。

```javascript
const label = "outside";
function readLabel() {
  return label;
}
function run() {
  const label = "inside";
  return readLabel();
}
// run() 回傳 outside
```

<!-- block: closure-state -->

## 外層返回後，狀態仍可使用

```typescript
function createCounter(start: number) {
  let current = start;
  return () => current++;
}
const next = createCounter(4);
next(); // 4
next(); // 5
```

回傳的函式仍可讀寫建立時捕捉的 current。這個函式與其 lexical environment 的組合，就是 closure。它存取的是綁定，不是每次呼叫都重新拍一張值的快照。

<!-- block: independent-counters -->

## 每次呼叫建立獨立狀態

```javascript
const first = createCounter(0);
const second = createCounter(10);
first(); // 0
second(); // 10
first(); // 1
```

兩次 createCounter 呼叫建立不同的 current。避免把 current 搬到模組頂層，否則不同計數器可能共享狀態。
