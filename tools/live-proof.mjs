import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('artifacts/live-proof',{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080}});let diagnostic;
try {
  await page.goto('http://127.0.0.1:8770');
  await page.locator('#mainAction').waitFor();
  await page.waitForFunction(()=>!document.querySelector('#mainAction').disabled);
  await page.locator('#connectChat').click();
  await page.waitForFunction(()=>document.querySelector('#connectionBadge').textContent==='CONNECTED',{timeout:20000});
  await page.locator('#mainAction').click();
  await page.waitForFunction(()=>document.querySelector('#phasePill').textContent==='PREDICTIONS OPEN');
  await page.screenshot({path:'artifacts/live-proof/01-connected-awaiting-vote.png',fullPage:true});
  console.log('READY: Connected to kumarabhinav0905. Predictions open. Waiting for a real !drop yes or !drop no message.');
  diagnostic=setInterval(async()=>{try{console.log(JSON.stringify({activity:await page.locator('#chatActivity').textContent(),status:await page.locator('#chatStatus').textContent(),votes:await page.locator('#voteSources').textContent()}));}catch{}},30000);
  await page.waitForFunction(()=>!document.querySelector('#voteSources').textContent.startsWith('0 Twitch')&&document.querySelector('#voteSources').textContent.includes(' Twitch'),null,{timeout:1200000});
  await page.screenshot({path:'artifacts/live-proof/02-real-twitch-prediction.png',fullPage:true});
  console.log('REAL_TWITCH_PREDICTION_RECEIVED: '+await page.locator('#voteSources').textContent());
  await page.locator('#mainAction').click();
  await page.waitForFunction(()=>document.querySelector('#phasePill').textContent==='PREDICTIONS LOCKED');
  await page.locator('#overlayButton').click();
  const overlayURL=await page.locator('#overlayURL').inputValue();await page.locator('.dialog-close').click();
  const overlay=await browser.newPage({viewport:{width:1280,height:720}});await overlay.goto(overlayURL);await overlay.waitForFunction(()=>document.querySelector('#phasePill').textContent==='PREDICTIONS LOCKED');
  await page.locator('#mainAction').click();await page.waitForFunction(()=>document.querySelector('#phasePill').textContent==='REVIEW THE EVIDENCE');
  await page.locator('#mainAction').click();await page.waitForFunction(()=>document.querySelector('#phasePill').textContent==='RESULT REVEALED');
  await overlay.waitForFunction(()=>document.querySelector('#phasePill').textContent==='RESULT REVEALED');
  await page.screenshot({path:'artifacts/live-proof/03-reviewed-result.png',fullPage:true});await overlay.screenshot({path:'artifacts/live-proof/04-synchronized-overlay.png'});
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs('artifacts/live-proof/experiment.json');
  await writeFile('artifacts/live-proof/status.json',JSON.stringify({verifiedAt:new Date().toISOString(),channel:'kumarabhinav0905',liveChatPrediction:true,overlaySynchronized:true,videoSource:'recorded physical trial',resultMethod:'manual-frame-review',broadcastVerified:false},null,2));
  console.log('SUCCESS: Real Twitch prediction, locked commitment, recorded replay, reviewed result, and synchronized overlay verified.');
}catch(error){await writeFile('artifacts/live-proof/status.json',JSON.stringify({verifiedAt:new Date().toISOString(),error:error.message,liveChatPrediction:false},null,2));console.error(error.message);process.exitCode=1;}
finally{clearInterval(diagnostic);await browser.close();}
