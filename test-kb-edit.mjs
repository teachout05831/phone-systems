import { chromium } from 'playwright';

async function testKBEdit() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log console messages
  page.on('console', msg => {
    console.log('[BROWSER] ' + msg.type() + ': ' + msg.text());
  });

  try {
    console.log('KB EDIT FUNCTIONALITY TEST');
    
    console.log('1. Navigating to http://localhost:8080/settings.html...');
    const response = await page.goto('http://localhost:8080/settings.html', { waitUntil: 'domcontentloaded' });
    console.log('   Response status: ' + response.status());
    
    await page.waitForTimeout(2000);
    
    console.log('2. Looking for Knowledge Bases tab...');
    const kbTab = page.locator('[data-tab="knowledgebases"]');
    const tabExists = await kbTab.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('   Tab found: ' + tabExists);
    
    if (tabExists) {
      console.log('3. Clicking Knowledge Bases tab...');
      await kbTab.click();
      await page.waitForTimeout(2500);
      
      console.log('4. Waiting for knowledge bases to load...');
      const kbList = page.locator('#knowledgeBasesList');
      await kbList.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      
      const loading = await page.locator('.kb-loading').isVisible().catch(() => false);
      console.log('   Still loading: ' + loading);
      
      if (loading) {
        await page.waitForTimeout(2000);
      }
      
      console.log('5. Checking for knowledge bases in list...');
      const kbItems = page.locator('[data-kb-id]');
      const count = await kbItems.count().catch(() => 0);
      console.log('   Knowledge bases found: ' + count);
      
      if (count > 0) {
        console.log('6. Finding edit button on first KB...');
        const firstKB = kbItems.first();
        
        let editBtn = firstKB.locator('button[onclick*="editKnowledgeBase"]').first();
        let found = await editBtn.isVisible().catch(() => false);
        
        if (!found) {
          const buttons = firstKB.locator('button');
          const btnCount = await buttons.count().catch(() => 0);
          console.log('   Buttons in first KB: ' + btnCount);
          
          if (btnCount > 0) {
            editBtn = buttons.first();
            found = true;
          }
        }
        
        if (found) {
          console.log('7. Clicking edit button...');
          await editBtn.click();
          await page.waitForTimeout(1000);
          
          console.log('8. Checking if modal appeared...');
          const modal = page.locator('#kbModal');
          const modalVisible = await modal.isVisible().catch(() => false);
          console.log('   Modal visible: ' + modalVisible);
          
          if (modalVisible) {
            const modalClass = await modal.getAttribute('class');
            console.log('   Modal classes: ' + modalClass);
            
            const hasShow = modalClass.includes('show');
            console.log('   Has show class: ' + hasShow);
            
            const title = await modal.locator('#kbModalTitle').textContent().catch(() => 'N/A');
            console.log('   Modal title: ' + title);
            
            if (hasShow) {
              console.log('   SUCCESS: Edit modal appeared!');
            }
          }
        }
      }
    }
    
    console.log('Taking screenshot...');
    const timestamp = new Date().toISOString().split('.')[0].replace(/:/g, '-');
    const path = '/c/Users/teach/Desktop/kb-edit-test-' + timestamp + '.png';
    await page.screenshot({ path, fullPage: false });
    console.log('Saved to: ' + path);
    
    console.log('TEST COMPLETE');
    
  } catch (error) {
    console.error('Test error: ' + error.message);
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testKBEdit().catch(console.error);
