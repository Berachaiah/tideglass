#!/usr/bin/env node
/**
 * Plays the economy loop in a real browser against a running dev server:
 * claims a gift, revives with keys, posts a boosted run, then starts a fresh
 * run to prove the key budget resets.
 *
 *   npm run smoke:economy          # needs `npm run dev` in another terminal
 *
 * Uses the dev-only `window.__tideglass` harness to land perfect drops, and
 * DATABASE_URL (from .env.local via the wrapper) to confirm the run reached
 * Postgres. The QA player and its runs are deleted afterwards.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import pg from "pg";

const APP_URL = process.env.SMOKE_URL ?? "http://127.0.0.1:8080/";
const SHOTS = "screenshots";
const NAME = "QaBot";
const TOKEN = "b".repeat(64);
const PERFECTS = 6;
const EXPECTED = ((PERFECTS * (PERFECTS + 1)) / 2) * 2; // perfect streak, ×2 boost

const checks = [];
function check(label, ok, detail = "") {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

mkdirSync(SHOTS, { recursive: true });

/**
 * Prefer Playwright's own build, then browsers that ship with the OS. Headless
 * launches may want the standalone headless shell, which `install chromium`
 * downloads separately and this workspace does not have.
 */
async function launchBrowser() {
  let lastError = null;
  for (const options of [{ channel: "chromium" }, { channel: "msedge" }, { channel: "chrome" }, {}]) {
    try {
      return await chromium.launch(options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("no usable Chromium build found");
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const problems = [];
page.on("console", (message) => {
  if (message.type() === "error") problems.push(message.text());
});
page.on("pageerror", (error) => problems.push(error.message));

const readSave = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("tideglass.save") ?? "{}"));
const readState = () =>
  page.evaluate(() => (window.__tideglass ? window.__tideglass.getState() : null));
const phaseIs = (phase) =>
  page.waitForFunction((want) => window.__tideglass?.getState().phase === want, phase, {
    timeout: 8000,
  });

try {
  // Generous first load: the dev server compiles route modules on demand.
  await page.goto(APP_URL, { timeout: 60_000 });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((token) => {
    localStorage.setItem(
      "tideglass.save",
      JSON.stringify({
        version: 1,
        best: 0,
        bests: {},
        difficulty: "medium",
        keys: 3,
        gifts: 2,
        lastGift: null,
        boost: 1,
        palette: "shore",
        palettes: ["shore"],
        sound: false,
        shake: false,
        name: "QaBot",
        token,
        guest: false,
        place: "off",
        streak: 0,
        lastDay: null,
      }),
    );
  }, TOKEN);
  await page.reload();
  // Clicks before hydration are swallowed, so wait for the game to mount.
  await page.waitForFunction(() => Boolean(window.__tideglass), null, { timeout: 60_000 });

  // 1. Claim day 3 of the calendar, which is a ×2 boost.
  await page.getByRole("button", { name: /gift ready/i }).click();
  const claimDay3 = page.getByRole("button", { name: /claim day 3/i });
  await claimDay3.waitFor({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/economy-gift.png` });
  await claimDay3.click();
  let save = await readSave();
  check("gift day claimed", save.gifts === 3, `gifts=${save.gifts}`);
  check("boost banked", save.boost === 2, `boost=${save.boost}`);
  await page.getByRole("button", { name: /close daily gifts/i }).click();

  // 2. Play a boosted run: six perfect drops, the free second chance, then the
  //    miss that ends it.
  await page.getByRole("button", { name: /start stacking/i }).click();
  await phaseIs("play");
  for (let i = 0; i < PERFECTS; i++) {
    await page.evaluate(() => window.__tideglass.dropPerfect());
    await page.waitForTimeout(260);
  }
  await page.evaluate(() => window.__tideglass.dropMiss());
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__tideglass.dropMiss());
  await phaseIs("over");

  let consumed = true;
  try {
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem("tideglass.save") ?? "{}").boost === 1,
      null,
      { timeout: 5000 },
    );
  } catch {
    consumed = false;
  }
  save = await readSave();
  check("boost consumed by the run", consumed, `boost=${save.boost}`);
  await page.waitForTimeout(700); // let the sheet finish fading in
  await page.screenshot({ path: `${SHOTS}/economy-over.png` });

  // 3. Spend both keys; the third attempt must not be offered.
  const startKeys = save.keys;
  for (const expectedLeft of [startKeys - 1, startKeys - 2]) {
    await page.getByRole("button", { name: /keep stacking/i }).click();
    await phaseIs("play");
    const keysNow = (await readSave()).keys;
    check(`revive spent a key (${expectedLeft} left)`, keysNow === expectedLeft, `keys=${keysNow}`);
    await page.screenshot({ path: `${SHOTS}/economy-revived.png` });
    await page.evaluate(() => window.__tideglass.dropMiss());
    await page.waitForTimeout(1000);
    await phaseIs("over");
  }
  check("revive limit enforced", !(await page.getByRole("button", { name: /keep stacking/i }).isVisible()));
  const survivor = await readState();
  check("score survived both revives", survivor.score === EXPECTED, `score=${survivor.score}`);

  // 4. The boosted run reached Postgres.
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let row = null;
  for (let i = 0; i < 24 && !row; i++) {
    await page.waitForTimeout(500);
    const result = await pool.query(
      `select r.score, r.drops, r.boost from runs r
         join players p on p.id = r.player_id
        where p.name = $1 order by r.id desc limit 1`,
      [NAME],
    );
    row = result.rows[0] ?? null;
  }
  check("boosted run posted", Boolean(row), row ? `score=${row.score}` : "no row");
  check("posted score is the boosted score", Number(row?.score) === EXPECTED, `score=${row?.score}`);
  check("stored the multiplier", Number(row?.boost) === 2, `boost=${row?.boost}`);

  // 5. A brand-new run must get the full key budget back.
  await page.getByRole("button", { name: /stack again/i }).click();
  await phaseIs("play");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__tideglass.dropMiss());
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__tideglass.dropMiss());
  await phaseIs("over");
  const freshKeys = (await readSave()).keys;
  check(
    "new run restores the key budget",
    await page.getByRole("button", { name: /keep stacking/i }).isVisible(),
    `keys=${freshKeys}`,
  );

  await page.getByRole("button", { name: /^leaderboard$/i }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/economy-board.png` });

  check("no console errors", problems.length === 0, problems.slice(0, 2).join(" | "));

  const cleanup = await pool.query(
    "delete from runs where player_id in (select id from players where name_key = 'qabot')",
  );
  await pool.query("delete from players where name_key = 'qabot'");
  console.log(`cleanup: removed ${cleanup.rowCount} qa run(s)`);
  await pool.end();
} finally {
  await browser.close();
}

const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
