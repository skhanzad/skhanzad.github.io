import { test as base, expect } from '@playwright/test';

const chapters = ['top', 'trust', 'thread', 'architect', 'path', 'research', 'lab', 'toolkit', 'contact'];
const simulations = [
  ['ariadne', 'Project Ariadne'],
  ['gaszero', 'GasZero'],
  ['search', 'Heuristic Search'],
  ['gansemble', 'GANsemble'],
  ['iss', 'Interventional Separation Selection'],
  ['chronicles', 'Provenance Preserving Chronicles'],
  ['mesh', 'AgentMesh & Folio'],
  ['pllm', 'PLLM+'],
];

const test = base.extend({
  healthyPage: [async ({ page, baseURL }, use) => {
    const errors = [];
    const local = (url) => new URL(url).origin === new URL(baseURL).origin;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
        errors.push(message.text());
      }
    });
    page.on('response', (response) => {
      if (local(response.url()) && response.status() >= 400) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText;
      if (local(request.url()) && failure !== 'net::ERR_ABORTED') {
        errors.push(`${failure} ${request.url()}`);
      }
    });
    // Font CDN availability should not determine application regression results.
    await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
    await use(page);
    expect(errors, 'Browser errors or missing application assets').toEqual([]);
  }, { auto: true }],
});

async function ready(page, path = '/') {
  await page.goto(path);
  await expect(page.locator('[data-loader]')).toBeHidden();
  await expect(page.locator('.chamber')).toHaveCount(1);
}

test('desktop starts, preserves portfolio content, and serves public assets', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(page, '/?debug');
  await expect(page).toHaveTitle('Sourena Khanzadeh — Cognitive Trust Architect');
  await expect(page.getByRole('heading', { level: 1, name: 'Sourena Khanzadeh' })).toBeVisible();
  expect(await page.locator('[data-chapter]').evaluateAll((nodes) => nodes.map((node) => node.id))).toEqual(chapters);
  await expect(page.locator('[data-card]')).toHaveCount(8);
  expect(await page.locator('[data-card] [data-sim]').evaluateAll((nodes) => nodes.map((node) => node.dataset.sim)))
    .toEqual(simulations.map(([id]) => id));
  await expect(page.locator('html')).toHaveClass(/has-gl/);
  expect(await page.evaluate(() => window.world?.count)).toBeGreaterThan(0);

  await page.locator('.nav__links a[href="#architect"]').click();
  const portrait = page.locator('[data-portrait-toggle]');
  await portrait.click();
  await expect(portrait).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-portrait-status]')).toHaveText('released');
  await expect(page.getByRole('img', { name: 'Portrait of Sourena Khanzadeh' })).toBeVisible();
  await portrait.click();
  await expect(portrait).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-portrait-status]')).toHaveText('withheld');

  for (const [path, type] of [
    ['/resume.pdf', 'application/pdf'],
    ['/assets/img/portrait-map.png', 'image/png'],
    ['/assets/img/sourena-cut.webp', 'image/webp'],
    ['/assets/img/og.jpg', 'image/jpeg'],
    ['/assets/img/favicon.svg', 'image/svg+xml'],
  ]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBeTruthy();
    expect(response.headers()['content-type'], path).toContain(type);
  }
});

test('the trust chapter defines the title while the mind is audited, then boxed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(page, '/?debug');
  await expect(page.getByRole('heading', { level: 2, name: 'Cognitive trust architect' })).toBeAttached();
  await expect(page.locator('[data-trust-act] h3')).toHaveText(['Cognitive', 'Trust', 'Architect']);

  const pin = await page.evaluate(() => {
    const section = document.querySelector('#trust');
    const spacer = section.parentElement;
    return { top: spacer.getBoundingClientRect().top + window.scrollY, length: spacer.offsetHeight - section.offsetHeight };
  });
  expect(pin.length).toBeGreaterThan(0);
  const readout = page.locator('[data-trust-readout]');
  for (const [fraction, text] of [
    [0.1, 'mind · unexamined'],
    [0.45, /^audit · do\(x\) · slice \d+ of 26$/],
    [0.8, /^structure · \d+ of 12 edges$/],
    [0.99, 'glass box · verified ✓'],
  ]) {
    await page.evaluate((y) => window.lenis.scrollTo(y, { immediate: true, force: true }), pin.top + fraction * pin.length);
    await expect(readout).toHaveText(text);
  }
  // By the end the mind is lucid throughout and its box is built.
  await expect.poll(() => page.evaluate(() => window.world.particles.sim.uLucidA.value.toArray())).toEqual([-9, 1, 0, 1]);
  await expect(page.locator('[data-trust-dim].is-on')).toHaveCount(3);
});

test('research simulations load, run an audit, navigate, and restore focus on close', async ({ page }) => {
  await ready(page, '/#research');
  const trigger = page.locator('[data-card] [data-sim="ariadne"]');
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#sim\/ariadne$/);
  await expect.poll(() => page.locator('main').evaluate((node) => Boolean(node.closest('[inert]')))).toBe(true);
  await expect(dialog.getByRole('radio', { name: 'Instant', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: 'Run audit' }).click();
  await expect(dialog.locator('[aria-live="polite"]')).toContainText('Audit complete.');
  await expect(dialog.locator('.sim-metric').filter({ has: page.getByText('Audited', { exact: true }) }).locator('dd')).toHaveText('30 / 30');

  for (const [id, title] of simulations.slice(1)) {
    await dialog.getByRole('button', { name: 'Next simulation' }).click();
    await expect(page).toHaveURL(new RegExp(`#sim/${id}$`));
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(title);
    await expect(dialog.locator('[data-stage] canvas')).toBeVisible();
    await expect(dialog.locator('[data-panel] .sim-sec').first()).toBeVisible();
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/#research$/);
  await expect.poll(() => page.locator('main').evaluate((node) => Boolean(node.closest('[inert]')))).toBe(false);
  await expect(trigger).toBeFocused();
  await page.evaluate(() => { location.hash = '#sim/gaszero'; });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('GasZero');
  await expect(dialog.locator('[data-stage] canvas')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('mobile menu navigates and the lab distinguishes the agents', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const toggle = page.locator('[data-menu-toggle]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-menu]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.locator('[data-menu] a[href="#lab"]').click();
  await expect(page).toHaveURL(/#lab$/);
  await expect(page.locator('[data-menu]')).toBeHidden();
  await expect(page.locator('#lab')).toBeFocused();

  const lab = page.locator('[data-lab]');
  await lab.locator('[data-do="days"]').click();
  await expect(lab.locator('[data-answer]')).toHaveText('Refund approved');
  await expect(lab.locator('.verdict__title')).toHaveText('Faithful');
  await lab.getByRole('tab', { name: 'Agent β' }).click();
  await expect(lab.locator('[data-answer]')).toHaveText('Refund denied');
  await expect(lab.locator('.verdict__title')).toHaveText('Faithfulness violation');
  await lab.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(lab.locator('.verdict__title')).toHaveText('Awaiting intervention');
  await expect(lab.locator('[data-do="days"]')).toHaveAttribute('aria-pressed', 'false');
});

test('without WebGL, reduced motion keeps the portrait and deep-linked simulation usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl2' || type === 'webgl' ? null : original.call(this, type, ...args);
    };
  });
  await ready(page, '/#sim/ariadne');
  await expect(page.locator('html')).toHaveClass(/no-gl/);
  await expect(page.locator('[data-portrait]')).toHaveClass(/is-revealed/);
  await expect(page.locator('[data-portrait-status]')).toHaveText('released');
  await expect(page.locator('[data-portrait-toggle]')).toBeHidden();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Run audit' }).click();
  await expect(dialog.locator('[aria-live="polite"]')).toContainText('Audit complete.');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await page.locator('[data-portrait]').scrollIntoViewIfNeeded();
  await expect(page.getByRole('img', { name: 'Portrait of Sourena Khanzadeh' })).toBeVisible();
});
