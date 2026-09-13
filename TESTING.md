# 測試

## 執行

- `pnpm test`：全部 Web 與 Gateway 測試
- `pnpm test --project web`：前端測試
- `pnpm test --project gateway`：Gateway 測試
- `pnpm test --project web apps/web/test/auth.test.tsx`：指定功能
- `pnpm test:coverage`：產出終端摘要、`coverage/index.html` 與 `coverage/coverage-summary.json`
- `pnpm check`：lint、型別、全部測試、health smoke 自我測試與正式版建置

## 命名與範圍

單元測試與被測模組同名，例如 `core.test.ts`、`uploadState.test.ts`、`imageLibraryState.test.ts`。UI 整合測試依功能命名：`auth`、`workspace`、`profiles`、`upload`、`image-library`，透過 App 操作真實元件與 API client

Gateway 的 `image-api.test.ts` 透過 Worker 入口與 FakeR2Bucket 驗證請求流程；`stored-image.test.ts`、`image-dimensions.test.ts` 測模組規則

## MSW

依 [MSW 官方 Node.js 範例](https://mswjs.io/docs/integrations/node/) 分工：

- `apps/web/src/mocks/handlers.ts`：基本成功回應與具 contracts 型別的列表資料
- `apps/web/src/mocks/node.ts`：建立 server
- `apps/web/vitest.setup.ts`：啟動、每次重設 handlers、結束後關閉，以及 browser mock 清理
- 情境覆寫放在個別測試，使用 `server.use(http.get(...))` 等 method handler

未定義的請求會報錯。新增端點時需提供明確 handler；測試可使用自己的資料與暫存狀態，每個案例都重新建立可變資料

Web 使用 jsdom，Gateway 使用 Node，不載入 MSW。上傳 UI 測試驗證 XHR 回應與畫面；jsdom 與 Node 的 File 序列化差異使其不能替代真實瀏覽器的檔案傳輸驗證，實際檔案內容驗證由 Gateway 測試涵蓋

## Coverage

使用 [Vitest 官方 V8 coverage provider](https://vitest.dev/guide/coverage.html)，版本與 Vitest 一致

範圍涵蓋 `apps/*/src` 與 `packages/*/src` 的 TypeScript 原始碼，包括尚未被測試載入的程式；排除 MSW mocks 與型別宣告檔。測試、設定及 scripts 不列入分母。Coverage 是程式執行覆蓋率，不代表真實 R2、瀏覽器或部署整合已驗證
