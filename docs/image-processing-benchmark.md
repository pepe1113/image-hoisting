# Image Processing Benchmark

- 測試日期：2026-09-06
- 樣本：10 張 Fujifilm X-T30 II 旅遊 JPEG 直出照片
- 原始尺寸：6240×3512；直式照片依 EXIF 方向處理為 3512×6240
- 環境：MacBook Air（Apple M2、8 GB），Chromium 瀏覽器
- 設定：High（長邊 2048px、WebP 85、Mid sharpening）
- 方法：每張處理三次，表格記錄處理時間中位數
- 範圍：處理時間包含瀏覽器端解碼、縮放、銳化與 WebP 編碼，不包含上傳

| 圖片 | 原始大小 | 處理後大小 | 節省比例 | 處理時間中位數 |
| --- | ---: | ---: | ---: | ---: |
| DSCF0219.JPG | 12.20 MiB (12796465 bytes) | 246.25 KiB (252160 bytes) | 98% | 566 ms |
| DSCF0226.JPG | 9.95 MiB (10438367 bytes) | 157.49 KiB (161274 bytes) | 98% | 491 ms |
| DSCF0329.JPG | 5.68 MiB (5959817 bytes) | 162.64 KiB (166544 bytes) | 97% | 432 ms |
| DSCF0400.JPG | 7.47 MiB (7836308 bytes) | 220.03 KiB (225312 bytes) | 97% | 483 ms |
| DSCF0564.JPG | 6.96 MiB (7294436 bytes) | 282.55 KiB (289332 bytes) | 96% | 477 ms |
| DSCF0565.JPG | 6.56 MiB (6883844 bytes) | 177.46 KiB (181724 bytes) | 97% | 426 ms |
| DSCF0627.JPG | 5.23 MiB (5488886 bytes) | 138.82 KiB (142150 bytes) | 97% | 427 ms |
| DSCF0652.JPG | 5.71 MiB (5984598 bytes) | 232.51 KiB (238092 bytes) | 96% | 430 ms |
| DSCF0688.JPG | 4.93 MiB (5171293 bytes) | 175.65 KiB (179866 bytes) | 97% | 427 ms |
| DSCF0715.JPG | 5.58 MiB (5850469 bytes) | 220.48 KiB (225768 bytes) | 96% | 438 ms |

## Summary

- 原始總大小：70.29 MiB（73704483 bytes）
- 處理後總大小：1.97 MiB（2062222 bytes）
- 減少大小：68.32 MiB（71642261 bytes）
- 整體節省比例：97.20%
- 每張處理時間中位數的中位數：435 ms
- 10 張依各自中位數完成約需：4.60 秒
