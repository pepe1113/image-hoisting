# History management PRD

狀態：已完成本機實作；GitHub [#1](https://github.com/pepe1113/image-hoisting/issues/1)

## Problem Statement

History 已套用 Stitch 列表設計，但總數與容量只涵蓋已載入資料，且缺少圖片尺寸、批次加標籤與資料夾分類。管理者需要完成這些操作，同時保留現有圖片連結、Masonry 和 Lightbox。

## Solution

在現有 Cloudflare R2 metadata、圖片 API 與 React History 上補齊四條完整流程，依「統計與連續載入 → 圖片尺寸 → 批次標籤 → 邏輯資料夾」順序實作。沿用 lucide-react、SCSS 主題與現有測試工具，不新增 production dependency。

## User Stories

1. 作為管理者，我要看到目前 Profile 的圖片總數與總容量，掌握完整收藏
2. 作為管理者，我要看到篩選後的總數與顯示範圍，知道搜尋結果是否完整
3. 作為管理者，我要向下滑動自動載入下一批圖片，不必切換頁碼
4. 作為管理者，我要搜尋、切換資料夾或 Profile 後重新載入第一批結果
5. 作為管理者，我要修改或刪除圖片後更新列表與統計
6. 作為管理者，我要在圖片規格看到寬高，判斷適合的使用位置
7. 作為第三方 API 使用者，我要上傳後取得伺服器從檔案解析的尺寸，不必自行填入可能錯誤的數字
8. 作為管理者，我要舊圖片或無法解析的圖片明確顯示尺寸未知，且瀏覽列表不額外下載原圖補資料
9. 作為管理者，我要為選取的圖片加入標籤，保留每張圖片原有標籤
10. 作為管理者，我要重複標籤被合併，超出限制時收到明確錯誤
11. 作為管理者，我要批次操作顯示成功與失敗數，保留失敗項目供重試
12. 作為管理者，我要把選取圖片移到同一 Profile 的資料夾分類，保留公開 URL
13. 作為管理者，我要輸入新資料夾名稱或使用既有資料夾，並能移回未分類
14. 作為管理者，我要按資料夾篩選圖片，也能搭配標籤搜尋
15. 作為管理者，我要在手機、明暗色、列表和 Masonry 中使用相同管理操作
16. 作為管理者，我要搜尋、切換資料夾和 Profile 時清空選取，避免誤改其他結果

## Implementation Decisions

- 圖片清單服務：沿用既有 R2 全掃描與上傳日期排序，一次掃描產生 Profile 統計、篩選結果統計、資料夾選項與當頁結果；不增加額外統計掃描
- GET images：保留 data、pagination.limit／cursor／truncated，相容既有 API 用戶；新增 summary.total／totalBytes（全 Profile）、pagination.total／totalBytes（篩選結果）及 pagination.offset（實際頁面起點）
- 連續載入：每批 50 張，前端以 IntersectionObserver 在距離底部 300px 時使用既有 cursor 追加下一批；越界 offset 修正到最後有效批次，空結果 offset 為 0
- 清單控制器：統一管理查詢、cursor 與重新載入；忽略過期查詢／Profile 的回應；修改完成後重新取得第一批與統計；選取限於已載入圖片
- 尺寸解析：上傳時從受大小限制的檔案位元組解析 PNG、JPEG、GIF、WebP、AVIF 的寬高，保存為 R2 customMetadata 並在上傳／清單／編輯回傳 width、height；截斷、未知或不支援的變體回傳 null，不猜測尺寸、不信任使用者填值
- 舊圖片不做隱性回填或额外原圖請求；尺寸缺值顯示 Unknown dimensions。尺寸表示檔案記錄的像素尺寸，不宣稱套用 EXIF 旋轉後的顯示尺寸
- 批次標籤：擴充現有 PATCH 的 addTags 欄位，伺服器以最新讀取的標籤合併，NFKC 正規化、不分大小寫去重，合併後驗證限制；tags 與 addTags 不可同時提供
- 批次執行：沿用每張圖片一個 PATCH，循序處理目前頁最多 50 張；成功項目取消選取，失敗項目保留，可重試；操作執行中禁止重複送出與關閉對話框
- 資料夾：採同一 Profile 內的平面邏輯分類；metadata.folder 為 NFKC 正規化、去頭尾空白、最長 80 字元、不含斜線或控制字元的名稱，空字串代表未分類，缺值相容未分類
- Move Folder 僅更新 metadata，不搬動 R2 key、不刪除原物件、不改公開 URL。資料夾選項從既有圖片導出，最後一張移出後該資料夾不再列出；不建立空資料夾
- GET images 的 folder 缺省代表所有資料夾，空字串代表未分類，具名值代表該資料夾；標籤維持既有 AND 搜尋語意
- 寫入沿用既有管理者 Bearer 驗證、Profile 隔離與 metadata 更新流程，保留檔案內容、uploadedAt、尺寸及未修改 metadata
- metadata 寫入維持現有 last-write-wins 行為；同一物件的多人同時編輯不提供交易保證，此版本不導入資料庫或 Durable Objects

## Testing Decisions

- 沿用 Worker API 的 FakeR2Bucket 測試外部合約：全 Profile／篩選統計、跨 R2 掃描頁、offset 越界、Profile 隔離、修改後統計
- 尺寸解析以小型格式 fixture 驗證五種格式、截斷／錯誤長度及 AVIF 主圖尺寸；上傳測試確認 metadata 持久化與第三方偽造尺寸被忽略
- React 測試驗證捲動追加、搜尋重設、批次部分失敗與重試，以及 folder 篩選／移動後 URL 不變
- 瀏覽器使用本機測試資料驗證桌面與 390px、明暗色、批次對話框、鍵盤焦點、Masonry 與 Lightbox
- 每條 issue 完成後執行相關測試；最後執行 pnpm check 與 git diff --check

## Out of Scope

- 正式環境部署、Git push、搬動或批次回填正式 R2 物件
- 跨 Profile 搬移、階層資料夾、空資料夾、資料夾重新命名／刪除、獨立資料夾管理頁
- 全收藏跨頁選取、多人交易鎖、額外資料庫、縮圖服務、圖片完整解碼／修復

## Further Notes

原始缺口清單：history-ui-issues.md；設計來源：Stitch image-hosting-history-list light／dark

R2 清單既有全掃描是 O(n)，本輪重用它取得正確統計；當收藏量造成實測延遲時，再評估索引與預先計算統計

尺寸格式依據：[PNG](https://www.w3.org/TR/png-3/)、[WebP](https://developers.google.com/speed/webp/docs/riff_container)、[AVIF](https://aomediacodec.github.io/av1-avif/)
