# H1: 統計與連續載入

狀態：已實作；44 個測試與 typecheck 通過；GitHub [#2](https://github.com/pepe1113/image-hoisting/issues/2)
類型：AFK

## Parent

[History management PRD](../prd-history-management.md)

## What to build

新增全 Profile 總數與容量、篩選結果總數與容量，以及每批 50 張的向下滑動載入；搜尋、資料夾或 Profile 切換時重設結果

## Acceptance criteria

- [x] 全 Profile 統計不被標籤或 prefix 篩選改變
- [x] 分頁保留舊 cursor 合約，越界回傳最後有效頁
- [x] 載入下一批保留選取，切換查詢條件時清空選取，舊請求不覆蓋新結果
- [x] 修改後重新載入統計，列表與 Masonry 排版不變

## Blocked by

None - can start immediately

User stories: 1–5、15–16
