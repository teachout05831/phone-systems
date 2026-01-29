import { chromium } from 'playwright';

async function testKBEdit() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    const type = msg.type();
    if (type === 'log' && msg.text().includes('[editKnowledgeBase]')) {
      console.log('[IMPORTANT] ' + msg.text());
    } else if (msg.type() === 'error') {
      console.log('[BROWSER ERROR] ' + msg.text());
    }
  });

  try {
    console.log('\n========== KNOWLEDGE BASE EDIT FUNCTIONALITY TEST ==========\n');
    
    console.log('1. Navigating to settings page...');
    await page.goto('http://localhost:8080/settings.html', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    
    console.log('2. Checking if redirected to login...');
    const currentURL = page.url();
    console.log('   Current URL: ' + currentURL);
    
    if (currentURL.includes('login') || currentURL.includes('index.html')) {
      console.log('\n3. Redirected to login. Looking for test credentials...');
      console.log('   (Check environment variables for TEST_EMAIL and TEST_PASSWORD)');
      
      const email = process.env.TEST_EMAIL || 'test@example.com';
      const password = process.env.TEST_PASSWORD || 'testpassword';
      
      console.log('   Using email: ' + email);
      
      console.log('\n4. Looking for login form...');
      const emailInput = await page.locator('input[type="email"]').first();
      const passInput = await page.locator('input[type="password"]').first();
      const submitBtn = await page.locator('button[type="submit"]').first();
      
      const emailExists = await emailInput.count().then(c => c > 0);
      const passExists = await passInput.count().then(c => c > 0);
      const btnExists = await submitBtn.count().then(c => c > 0);
      
      console.log('   Email field exists: ' + emailExists);
      console.log('   Password field exists: ' + passExists);
      console.log('   Submit button exists: ' + btnExists);
      
      if (emailExists && passExists && btnExists) {
        console.log('\n5. Attempting login...');
        await page.locator('input[type="email"]').first().fill(email);
        await page.locator('input[type="password"]').first().fill(password);
        await page.locator('button[type="submit"]').first().click();
        
        console.log('   Login submitted. Waiting for redirect...');
        await page.waitForURL(url => !url.includes('login'), { timeout: 10000 }).catch(() => {
          console.log('   Warning: URL did not change as expected');
        });
        
        await page.waitForTimeout(3000);
      } else {
        console.log('\n5. Login form not found. You may need to set TEST_EMAIL and TEST_PASSWORD');
        console.log('   Or the page structure has changed.');
      }
    }
    
    console.log('\n6. Checking if now on settings page...');
    const onSettings = page.url().includes('settings');
    console.log('   On settings page: ' + onSettings);
    
    console.log('\n7. Looking for Knowledge Bases tab...');
    await page.waitForTimeout(2000);
    
    const kbTab = await page.locator('[data-tab="knowledgebases"]').count().then(c => c > 0);
    console.log('   KB tab found: ' + kbTab);
    
    if (kbTab) {
      console.log('\n8. Clicking Knowledge Bases tab...');
      await page.locator('[data-tab="knowledgebases"]').first().click();
      await page.waitForTimeout(2500);
      
      console.log('\n9. Checking for KB list...');
      const listExists = await page.locator('#knowledgeBasesList').count().then(c => c > 0);
      console.log('   KB list found: ' + listExists);
      
      if (listExists) {
        console.log('\n10. Checking for knowledge bases...');
        const kbItems = await page.locator('[data-kb-id]').count();
        console.log('    Knowledge bases found: ' + kbItems);
        
        if (kbItems > 0) {
          console.log('\n11. Finding edit button on first KB...');
          const firstKB = page.locator('[data-kb-id]').first();
          
          const buttons = await firstKB.locator('button').count();
          console.log('    Buttons in first KB: ' + buttons);
          
          if (buttons > 0) {
            console.log('\n12. Clicking first button (edit)...');
            const btn = firstKB.locator('button').first();
            await btn.click();
            await page.waitForTimeout(1000);
            
            console.log('\n13. Checking for modal...');
            const modal = await page.locator('#kbModal').count().then(c => c > 0);
            const visible = await page.locator('#kbModal').isVisible().catch(() => false);
            const hasShow = await page.evaluate(() => {
              const m = document.getElementById('kbModal');
              return m ? m.classList.contains('show') : false;
            });
            
            console.log('    Modal element exists: ' + modal);
            console.log('    Modal visible: ' + visible);
            console.log('    Modal has "show" class: ' + hasShow);
            
            if (hasShow) {
              const title = await page.locator('#kbModalTitle').textContent();
              console.log('    Modal title: "' + title + '"');
              console.log('\n    SUCCESS: Edit modal appeared correctly!');
            } else {
              console.log('\n    ERROR: Modal exists but not showing properly');
            }
          }
        } else {
          console.log('\n11. No knowledge bases to test - would need to create one first');
        }
      }
    } else {
      console.log('\n8. KB tab not found');
    }
    
    console.log('\n14. Taking final screenshot...');
    const ts = new Date().toISOString().split('.')[0].replace(/:/g, '-');
    const shot = '/c/Users/teach/Desktop/kb-edit-test-final-' + ts + '.png';
    await page.screenshot({ path: shot, fullPage: false });
    console.log('    Screenshot: ' + shot);
    
    console.log('\n========== TEST COMPLETE ==========\n');
    
  } catch (error) {
    console.error('TEST ERROR: ' + error.message);
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testKBEdit().catch(console.error);
