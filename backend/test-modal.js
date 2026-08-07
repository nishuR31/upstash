import puppeteer from 'puppeteer';
import fs from "fs";
import os from "os";
import path from "path";

(async () => {
  const customCache = path.join(os.homedir(), ".cache", "puppeteer", "chrome");
  let executablePath = null;
  if (fs.existsSync(customCache)) {
    const versions = fs.readdirSync(customCache);
    if (versions.length > 0) {
      const verDir = versions[0];
      executablePath = path.join(customCache, verDir, "chrome-linux64", "chrome");
    }
  }

  const browserArgs = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  };
  if (executablePath && fs.existsSync(executablePath)) {
    browserArgs.executablePath = executablePath;
  }
  console.log("Launching browser...");
  const browser = await puppeteer.launch(browserArgs);
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 800 });

  console.log("Going to login...");
  await page.goto('https://console.upstash.com/login', { waitUntil: 'networkidle2' });

  console.log("Typing email...");
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  await page.type('input[name="email"]', 'nishanisready+5686fh@gmail.com');
  
  console.log("Typing password...");
  await page.type('input[name="password"]', 'Qwertyui12345678@dreamupstash');
  
  console.log("Submitting login...");
  await page.keyboard.press('Enter');
  
  console.log("Waiting for dashboard...");
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(e => console.log("Nav timeout:", e.message));

  console.log("Taking dashboard screenshot...");
  await page.screenshot({ path: '/home/nishu/TechStack/codes/upstash/backend/dashboard.png' });

  console.log("Clicking Create Database...");
  const createBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    return btns.find(b => (b.textContent || '').toLowerCase().includes('create database'));
  });
  
  if (createBtn && createBtn.asElement()) {
    await createBtn.asElement().click();
    console.log("Clicked Create Database.");
  } else {
    console.log("Create database button not found.");
  }

  console.log("Waiting for modal...");
  await new Promise(r => setTimeout(r, 5000));

  console.log("Taking modal screenshot...");
  await page.screenshot({ path: '/home/nishu/TechStack/codes/upstash/backend/modal.png' });

  console.log("Checking for disabled buttons...");
  const buttonsInfo = await page.evaluate(() => {
    const modal = document.querySelector('.ant-modal-content, [role="dialog"], div[class*="modal"]') || document.body;
    const btns = Array.from(modal.querySelectorAll('button'));
    return btns.map(b => ({ text: b.textContent, disabled: b.disabled, class: b.className }));
  });
  console.log("Buttons:", buttonsInfo);
  
  const nameInputSelector = '#create-database-modal-name, input[name="name"], input[placeholder*="database name" i], input[placeholder*="Name" i], .ant-modal-content input';
  const nameInput = await page.$(nameInputSelector);
  if (nameInput) {
      console.log("Typing database name...");
      await nameInput.type("testdb123");
  }

  await new Promise(r => setTimeout(r, 2000));

  console.log("Taking modal screenshot 2...");
  await page.screenshot({ path: '/home/nishu/TechStack/codes/upstash/backend/modal2.png' });

  const buttonsInfo2 = await page.evaluate(() => {
    const modal = document.querySelector('.ant-modal-content, [role="dialog"], div[class*="modal"]') || document.body;
    const btns = Array.from(modal.querySelectorAll('button'));
    return btns.map(b => ({ text: b.textContent, disabled: b.disabled, class: b.className }));
  });
  console.log("Buttons 2:", buttonsInfo2);

  await browser.close();
  console.log("Done.");
})();
