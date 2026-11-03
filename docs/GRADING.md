# 評分規則

## 可重現的輸出

每次作答保存 question version、grader version、答案與 GradeResult。每個題型皆回傳 score、maxScore、passed、method、feedback 與 needsReview。

| 題型 | 計分                                                                |
| ---- | ------------------------------------------------------------------- |
| 選擇 | 正確選項集合完全相同，給滿分；其餘零分                              |
| 填充 | 依題目指定正規化後，與任一可接受答案相等，給滿分                    |
| 簡答 | 加總命中的得分點，永遠提示核對參考答案                              |
| 程式 | 通過測資比例乘以總分，四捨五入到小數點後兩位；passed 仍要求全數通過 |

## 簡答

目前是規準比對。每個得分點依序：

1. 命中明列錯誤敘述時不給分。
2. 比對 acceptedPhrases，或確認 keywordGroups 每組至少命中一個詞。
3. 若未命中且有 SemanticEvaluator、已校準門檻，才進行語意比對。
4. 語意分數非有限數字、模型失敗或門檻尚未設定時，不補給分。
5. 顯示逐點回饋與參考答案。

規則列舉不可能涵蓋所有否定、矛盾或合理改寫，因此 needsReview 為 true。`passed` 只代表命中這些規準，不代表已驗證技術正確性。

目前種子題庫的 semanticThreshold 全為 null，也沒有載入任何模型。後續不能直接把 cosine similarity 乘 100 變成正確率，必須先以人工資料校準。

## 程式

- deepEqual 忽略物件欄位順序，保留陣列順序。
- unorderedArray 保留重複元素的數量。
- numericTolerance 比較有限數字的絕對誤差。
- timeout、runtime error、轉譯失敗與輸出不同分別顯示。
- 每筆測資的 Console 最多保存 20 行，每行最多 1,000 字元。
- 無法由輸出測資證明時間複雜度、演算法選擇或真實分散式系統一致性。
- 不把硬體差異下量到的毫秒當成跨裝置效能排行榜。
