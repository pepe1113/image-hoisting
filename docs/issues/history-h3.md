# H3: 批次加入標籤與失敗重試

狀態：已實作；49 個測試與 typecheck 通過；GitHub [#4](https://github.com/pepe1113/image-hoisting/issues/4)
類型：AFK

## Parent

[History management PRD](../prd-history-management.md)

## What to build

選取本頁圖片後透過 Add Tags 對話框加入標籤；伺服器合併最新 metadata，逐張回報失敗並可重試

## Acceptance criteria

- [x] addTags 保留原標籤，正規化去重並驗證合併後上限
- [x] 拒絕同時提供 tags 與 addTags
- [x] 成功項目取消選取，失敗項目保留；重試不重複新增
- [x] 執行中不允許重複送出／關閉，保留管理者權限與 Profile 隔離

## Blocked by

H2（依使用者要求依序實作）

User stories: 9–11、16
