# H2: 圖片尺寸持久化與顯示

狀態：已實作；47 個測試與 typecheck 通過；GitHub [#3](https://github.com/pepe1113/image-hoisting/issues/3)
類型：AFK

## Parent

[History management PRD](../prd-history-management.md)

## What to build

上傳解析 PNG／JPEG／GIF／WebP／AVIF 的檔案尺寸，保存在 metadata，於列表規格顯示

## Acceptance criteria

- [x] 上傳、清單、編輯回傳 width／height，缺值使用 null
- [x] 忽略使用者提供的尺寸，從檔案取得
- [x] 截斷及未知資料不拋出未處理錯誤、不猜尺寸
- [x] 舊圖片顯示 Unknown dimensions，無額外原圖請求

## Blocked by

H1（依使用者要求依序實作）

User stories: 6–8、15
