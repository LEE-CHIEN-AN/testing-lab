# 測試說明報告

## 1. 測試範圍

本報告涵蓋兩個測試案例，分別針對 **Backend（API 層）** 與 **Frontend（E2E UI 層）**，以驗證 Todo 應用程式的核心功能正確性。

---

## 2. 測試工具

| 層級 | 工具 | 版本 | 用途 |
|------|------|------|------|
| Backend | [Vitest](https://vitest.dev/) | v4.1.2 | 單元 / 整合測試框架 |
| Backend | `@vitest/coverage-v8` | v4.1.2 | 程式碼覆蓋率報告 |
| Backend | Fastify `server.inject()` | — | 不需啟動真實 HTTP 伺服器即可發送請求 |
| Frontend | [Playwright](https://playwright.dev/) | v1.51.0 | End-to-End 瀏覽器自動化測試框架 |
| Frontend | Playwright `page.route()` | — | 攔截並 mock 瀏覽器發出的 API 請求 |

---

## 3. 測試案例一：Backend — POST /api/v1/todos 成功建立 Todo

### 3.1 測試檔案

`backend/test/todo.post.spec.ts`

### 3.2 程式碼片段

```typescript
test('Given valid name and description, When receive a POST /api/v1/todos request, Then it should response with status code 201 and the created todo', async () => {
  // arrange: mock the repo function to return the created todo
  const createdTodo: Todo = {
    id: 'mock-id-1',
    name: 'Buy groceries',
    description: 'Go to the supermarket',
    status: false
  }
  const createSpy = vi.spyOn(TodoRepo, 'createTodo').mockResolvedValue(createdTodo)

  // act: send POST /api/v1/todos with valid body
  const response = await server.inject({
    method: 'POST',
    url: '/api/v1/todos',
    payload: JSON.stringify({ name: 'Buy groceries', description: 'Go to the supermarket' }),
    headers: { 'Content-Type': 'application/json' }
  })

  // assert: status 201 and body contains the created todo
  expect(response.statusCode).toBe(201)
  const result = JSON.parse(response.body)['todo']
  expect(result).toStrictEqual(createdTodo)

  // assert: repo was called exactly once with the correct payload
  expect(createSpy).toHaveBeenCalledTimes(1)
  expect(createSpy).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Buy groceries', description: 'Go to the supermarket' })
  )
})
```

### 3.3 測試策略

**測試場景（Given / When / Then）**

| 角色 | 說明 |
|------|------|
| **Given** | 使用 `vi.spyOn(TodoRepo, 'createTodo').mockResolvedValue(...)` 模擬資料庫寫入，不需連接真實 MongoDB |
| **When** | 透過 `server.inject()` 對 `POST /api/v1/todos` 送出包含 `name` 與 `description` 的 JSON body |
| **Then** | HTTP status 為 201，response body 的 `todo` 欄位與 mock 回傳值完全一致；且 `createTodo` 恰好被呼叫一次，且呼叫參數包含正確的欄位 |

**測試主體**：`TodoRouter`（路由層）→ `addTodo` service（服務層），資料層以 spy 隔離

**Mock / 隔離策略**：
- 使用 `vi.spyOn` 替換 `TodoRepo.createTodo`，完全跳過 Mongoose / MongoDB
- `afterEach` 呼叫 `vi.resetAllMocks()`，確保各測試案例互不干擾
- `server.inject()` 在記憶體內模擬 HTTP 請求，不需啟動網路監聽，測試速度快且無副作用

**想驗證的東西**：
1. 路由正確將 request body 傳遞給 service，再由 service 傳給 repo
2. 成功建立時回傳 **HTTP 201**（而不是 200）
3. response body 結構正確（包在 `todo` key 下）
4. `createTodo` 被呼叫的次數與參數正確（防止漏呼叫或傳錯參數）

### 3.4 執行指令

```bash
cd backend
npm test
```

### 3.5 測試結果截圖

> **截圖位置**：在 `backend/` 目錄執行 `npm test` 後，截取終端機輸出（包含 `✓ todo.post.spec.ts` 通過的綠色結果行，以及 Coverage 摘要表格）。
>
> 預期看到：`Test Files  4 passed (4)`、`Tests  12 passed (12)`

---

## 4. 測試案例二：Frontend E2E — 點擊 Complete 後 Todo 切換至完成狀態

### 4.1 測試檔案

`frontend/tests/todo.spec.ts`（第 91 行起）

### 4.2 程式碼片段

```typescript
test('Given a todo with status false, When click Complete, Then the todo title should have line-through style and Complete button should be hidden', async ({ page }) => {
    const todo = { id: 'mock-id-complete', name: 'Exercise', description: 'Go for a run', status: false };
    const completedTodo = { ...todo, status: true };

    // 1. Mock initial GET: return one incomplete todo
    await page.route('**/api/v1/todos', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ todos: [todo] }),
        });
    });

    // 2. Mock PUT (update status) → 200
    await page.route(`**/api/v1/todos/${todo.id}`, async (route) => {
        if (route.request().method() === 'PUT') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ todo: completedTodo }),
            });
        }
    });

    await page.goto(BASE_URL);

    // 3. Verify the todo is initially visible with no line-through
    const heading = page.getByRole('heading', { name: 'Exercise' });
    await expect(heading).toBeVisible();
    await expect(heading).not.toHaveClass('line-through');

    // 4. Re-route GET to return the completed todo before clicking Complete
    await page.route('**/api/v1/todos', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ todos: [completedTodo] }),
        });
    });

    // 5. Click Complete button
    await page.getByRole('button', { name: 'Complete' }).click();

    // 6. Assert: title has line-through CSS class
    await expect(heading).toHaveClass('line-through');

    // 7. Assert: Complete button is hidden (has hide-button class, which sets display:none)
    const completeButton = page.locator('button', { hasText: 'Complete' });
    await expect(completeButton).toBeHidden();
});
```

### 4.3 測試策略

**測試場景（Given / When / Then）**

| 角色 | 說明 |
|------|------|
| **Given** | 以 `page.route('**/api/v1/todos', ...)` mock 初始 GET 回傳 1 筆 `status:false` 的 Todo，頁面載入後即看到 "Exercise" 項目，標題無刪除線 |
| **When** | 對 `PUT /api/v1/todos/:id` route 注入 200 回應；再更新 GET mock 回傳 `status:true`；最後點擊 `Complete` 按鈕觸發 `updateTodo()` → `fetchTodos()` |
| **Then** | 標題 `<h1>` 套用 CSS class `line-through`（文字顯示刪除線）；`Complete` 按鈕取得 class `hide-button`（`display:none`），`toBeHidden()` 通過 |

**測試主體**：React 元件 `TodoItem`（`Complete` 按鈕、標題/描述的 class 邏輯）+ `App`（`handleUpdateTodo` 流程） + API 互動（axios PUT → GET）

**Mock / 隔離策略**：
- `page.route()` 在瀏覽器層攔截 API 呼叫，完全不需要真實 Backend 或 MongoDB
- 分兩階段 mock GET：第一階段回傳未完成狀態（初始渲染）、第二階段回傳完成狀態（點擊後 refetch）
- 每個測試案例各自設置 route handler，Playwright 自動在測試結束後清除

**想驗證的東西**：
1. 初始狀態：頁面正確渲染 `status:false` 的 Todo，無刪除線
2. 點擊 `Complete` 後：UI 正確根據 `status:true` 套用 `line-through` class（視覺反饋）
3. 點擊 `Complete` 後：`Complete` 按鈕被 CSS class `hide-button`（`display:none`）隱藏，防止重複點擊
4. 驗證整個 UI 更新流程：`click → PUT API → GET refetch → React 重新渲染` 的完整鏈路

### 4.4 執行指令

```bash
# 終端機 1：啟動前端 dev server
cd frontend
npm run dev

# 終端機 2：執行 E2E 測試
cd frontend
npx playwright test --project=chromium tests/todo.spec.ts

# 產生並開啟 HTML 報告
npx playwright show-report
```

### 4.5 測試結果截圖

> **截圖 1**：終端機輸出 `3 passed (12.5s)` 的 Playwright 測試結果。
>
> **截圖 2**：`npx playwright show-report` 開啟 HTML report 後，截取總覽頁，可看到 3 個測試案例（含新增的 "Given a todo with status false..." 那筆）皆顯示綠色通過。

---

## 5. 架構說明

```
測試案例一（Backend）：
  test → server.inject(POST) → TodoRouter → addTodo (service) → [spy] TodoRepo.createTodo
                                                                          ↓ mockResolvedValue
                                                                    { id, name, desc, status }

測試案例二（Frontend E2E）：
  Playwright browser → page.goto(5173) → React App render
       ↓ page.route mock GET          ↓ render TodoItem (status:false)
                                      ↓ click Complete
       ↓ page.route mock PUT (200)    ↓ App.handleUpdateTodo → axios.put
       ↓ page.route mock GET          ↓ App.fetchTodos → axios.get → re-render
                                      ↓ TodoItem (status:true): line-through + hide-button
```

---

## 6. 小結

| 面向 | 測試案例一（Backend POST） | 測試案例二（Frontend Complete） |
|------|------|------|
| 測試類型 | 整合測試（API 路由 + Service） | E2E 測試（UI + API 完整流程） |
| 隔離層 | Repo 層（vi.spyOn mock） | 網路層（page.route mock） |
| 驗證重點 | HTTP status、response body 結構、repo 呼叫次數與參數 | CSS class 變化、元素可見性 |
| 不依賴 | MongoDB | 真實 Backend、MongoDB |
