# Upload Image Processing 與 CDN 快取 PRD

## 目標

將 Upload panel 的圖片設定升級成不阻塞 UI、可預設切換、可控格式與銳化、可量測成效的上傳前處理流程，同時維持 GIF 動畫與圖片刪除後立即失效

## 使用者情境

- High：最長邊 2048px、品質 85、銳化 Mid、WebP
- Standard：最長邊 1600px、品質 80、銳化 Low、WebP
- Fast：最長邊 1000px、品質 70、銳化 Off、WebP
- Custom：手動調整任一參數後自動切換

## 功能範圍

- Preset 使用單一選單
- Maximum long edge 使用 320–8192px 拉桿，依原始比例計算寬高且不放大小圖
- WebP quality 使用 10–100 拉桿
- Sharpen 提供 Off／Low／Mid／High，amount 分別為 0／0.2／0.4／0.7
- Format 提供 Original／WebP；Original 完全保留原始檔並略過 resize、sharpen 與 encode
- GIF 一律保留原始檔，避免破壞動畫
- Tooltip 支援 hover 與 keyboard focus，延遲顯示
- WebP 管線依序執行 Resize → Unsharp Mask → Encode
- 優先使用 Web Worker 與 OffscreenCanvas；不支援或 Worker 失敗時回退主執行緒 Canvas
- Unsharp Mask 只保留相鄰三列的 row buffer，避免複製整張大型像素陣列
- 每次處理後釋放 ImageBitmap 並將 Canvas 尺寸歸零
- 確認視窗顯示原始／輸出容量、縮減比例、尺寸與處理時間
- 圖片處理偏好保存在 localStorage
- Worker 與 R2 物件回應提供需重新驗證的 CDN cache headers 及 ETag
- 正式部署使用 R2 Custom Domain；`r2.dev` 僅供測試

## 明確不做

- 不新增 Squoosh Wasm 或其他 production dependency；原生 WebP encoder 已涵蓋目前需求
- 不保留 Settings 對話框、設定 import／export、版本欄位或舊設定 migration；圖片控制項集中在 Upload panel
- 不加入獨立寬度／高度輸入，避免和「最長邊等比例」產生衝突
- 不使用只在單一 Cloudflare data center 生效的 `caches.default` 作為全域 CDN cache
- 不使用長效 fresh TTL，避免圖片刪除後仍可從 edge 取得

## 驗收條件

1. 選擇 High／Standard／Fast 時所有參數同步更新
2. 修改 long edge、quality、sharpen 或 format 後 preset 顯示 Custom
3. 4000×3000 圖片在 long edge 1600 時顯示 1600×1200
4. Original 與 GIF 停用無效控制項，並保留原始檔案
5. 支援 Worker 時不在 UI thread 執行 Canvas 管線；不支援時仍可完成處理
6. 確認視窗顯示處理耗時
7. 圖片回應保留 ETag、瀏覽器 revalidation 與 Cloudflare CDN revalidation 指令
8. `pnpm check` 通過，桌面與 390px 無水平溢出、控制項可操作、console 無錯誤
