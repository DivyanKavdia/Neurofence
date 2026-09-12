const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const resultsDir = path.join(root, 'test-results');
fs.mkdirSync(resultsDir, { recursive: true });
const completed = [], errors = [];
const check = (condition, label) => { assert.ok(condition, label); completed.push(label); };
const views = {
  overview: [], inventory: [], workforce: [],
  gateway: ['Overview', 'Providers & models', 'Routes', 'Applications & keys', 'Traces', 'Playground'],
  guardrails: ['Overview', 'Policy builder', 'Simulator'],
  agents: ['Agents', 'MCP catalog', 'Tool playground', 'Tool traces'],
  budgets: ['Overview', 'Budget hierarchy', 'Usage ledger'], incidents: [],
  assurance: ['Red team', 'Supply chain'], governance: ['Approvals', 'Audit trail', 'Settings', 'Roles'],
};
let browser;

(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.NEUROFENCE_BROWSER_PATH ? { executablePath: process.env.NEUROFENCE_BROWSER_PATH } : {}),
    ...(process.env.NEUROFENCE_SOFTWARE_RENDERING === '1' ? { args: ['--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer', '--disable-features=Vulkan', '--use-gl=disabled'] } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  const action = name => page.locator(`[data-action="${name}"]`);
  const nav = async (name, tab) => { await page.locator(`#sidebar [data-page="${name}"]`).click(); if (tab) await page.getByRole('tab', { name: tab, exact: true }).click(); };
  const role = value => page.locator('#role-preview').selectOption(value);
  const submit = name => page.locator(`form[data-form="${name}"] button[type="submit"]`).click();
  const close = () => page.getByLabel('Close dialog', { exact: true }).click();
  const trace = () => page.evaluate(() => state.traces[0]);
  const url = pathToFileURL(path.join(root, 'index.html')).href;
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  check(await page.evaluate(() => document.fonts.check('700 14px Manrope')), 'Embedded typeface loads without a network request');

  for (const target of ['inventory', 'gateway', 'guardrails', 'budgets']) {
    await nav('overview');
    await page.locator(`.stat-link[data-page="${target}"]`).click();
    assert.equal(await page.evaluate(() => ui.page), target);
  }
  check(true, 'All four command-center metrics open their related records');
  await nav('overview');
  await page.locator('#period').selectOption('1');
  check((await page.locator('.trend').getAttribute('aria-label')).includes('1-day'), '24-hour selection updates the activity chart');
  await page.locator('#period').selectOption('30');
  check((await page.locator('.trend').getAttribute('aria-label')).includes('30-day'), '30-day selection updates the activity chart');

  for (let i = 0; i < 9; i++) {
    await page.locator('#sidebar [data-action="guide"]').click();
    await page.locator(`[data-action="guide-start"][data-index="${i}"]`).click();
    check(await page.evaluate(i => ui.page === journeys[i][2] && ui.role === journeys[i][4], i), `Guided journey ${i + 1} opens its view and demo role`);
  }
  await role('Platform admin');
  await nav('gateway', 'Providers & models');
  await action('new-provider').click();
  await page.locator('#provider-name').fill('Experience India deployment');
  await submit('provider-step');
  await page.locator('#provider-model').fill('Experience Chat');
  await action('provider-back').click();
  assert.equal(await page.locator('#provider-name').inputValue(), 'Experience India deployment');
  await submit('provider-step');
  assert.equal(await page.locator('#provider-model').inputValue(), 'Experience Chat');
  await submit('provider-step');
  await action('provider-back').click();
  await submit('provider-step');
  await action('provider-create').click();
  const provider = await page.evaluate(() => state.providers.at(-1));
  check(provider.model === 'Experience Chat', 'Provider wizard supports back navigation without losing values');

  await nav('gateway', 'Routes');
  await action('new-route').click();
  await page.locator('#route-name').fill('Experience route');
  await page.locator('#route-alias').fill('experience-chat');
  await page.locator('#route-primary').selectOption(provider.id);
  await page.locator('#route-fallback').selectOption('azure');
  await submit('route-save');
  const route = await page.evaluate(() => state.routes.at(-1));
  check(route.alias === 'experience-chat' && route.version === 1, 'New route binds primary and fallback providers');

  await nav('budgets', 'Budget hierarchy');
  await action('new-budget').click();
  await page.locator('#budget-name').fill('Experience budget');
  await page.locator('#budget-limit').fill('100');
  await submit('budget-save');
  const budget = await page.evaluate(() => state.budgets.at(-1));
  check(budget.parent === 'org' && budget.hard, 'New budget creates a hard limit under its parent');

  await nav('gateway', 'Applications & keys');
  await action('new-project').click();
  await page.locator('#project-name').fill('Experience copilot');
  await page.locator('#project-owner').fill('Priya Shah');
  await page.locator('#project-route').selectOption(route.id);
  await page.locator('#project-budget').selectOption(budget.id);
  await submit('project-create');
  const project = await page.evaluate(() => state.projects.at(-1));
  await action('rotate-key').click();
  check(await page.evaluate(id => state.projects.find(p => p.id === id).key, project.id) !== project.key, 'Credential rotation replaces the sample key');
  await action('test-project').click();
  await submit('model-run');
  check((await trace()).provider === provider.id && (await trace()).executed, 'New application executes through its newly created route');
  await nav('gateway', 'Applications & keys');
  await page.locator(`[data-action="project"][data-id="${project.id}"]`).first().click();
  await action('toggle-project').click();
  await page.locator(`[data-action="project"][data-id="${project.id}"]`).first().click();
  await action('test-project').click();
  await submit('model-run');
  check(!(await trace()).executed && (await trace()).decision === 'DENY', 'Paused application access blocks a subsequent model request');
  await nav('gateway', 'Applications & keys');
  await page.locator(`[data-action="project"][data-id="${project.id}"]`).first().click();
  await action('toggle-project').click();

  await nav('gateway', 'Providers & models');
  await page.locator(`[data-action="asset"][data-id="${provider.id}"]`).click();
  await action('toggle-provider').click();
  check((await page.locator('.entity-card').filter({ has: page.getByRole('heading', { name: provider.name }) }).innerText()).includes('Paused'), 'Provider card reflects its paused state');
  await nav('gateway', 'Playground');
  await page.locator('#sim-project').selectOption(project.id);
  await submit('model-run');
  check((await trace()).decision === 'ROUTE_ALTERNATE' && (await trace()).provider === 'azure', 'Paused primary provider routes the request to an eligible fallback');

  await nav('agents', 'Agents');
  await action('new-agent').click();
  await page.locator('#agent-name').fill('Experience assistant');
  await page.locator('#agent-owner').fill('Priya Shah');
  await page.locator('#agent-project').selectOption(project.id);
  await page.locator('#agent-purpose').fill('Retrieve approved internal guidance for the experience team.');
  await page.locator('#agent-steps').fill('1');
  await submit('agent-create');
  const agent = await page.evaluate(() => state.agents.at(-1));
  check(agent.project === project.id && agent.maxSteps === 1, 'Agent registration binds purpose, ownership, application and workflow limit');
  await action('new-agent').click();
  await page.locator('#agent-name').fill(agent.name);
  await page.locator('#agent-owner').fill('Priya Shah');
  await page.locator('#agent-purpose').fill('Duplicate sample');
  await submit('agent-create');
  check((await page.locator('.form-error').innerText()).includes('already exists'), 'Duplicate agent registration shows a recoverable error');
  await close();
  await nav('agents', 'Tool playground');
  await page.locator('#sim-agent').selectOption(agent.id);
  await page.locator('#sim-tool').selectOption('knowledge.search');
  await submit('tool-run');
  check((await trace()).executed, 'New agent runs a permitted tool within its budget');
  await submit('tool-run');
  check(!(await trace()).executed && (await trace()).reason.includes('step limit'), 'Workflow circuit breaker stops a second step beyond the configured cap');
  await action('new-workflow').first().click();
  await submit('tool-run');
  check((await trace()).executed, 'Starting a new workflow restores its step allowance');

  await role('Security admin');
  await nav('workforce');
  await action('edit-workforce').first().click();
  const workforceId = await page.locator('form[data-form="workforce-save"]').getAttribute('data-id');
  await page.locator('#workforce-action').selectOption('Redact');
  await page.locator('#workforce-reason').fill('Mask identifiers in the demonstration activity.');
  await submit('workforce-save');
  check(await page.evaluate(id => state.workforce.find(w => w.id === id).action === 'Redact', workforceId), 'Workforce control changes are reflected in the activity record');
  await role('Platform admin');
  await nav('governance', 'Settings');
  await page.locator('#retention-mode').selectOption('Redacted content');
  await page.locator('#retention-days').fill('30');
  await submit('settings');
  await page.reload();
  check(await page.evaluate(() => state.settings.retention === 'Redacted content' && state.settings.days === 30 && ui.tabs.governance === 'Settings'), 'Settings and the selected view survive reload');
  await nav('inventory');
  await nav('incidents');
  await page.goBack();
  await page.waitForFunction(() => ui.page === 'inventory');
  await page.goForward();
  await page.waitForFunction(() => ui.page === 'incidents');
  check(true, 'Browser back and forward restore the selected screen');

  for (const [pageName, tab, actionName, key] of [['budgets','Usage ledger','export-usage','usage'],['incidents','','export-incidents','incidents'],['governance','Settings','export-state','projects']]) {
    await nav(pageName, tab);
    const pending = page.waitForEvent('download');
    await action(actionName).click();
    const download = await pending;
    const payload = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    check(payload.prototype && Array.isArray(payload[key]) && payload[key].length > 0, `${key} export contains the prototype records`);
  }

  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const phone = await phoneContext.newPage();
  phone.setDefaultTimeout(8000);
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(url);
  await phone.getByRole('button', { name: 'More navigation' }).tap();
  check(await phone.evaluate(() => document.querySelector('.shell').inert && !document.querySelector('#sidebar').inert), 'Mobile menu traps background interaction');
  await phone.keyboard.press('Escape');
  check((await phone.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded')) === 'false', 'Escape closes the menu and updates expanded state');
  await phone.locator('#mobile-nav [data-page="gateway"]').tap();
  check(await phone.evaluate(() => ui.page === 'gateway' && ui.tabs.gateway === 'Playground'), 'Mobile Gateway shortcut opens the working request playground');
  await phone.locator('#mobile-nav [data-page="agents"]').tap();
  await phone.getByRole('tab', { name: 'Tool playground', exact: true }).tap();
  await phone.locator('#tool-form button[type="submit"]').tap();
  await phone.locator('[data-action="approval"]').tap();
  check(await phone.evaluate(() => document.querySelector('.shell').inert && document.querySelector('#mobile-nav').inert), 'Mobile review sheet traps background interaction');
  await phone.locator('[data-action="preview-reviewer"]').tap();
  await phone.locator('[data-action="deny-approval"]').tap();
  check((await phone.locator('.form-error').innerText()).includes('reason'), 'Approval review requires a decision reason');
  await phone.locator('#approval-reason').fill('Reject this sample update pending verification.');
  await phone.locator('[data-action="deny-approval"]').tap();
  await phone.locator('[data-action="resume-approved"]').tap();
  await phone.locator('#tool-form button[type="submit"]').tap();
  check(await phone.evaluate(() => state.traces[0].decision === 'DENY' && !state.traces[0].executed), 'Mobile reviewer switch and denial keep the exact tool call blocked');

  const overflow = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, tabs] of Object.entries(views)) {
      for (const tab of tabs.length ? tabs : ['']) {
        await page.evaluate(({name,tab}) => go(name,tab), {name,tab});
        const excess = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (excess > 1) overflow.push({width,name,tab,excess});
      }
    }
  }
  check(overflow.length === 0, 'All 26 views fit 320px, 390px, 768px and 1440px widths: '+JSON.stringify(overflow));
  check(errors.length === 0, 'No uncaught browser errors in the extended journeys');
  fs.writeFileSync(path.join(resultsDir, 'experience.json'), JSON.stringify({ passed: completed.length, completed, errors }, null, 2));
  console.log(JSON.stringify({ passed: completed.length, completed, errors }, null, 2));
  await browser.close();
})().catch(async error => {
  fs.writeFileSync(path.join(resultsDir, 'experience.json'), JSON.stringify({ passed: completed.length, completed, errors, failure: error.message }, null, 2));
  console.error(JSON.stringify({ completed, errors, failure: error.message }, null, 2));
  await browser?.close();
  process.exitCode = 1;
});
