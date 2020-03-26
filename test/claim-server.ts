import puppeteer from 'puppeteer';
import { username, password, servername } from './test-client';

async function clear(page, selector): Promise<void> {
  await page.evaluate(selector => {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    document.querySelector(selector).value = '';
  }, selector);
}

// handle setup and association of a plex server to a user account
async function main() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.waitFor(5000);
  await page.setViewport({ width: 900, height: 1000 });
  await page.goto('http://plex:32400/web');
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
  await page.goto('http://plex:32400/web');
  await page.waitForNavigation();
  await page.waitForSelector('.next-btn');
  await page.waitFor(5000);
  console.log('clicking');
  await page.click('.next-btn');
  console.log('close modal');
  // close modal
  await page.waitForSelector('[data-uid="id-18"]');
  await page.click('[data-uid="id-18"]');
  await page.waitForSelector('#FriendlyName');
  await clear(page, '#FriendlyName');
  await page.type('#FriendlyName', servername);
  console.log('add-section');
  await page.evaluate(() => {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    document.querySelector('[type="submit"]').click();
  });
  await page.waitForSelector('.add-section-btn');
  await frame.waitFor(2000);
  console.log('btn-primary');
  await page.evaluate(() => {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    document.querySelector('.btn-primary').click();
  });
  await page.waitForSelector('.setup-complete-container');
  await frame.waitFor(2000);
  console.log('btn-primary');
  await page.evaluate(() => {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    document.querySelector('.btn-primary').click();
  });
  await frame.waitFor(2000);
  await browser.close();
}

if (!module.parent) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
