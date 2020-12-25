import puppeteer from 'puppeteer';
import { username, password } from './test-client';

// handle setup and association of a plex server to a user account
async function main() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.waitFor(5000);
  await page.setViewport({ width: 900, height: 1000 });
  await page.goto('http://localhost:32400/web');
  // await page.waitForNavigation();
  await page.waitForRequest(request => request.url() === 'https://app.plex.tv/auth/');
  await page.waitFor(5000);
  const elementHandle = await page.$('iframe');
  const frame = (await elementHandle?.contentFrame()) as puppeteer.Frame;
  console.log('clicking');
  await frame.click('[data-qa-id="signIn--email"]');
  await frame.waitFor(1000);
  await frame.type('#email', username);
  await frame.type('#password', password);
  await frame.click('[type="submit"]');
  await page.waitForNavigation();
  await page.waitFor(5000);
  await page.waitForSelector('.next-btn');
  console.log('clicking');
  await page.click('.next-btn');
  console.log('close modal');
  // close modal
  await page.waitForSelector('[data-uid="id-18"]');
  await page.click('[data-uid="id-18"]');
  await page.waitForSelector('#FriendlyName');
  await page.waitFor(5000);
  await page.evaluate(() => {
    // @ts-expect-error
    document.querySelector('[type="submit"]').click();
  });
  console.log('add-section');
  await page.waitForSelector('.add-section-btn');
  await frame.waitFor(2000);
  console.log('btn-primary');
  await page.evaluate(() => {
    // @ts-expect-error
    document.querySelector('.btn-primary').click();
  });
  await page.waitForSelector('.setup-complete-container');
  await frame.waitFor(2000);
  console.log('btn-primary');
  await page.evaluate(() => {
    // @ts-expect-error
    document.querySelector('.btn-primary').click();
  });
  await frame.waitFor(2000);
  // await browser.close();
}

if (!module.parent) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
