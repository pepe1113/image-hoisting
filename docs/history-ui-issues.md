# History UI issues

Stitch 參考：`stitch/image-hosting-history-list/{light,dark}/`

狀態：已完成實作；PRD 與依序執行紀錄見 `prd-history-management.md` 及 `issues/history-h1.md` 至 `history-h4.md`

## 統計與連續載入

`src/images.ts` 的 `listImages` 原本只回傳當批 data 與 pagination，沒有 total 或 totalBytes

- [x] 定義全 Profile 與篩選結果統計，回傳總檔案數及容量，驗證上傳／刪除後更新
- [x] 利用既有 limit／offset cursor 每批載入 50 張，驗證搜尋、切換 Profile 與篩選後重設

已顯示全 Profile 的 Total files／Bucket size；圖片牆接近底部時自動載入下一批，不顯示頁碼

## 圖片尺寸

`ImageRecord`、R2 customMetadata 與上傳回傳均無 width／height

- [x] 建立可信的尺寸取得與儲存方式，定義既有圖片缺值處理
- [x] 列表可顯示尺寸，且不為讀取尺寸下載所有原圖

新上傳圖片由伺服器解析並保存尺寸；舊圖片缺值顯示 Unknown dimensions

## 批次 Add Tags

目前只支援逐張編輯 filename／tags，可重用現有 PATCH

- [x] 合併並去重標籤，遵守 MAX_TAGS／MAX_TAG_LENGTH
- [x] 處理部分失敗與重試，驗證既有標籤不被覆蓋

已加入 Add Tags，保留批次複製 Markdown 與刪除

## Move Folder

目前沒有資料夾模型或移動 API，key／公開 URL 直接對應 R2 物件

- [x] 採用同一 Profile 內的平面邏輯分類
- [x] Move Folder 僅更新 metadata，保留 key、圖片內容與公開 URL，部分失敗可重試

已加入資料夾篩選與批次 Move Folder；空值代表 Unfiled

## UI 實作範圍

列表欄位、搜尋工具列、選取工具列、URL／Markdown 複製、編輯／刪除 icon、明暗色與手機版；沿用 lucide-react，保留既有 Masonry 與 Lightbox
