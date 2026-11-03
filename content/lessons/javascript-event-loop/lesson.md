---

id: "javascript-event-loop"
title: "同步工作、Microtask 與重試策略"
summary: "釐清 Promise 排程順序，將延遲策略與真正的計時器分離。"
minutes: 15
tags: ["JavaScript", "非同步"]
prerequisites: ["javascript-closures"]
version: 1
---

<!-- block: execution-order -->

## 先完成目前的同步工作

```javascript
console.log("A");
Promise.resolve().then(() => console.log("B"));
console.log("C");
// A → C → B
```

Promise callback 不會插入目前尚未完成的同步呼叫堆疊。當目前工作結束、清空 stack，執行環境會在適當的 checkpoint 處理 microtask。

<!-- block: task-vs-microtask -->

## Microtask 與 timer 是不同的排程

```javascript
setTimeout(() => console.log("timer"), 0);
Promise.resolve().then(() => console.log("promise"));
console.log("sync");
// 在這個基本情境：sync → promise → timer
```

0 ms timer 不代表立即執行。執行順序還受到目前 task、microtask 與執行環境影響；不要用 timer 的精確毫秒數驗證商業邏輯。

<!-- block: retry-policy -->

## 先把延遲策略寫成純函式

Exponential backoff 的基本序列可寫成 base × 2ⁿ，再以 maxDelay 限制上限。

| 次數 n | base = 100，maxDelay = 500 |
| ------ | -------------------------: |
| 0      |                        100 |
| 1      |                        200 |
| 2      |                        400 |
| 3      |                        500 |

先測試序列，再另外處理等待、取消與錯誤分類。正式網路重試通常還需要 jitter、次數上限，並確認請求是否適合重試。
