import { chromium } from 'playwright';

async function testModal() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[editKnowledgeBase]') || text.includes('SUCCESS') || text.includes('ERROR')) {
      console.log('[BROWSER] ' + text);
    }
  });

  try {
    console.log('\n========== ISOLATED MODAL TEST ==========\n');
    
    console.log('1. Loading test HTML...');
    const path = 'file:///c:/Users/teach/OneDrive/Desktop/Outreach%20System%20WebSite/kb-modal-test.html';
    await page.goto(path);
    await page.waitForTimeout(2000);
    
    console.log('\n2. Checking test results on page...');
    const resultCount = await page.locator('.result').count();
    console.log('   Test results displayed: ' + resultCount);
    
    if (resultCount > 0) {
      console.log('\n3. Test results:');
      const results = await page.locator('.result').evaluateAll(elements => {
        return elements.map(el => ({
          text: el.textContent,
          isSuccess: el.classList.contains('success')
        }));
      });
      
      results.forEach((r, i) => {
        const status = r.isSuccess ? '[PASS]' : '[FAIL]';
        console.log('   ' + status + ' ' + r.text);
      });
      
      const allPassed = results.every(r => r.isSuccess);
      if (allPassed) {
        console.log('\n   ALL TESTS PASSED!');
      } else {
        console.log('\n   SOME TESTS FAILED');
      }
    }
    
    console.log('\n4. Taking screenshot...');
    const ts = new Date().toISOString().split('.')[0].replace(/:/g, '-');
    const shot = '/c/Users/teach/Desktop/isolated-modal-test-' + ts + '.png';
    await page.screenshot({ path: shot, fullPage: true });
    console.log('   Screenshot: ' + shot);
    
    console.log('\n========== TEST COMPLETE ==========\n');
    
  } catch (error) {
    console.error('ERROR: ' + error.message);
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testModal().catch(console.error);
