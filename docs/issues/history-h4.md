# H4: 邏輯資料夾與批次移動

狀態：已實作；51 個測試與 typecheck 通過；GitHub [#5](https://github.com/pepe1113/image-hoisting/issues/5)
類型：AFK

## Parent

[History management PRD](../prd-history-management.md)

## What to build

加入平面邏輯資料夾、篩選與批次 Move Folder；保留 key、URL 與圖片內容

## Acceptance criteria

- [x] 新增／既有／未分類目的地皆可使用，folder 最長 80 字元並驗證非法字元
- [x] folder 篩選可搭配標籤，搜尋或切換資料夾重設頁面
- [x] 資料夾從全 Profile 圖片 metadata 導出，舊圖片為未分類
- [x] 移動後更新清單、選取及統計；部分失敗可重試
- [x] 鍵盤、390px、明暗色與 Masonry／Lightbox 通過驗證

## Blocked by

H3（依使用者要求依序實作）

User stories: 11–16
