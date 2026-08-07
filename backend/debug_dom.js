/**
 * Debug script: open Upstash /redis page, wait for content, dump all hrefs and relevant HTML.
 * Run: HEADLESS=false bun debug_dom.js
 */
import puppeteer from "puppeteer";
import fs from "fs";

const browser = await puppeteer.launch({
  headless: process.env.HEADLESS !== "false",
  executablePath: "/home/nishu/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome",
  defaultViewport: { width: 1366, height: 900 },
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

console.log("Navigating to https://console.upstash.com/redis ...");
await page.goto("https://console.upstash.com/redis", { waitUntil: "networkidle2", timeout: 30000 }).catch(e => console.log("goto error:", e.message));

console.log("URL:", page.url());

// Wait up to 15s for any links to appear
console.log("Waiting for links...");
await page.waitForFunction(
  () => document.querySelectorAll("a[href]").length > 2,
  { timeout: 15000 }
).catch(() => console.log("timeout waiting for links"));

// Dump all hrefs
const hrefs = await page.evaluate(() =>
  Array.from(document.querySelectorAll("a[href]")).map(a => ({ href: a.getAttribute("href"), text: (a.textContent || "").trim().substring(0, 40) }))
);
console.log("\n=== ALL HREFS ===");
hrefs.forEach(h => console.log("  " + h.href + "  |  " + h.text));

// Check for non-anchor clickable elements that might be DB rows
const clickables = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[class*="cursor"], [role="button"], tr, [class*="row"], [class*="card"], [class*="item"]'))
    .filter(el => el.textContent && el.textContent.trim().length > 3 && el.textContent.trim().length < 200)
    .slice(0, 30)
    .map(el => ({
      tag: el.tagName,
      cls: (el.className || "").substring(0, 80),
      text: (el.textContent || "").trim().substring(0, 60)
    }))
);
console.log("\n=== CLICKABLE / ROW ELEMENTS ===");
clickables.forEach(c => console.log("  <" + c.tag + ' class="' + c.cls + '">  ' + c.text));

// Body text excerpt
const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
console.log("\n=== BODY TEXT EXCERPT ===\n" + bodyText);

// Full HTML excerpt
const html = await page.evaluate(() => document.body.innerHTML.substring(0, 5000));
console.log("\n=== BODY HTML EXCERPT ===\n" + html);

// Save to file
fs.writeFileSync("/tmp/upstash_debug_dom.txt", JSON.stringify({ hrefs, clickables, bodyText, html }, null, 2));
console.log("\nFull dump saved to /tmp/upstash_debug_dom.txt");

await browser.close();
