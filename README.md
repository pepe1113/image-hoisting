[繁體中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="apps/web/public/icon.png" height="100" style="border-radius:20px;margin:30px 0;">
  <h1 align="center">R2 Image Hosting</h1>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2.8-20232A?logo=react&logoColor=61DAFB" alt="React 19.2.8" />
  <img src="https://img.shields.io/badge/TypeScript-6.0.3-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0.3" />
</p>

一個適合部落格、技術文件與 Markdown 文章使用的小型自架圖片託管工具（圖床）

[線上 Demo](https://image.demo.peiwang.dev/)

> **注意：** 此 Demo 僅供展示，上傳的圖片會在 7 天內刪除

<p align="center">
  <img src="./apps/web/public/demo.gif" alt="R2 Image Hosting upload workspace" width="500" />
</p>

## 💡 為什麼做

我寫部落格時一直在找圖床，想要不靠第三方、自己掌控圖片。所以做了這個工具：把圖片拖曳或貼到頁面，在瀏覽器中優化後上傳到自己的 Cloudflare R2，再直接複製 Markdown 語法或網址。R2 bucket 的憑證留在伺服器端，不會進到瀏覽器。

## ✨ 功能

- **上傳：** 拖曳單一檔案，或用 `Command + V`／`Ctrl + V` 貼上，上傳前先預覽
- **處理確認：** 比較尺寸、檔案大小與處理時間；可選 High、Standard、Fast，或自訂最長邊、WebP 品質與銳化強度
- **上傳結果：** 可輸入顯示檔名或產生八字元隨機名稱，成功後顯示圖片、Markdown 與網址
- **Profiles：** 切換不同 R2 bucket，並透過介面產生新的伺服器端 profile 設定
- **標籤與搜尋：** 新增標籤，並依標籤搜尋圖片
- **Gallery 與 List：** 滿版 Masonry Gallery 會在捲動時載入更多，List 則方便閱讀與管理
- **編輯與刪除：** 修改顯示檔名不會改變圖片網址；也可從圖片庫刪除圖片

## 🛠️ 怎麼做的

- **瀏覽器端處理：** 縮放、銳化與 WebP 編碼在 Web Worker 執行，並保留原生 Canvas fallback，不加入圖片 codec dependency
- **單一入口：** Gateway Worker 一次部署 Web assets 與 API，Contracts 只放兩個 app 共用的資料、限制與錯誤格式
- **伺服器端驗證：** 檢查實際檔案特徵，不只信任瀏覽器提供的 MIME type；因 SVG 可能含可執行腳本而不支援
- **多 bucket 不洩漏憑證：** 每個 profile 對應一個 R2 bucket，設定都在伺服器端；管理 API 由 Cloudflare Access 保護，Worker 逐請求驗證 JWT，設定不完整時一律拒絕
- **CI 與監控：** GitHub Actions 執行 `pnpm check`，部署後檢查 `/health`；Sentry source map 在部署前刪除

## 📊 效能測試

2026-09-06 以 10 張 Fujifilm X-T30 II JPEG（6240×3512）測試，環境為 MacBook Air（Apple M2、8 GB）、Chromium，High 設定（長邊 2048px、WebP 85、Mid sharpening）；每張處理三次取中位數；處理時間包含解碼、縮放、銳化與 WebP 編碼，不含上傳。

- 總大小：70.29 MiB → 1.97 MiB
- 整體節省比例：97.20%
- 每張處理時間中位數：435 ms

## 🧰 技術

React、TypeScript、Vite｜Cloudflare Workers、Cloudflare R2｜Vitest｜pnpm workspace｜GitHub Actions、Sentry

## 🚀 快速開始

需要 Node.js 22 以上版本

```bash
pnpm install
cp .dev.vars.example .dev.vars
cp wrangler.jsonc.example wrangler.jsonc
```

將 `.dev.vars` 中的 `you@example.com` 改成你的 email，再啟動專案：

```bash
pnpm dev
```

在瀏覽器開啟 [http://127.0.0.1:5173](http://127.0.0.1:5173)。設定、Cloudflare Access、Profile、API、部署與安全請見 [SETUP.md](SETUP.md)

## 📁 專案結構

| 路徑 | 說明 |
| --- | --- |
| [`apps/web`](apps/web) | React 與 TypeScript 瀏覽器介面 |
| [`apps/gateway`](apps/gateway) | Gateway Worker：唯一公開入口，提供網站與圖片 API |
| [`packages/contracts`](packages/contracts) | 兩個 app 共用的資料、限制與錯誤格式 |

## 📄 授權

MIT。請參考 [LICENSE](LICENSE)。
