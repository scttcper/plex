import puppeteer from 'puppeteer';

import { MyPlexAccount } from '../src';
import { username, password, token } from '../test/test-client';

async function delay(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

// handle setup and association of a plex server to a user account
async function main() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await delay(5000);
  await page.setViewport({ width: 900, height: 1000 });
  await page.goto('http://localhost:32400/web');
  // await page.waitForNavigation();
  // await page.waitForRequest(request => request.url() === 'https://app.plex.tv/auth/');
  // await delay(5000);
  let step = 1;
  console.log(`step ${step++} - start`);
  await page.waitForSelector('[data-subset="setupLoading"]');
  await page.click('[data-subset="setupLoading"]');
  await delay(5000);

  console.log(`step ${step++} - close modal`);
  // Remove modal
  await page.evaluate(() => {
    // @ts-expect-error
    var buttons = document.querySelectorAll('button');
    buttons[buttons.length - 1].focus();
    buttons[buttons.length - 1].click();
  });

  await delay(2000);
  console.log(`step ${step++} - name`);
  await page.waitForSelector('.submit-btn');
  await page.click('.submit-btn');
  console.log(`step ${step++} - media library`);
  await page.waitForSelector('[data-subset="setupComplete"]');
  await page.click('[data-subset="setupComplete"]');
  console.log(`step ${step++} - finish`);
  await delay(3000);
  await page.waitForSelector('.submit-btn');
  await page.click('.submit-btn');
  await browser.close();

  const account = new MyPlexAccount('http://localhost:32400', username, password, token);
  const claimToken = await account.claimToken();
  await account.claimServer(claimToken);
}

if (!module.parent) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
