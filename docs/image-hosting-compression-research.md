# Public Image Hosting Compression Research

## Conclusion

不存在一個可代表所有線上圖床的平均壓縮率。公開服務的差異在於：是否保留原檔、是否在上傳時轉換、是否在交付時依裝置與顯示尺寸產生衍生檔，以及是否允許使用者取回原始檔

Cloudinary 官方範例中，原始 JPG 0.68 MB 經 `q_auto` 與 `f_auto` 後約 0.16 MB，約節省 75%。另一個 569 KB 的照片範例，`q_auto:best` 為 65.9 KB（約節省 88.4%），`q_auto:good` 為 56.9 KB（約節省 90.0%），`q_auto:eco` 為 45.0 KB（約節省 92.1%）。這些是官方範例，不是跨服務平均值

你的 10 張 Fujifilm X-T30 II 照片由 70.29 MiB 降至 1.97 MiB，整體節省 97.20%，屬於合理但偏積極的結果。原因不是單純 JPEG→WebP：圖片長邊由 6240px 降至 2048px，像素數先減少約 89.2%，再加上 WebP 85 與銳化後的有損編碼。這個數字不應直接宣稱為「WebP 平均可省 97%」

## What public services do

| Service | Officially documented behavior | Implication |
| --- | --- | --- |
| Cloudinary | 預設可保留原始上傳檔；`q_auto`／`f_auto` 主要影響交付檔。`f_auto` 必須在 CDN 依請求瀏覽器決定，不適合當作上傳時固定轉換 | 原檔與網站交付版本可以同時存在 |
| ImageKit | 預設品質為 80、格式為 auto，會依圖片與裝置自動壓縮及轉換；也提供 `orig` 保留原格式，並可關閉 PNG 最佳化 | 交付最佳化是可配置策略，不是固定壓縮率 |
| Imgur | 非動畫圖片匿名上傳超過 1 MB、登入帳戶超過 5 MB 時會有損壓縮；超過 5 MB 的 PNG 會轉 JPEG | 公開圖床可能以檔案大小門檻觸發壓縮，而不是每張都用同一比例 |
| WordPress.com | Jetpack App 預設可在上傳時縮至 2000×2000、JPEG 品質 80；網站的自動最佳化主要影響訪客交付，原始上傳檔保留 | 上傳處理與交付處理是兩種不同產品行為 |

## Why a public site may not compress the stored upload

1. 使用者可能需要原檔下載、重新編輯、列印或攝影作品展示。固定壓縮一旦覆蓋原檔，細節與色彩資料無法恢復
2. 圖片內容差異很大。旅遊照片、文字截圖、透明 PNG、動畫 GIF、插畫與商品圖適合的格式和品質不同，單一規則容易傷害其中一類
3. 交付時才知道裝置、DPR、瀏覽器支援格式與實際顯示寬度。保留原檔後，CDN 可以選擇 JPEG、WebP 或 AVIF，並產生 responsive 尺寸
4. 原檔 URL 與衍生 URL 的責任不同。保留原檔可以提供穩定的下載／備份路徑，同時讓文章使用較小的交付版本
5. EXIF、ICC 色彩設定、版權與攝影工作流可能需要保留。最佳化服務常會移除 metadata，因此必須把「網站交付版本」和「原始資產」分開
6. 上傳時轉檔會增加等待時間與伺服器 CPU；交付時轉檔則可快取熱門版本，並依實際流量生成需要的版本

以上第 4–6 點是根據各服務的原檔／衍生檔與交付轉換設計所做的工程推論，不代表每個服務的內部成本模型

## Comparison boundary for this project

本專案的 97.20% 是「瀏覽器端先縮放至 2048px，再以 WebP 85 編碼」的端到端結果，包含尺寸、格式與品質三個變因。若要和其他服務公平比較，至少要固定：

- 相同原始照片
- 相同輸出長邊
- 相同或可比的品質設定
- 是否包含 metadata
- 比較儲存檔還是實際交付檔

因此目前最準確的結論是：High preset 對這組直出旅遊照片在 Blog 尺寸用途下，把容量降低 97.20%，而不是宣稱線上圖床平均會降低 97.20%

## Sources

- [Cloudinary: Optimize Images](https://cloudinary.com/documentation/image_optimization)
- [Cloudinary: Eager and incoming transformations](https://cloudinary.com/documentation/eager_and_incoming_transformations)
- [ImageKit: Image optimization](https://imagekit.io/docs/image-optimization)
- [Imgur: What files can I upload? Is there a size limit?](https://help.imgur.com/hc/en-us/articles/26511665959579-What-files-can-I-upload-Is-there-a-size-limit)
- [WordPress.com: Optimizing media uploads](https://apps.wordpress.com/support/mobile/images-video-and-audio/media-optimization-settings/)
- [WordPress.com: Optimize your images](https://wordpress.com/support/media/image-optimization/)
