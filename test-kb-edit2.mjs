import { chromium } from 'playwright';

async function testKBEdit() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log('[BROWSER] ' + msg.type() + ': ' + msg.text());
  });

  try {
    console.log('\n========== KNOWLEDGE BASE EDIT TEST ==========\n');
    
    console.log('1. Navigating to settings page...');
    await page.goto('http://localhost:8080/settings.html', { waitUntil: 'load' });
    
    console.log('2. Waiting for page to fully load...');
    await page.waitForTimeout(3000);
    
    console.log('3. Looking for all tabs...');
    const tabs = await page.locator('.settings-tab').count();
    console.log('   Total tabs found: ' + tabs);
    
    console.log('4. Checking tab content...');
    const tabsText = await page.locator('.settings-tab').allTextContents();
    tabsText.forEach((text, i) => {
      console.log('   Tab ' + i + ': ' + text);
    });
    
    console.log('5. Looking for data-tab attributes...');
    const allTabs = page.locator('[data-tab]');
    const tabCount = await allTabs.count();
    console.log('   Tabs with data-tab: ' + tabCount);
    
    const attributes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-tab]')).map(el => el.getAttribute('data-tab'));
    });
    attributes.forEach((attr, i) => {
      console.log('   data-tab[' + i + ']: ' + attr);
    });
    
    console.log('6. Checking if knowledgebases tab exists...');
    const kbTab = page.locator('[data-tab="knowledgebases"]');
    const exists = await kbTab.count().then(c => c > 0);
    console.log('   Knowledgebases tab exists: ' + exists);
    
    if (exists) {
      console.log('\n7. Clicking knowledgebases tab...');
      await kbTab.first().click();
      await page.waitForTimeout(2000);
      
      console.log('8. Checking for knowledge base list...');
      const listExists = await page.locator('#knowledgeBasesList').count().then(c => c > 0);
      console.log('   Knowledge base list exists: ' + listExists);
      
      if (listExists) {
        console.log('9. Checking for knowledge base items...');
        const items = await page.locator('[data-kb-id]').count();
        console.log('   Knowledge base items found: ' + items);
        
        if (items > 0) {
          console.log('\n10. Examining first KB item...');
          const firstItem = page.locator('[data-kb-id]').first();
          const html = await firstItem.innerHTML();
          console.log('    First item HTML length: ' + html.length);
          console.log('    HTML (first 500 chars): ' + html.substring(0, 500));
          
          console.log('\n11. Looking for edit button...');
          const buttons = await firstItem.locator('button').count();
          console.log('    Buttons in first item: ' + buttons);
          
          for (let i = 0; i < buttons; i++) {
            const btn = firstItem.locator('button').nth(i);
            const text = await btn.textContent();
            const onclick = await btn.getAttribute('onclick');
            console.log('    Button ' + i + ': text="' + text + '", onclick="' + onclick + '"');
          }
          
          console.log('\n12. Clicking first button (assuming edit)...');
          const firstBtn = firstItem.locator('button').first();
          await firstBtn.click();
          await page.waitForTimeout(1500);
          
          console.log('13. Checking for modal...');
          const modal = page.locator('#kbModal');
          const modalExists = await modal.count().then(c => c > 0);
          console.log('    Modal exists: ' + modalExists);
          
          if (modalExists) {
            const classes = await modal.getAttribute('class');
            const isVisible = await modal.isVisible();
            console.log('    Modal visible: ' + isVisible);
            console.log('    Modal classes: ' + classes);
            console.log('\n    SUCCESS: Modal found!');
          }
        }
      }
    } else {
      console.log('\n   ERROR: knowledgebases tab not found');
    }
    
    console.log('\n14. Taking screenshot...');
    const ts = new Date().toISOString().split('.')[0].replace(/:/g, '-');
    const shot = '/c/Users/teach/Desktop/kb-test-' + ts + '.png';
    await page.screenshot({ path: shot, fullPage: true });
    console.log('    Screenshot: ' + shot);
    
    console.log('\n========== TEST COMPLETE ==========\n');
    
  } catch (error) {
    console.error('ERROR: ' + error.message);
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testKBEdit().catch(console.error);
