const path = require('node:path');
const { defineConfig } = require('@playwright/test');
const root = path.resolve(__dirname,'..');
const report = process.env.STAR_ABYSS_TEST_REPORT;
if (!report) throw Error('请通过 npm run test:feature 运行，避免报告覆盖。');
module.exports = defineConfig({
  testDir:path.join(root,'playable/tests'),
  outputDir:path.join(report,'artifacts'),
  workers:1, retries:0, forbidOnly:true,
  reporter:[['list'],['json',{outputFile:path.join(report,'browser.json')}],['html',{outputFolder:path.join(report,'html'),open:'never'}]],
  // Avoid continuous GPU filmstrip capture distorting real-time gait tests.
  // Keep DOM/action traces and a full screenshot on failure instead.
  use:{browserName:'chromium',screenshot:'only-on-failure',trace:{mode:'retain-on-failure',screenshots:false,snapshots:true,sources:true}},
});
