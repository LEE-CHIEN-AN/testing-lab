import { test, expect } from '@playwright/test';

test.describe('Todo Page', () => {
    const BASE_URL = 'http://localhost:5173';

    test('should add a new todo and append it to the list', async ({ page }) => {
        // 1. Mock initial empty todo list
        await page.route('**/api/v1/todos', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ todos: [] }),
                });
            }
        });

        await page.goto(BASE_URL);

        // 2. Mock POST and subsequent GET
        const newTodo = {
            id: 'mock-id-1',
            name: 'Buy milk',
            description: 'Go to the store and buy milk',
            status: false,
        };

        await page.route('**/api/v1/todos', async (route) => {
            const method = route.request().method();
            if (method === 'POST') {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({ todo: newTodo }),
                });
            } else if (method === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ todos: [newTodo] }),
                });
            }
        });

        // 3. User types todo name and description
        await page.getByPlaceholder('Name').fill('Buy milk');
        await page.getByPlaceholder('Description').fill('Go to the store and buy milk');

        // 4. Click the Add Todo button
        await page.getByRole('button', { name: 'Add Todo' }).click()

        // 5. Verify the created todo item appears in the list
        const todoItemName = page.getByRole('heading', { name: 'Buy milk' });
        const todoItemDesc = page.getByText('Go to the store and buy milk');

        await expect(todoItemName).toBeVisible();
        await expect(todoItemDesc).toBeVisible();

        // 6. Verify input fields are cleared
        await expect(page.getByPlaceholder('Name')).toHaveValue('');
        await expect(page.getByPlaceholder('Description')).toHaveValue('');
    });

    test('should disable Add Todo button until both name and description are provided', async ({ page }) => {
        await page.route('**/api/v1/todos', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ todos: [] }),
                });
            }
        });

        await page.goto(BASE_URL);

        const addButton = page.getByRole('button', { name: 'Add Todo' })
        await expect(addButton).toBeDisabled();

        await page.getByPlaceholder('Name').fill('Only Name');
        await expect(addButton).toBeDisabled();

        await page.getByPlaceholder('Name').fill('');
        await page.getByPlaceholder('Description').fill('Only Description');
        await expect(addButton).toBeDisabled();

        await page.getByPlaceholder('Name').fill('Both Provided');
        await expect(addButton).toBeEnabled();
    });

    test('Given a todo with status false, When click Complete, Then the todo title should have line-through style and Complete button should be hidden', async ({ page }) => {
        const todo = {
            id: 'mock-id-complete',
            name: 'Exercise',
            description: 'Go for a run',
            status: false,
        };
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
});
