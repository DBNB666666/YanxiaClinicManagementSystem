import type { APIRequestContext, Page } from '@playwright/test'

const API_SCRIPT = `
(() => {
  const namespaces = {
    app: ['getInfo'],
    settings: ['get', 'set'],
    drugs: ['list', 'get', 'create', 'update', 'setStatus', 'remove', 'purchase', 'lowStockCount'],
    combos: ['list', 'get', 'create', 'update', 'remove'],
    prescriptions: ['list', 'get', 'create', 'update', 'remove'],
    finance: ['summary', 'details'],
    notifications: ['list', 'unreadCount', 'markRead', 'markAllRead'],
    print: ['printPrescription', 'exportPdf']
  };
  async function call(ns, method, args) {
    const response = await fetch('/api/' + ns + '.' + method, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ args })
    });
    const json = await response.json();
    if (!json.ok) {
      const error = new Error(json.error.message || '请求失败');
      error.code = json.error.code;
      error.details = json.error.details;
      throw error;
    }
    return json.data;
  }
  const api = {};
  for (const [ns, methods] of Object.entries(namespaces)) {
    api[ns] = {};
    for (const method of methods) {
      api[ns][method] = (...args) => call(ns, method, args);
    }
  }
  window.api = api;
})();
`

export async function resetData(
  request: APIRequestContext,
  seed: 'default' | 'empty' = 'default'
): Promise<void> {
  const response = await request.post('/api/__reset', { data: { seed } })
  if (!response.ok()) throw new Error(`reset failed: ${response.status()}`)
}

export async function openApp(
  page: Page,
  path = '/',
  waitFor = '[data-testid="prescription-page"]'
): Promise<void> {
  await page.addInitScript(API_SCRIPT)
  await page.goto(path)
  await page.waitForSelector(waitFor)
}

export async function waitForToast(page: Page, text?: string): Promise<void> {
  const locator = page.locator('.toast')
  await locator.first().waitFor()
  if (text) await locator.filter({ hasText: text }).first().waitFor()
}

export async function apiCall<T = unknown>(
  request: APIRequestContext,
  ns: string,
  method: string,
  args: unknown[] = []
): Promise<T> {
  const response = await request.post(`/api/${ns}.${method}`, { data: { args } })
  const json = (await response.json()) as
    | { ok: true; data: T }
    | { ok: false; error: { message: string; code: string } }
  if (!json.ok) throw new Error(json.error.message)
  return json.data
}
