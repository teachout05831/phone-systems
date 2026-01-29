import { chromium } from 'playwright';

async function testKBEdit() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[editKnowledgeBase]') || text.includes('ERROR') || text.includes('error')) {
      console.log('[BROWSER ' + msg.type().toUpperCase() + '] ' + text);
    }
  });

  try {
    console.log('\n========== DIRECT KB FUNCTIONALITY TEST ==========\n');
    
    console.log('1. Loading settings.html directly...');
    await page.goto('file:///c/Users/teach/OneDrive/Desktop/Outreach%20System%20WebSite/twilio-ai-coach/public/settings.html');
    await page.waitForTimeout(2000);
    
    console.log('2. Checking page load...');
    const hasKBSection = await page.evaluate(() => {
      return document.getElementById('knowledgebasesSection') !== null;
    });
    console.log('   KB section exists: ' + hasKBSection);
    
    console.log('\n3. Looking for modal element...');
    const hasModal = await page.evaluate(() => {
      return document.getElementById('kbModal') !== null;
    });
    console.log('   KB modal exists: ' + hasModal);
    
    if (hasModal) {
      console.log('\n4. Testing editKnowledgeBase function...');
      
      console.log('\n5. Creating test knowledge base data...');
      const testKB = {
        id: 1,
        name: 'Test KB',
        description: 'Test Description',
        industry: 'Testing',
        is_default: false
      };
      
      console.log('\n6. Calling editKnowledgeBase with test data...');
      await page.evaluate((kb) => {
        window.knowledgeBasesList = [kb];
        window.editKnowledgeBase(kb.id);
      }, testKB);
      
      await page.waitForTimeout(500);
      
      console.log('\n7. Checking modal visibility...');
      const modalVisible = await page.evaluate(() => {
        const modal = document.getElementById('kbModal');
        if (!modal) return { exists: false };
        return {
          exists: true,
          visible: modal.offsetParent !== null,
          hasShow: modal.classList.contains('show'),
          display: window.getComputedStyle(modal).display,
          className: modal.className
        };
      });
      
      console.log('   Modal check: ' + JSON.stringify(modalVisible));
      
      if (modalVisible.hasShow) {
        console.log('\n   SUCCESS: Modal appeared with show class!');
        
        const formData = await page.evaluate(() => {
          return {
            nameValue: document.getElementById('kbName')?.value,
            descValue: document.getElementById('kbDescription')?.value,
            industryValue: document.getElementById('kbIndustry')?.value,
            isDefaultChecked: document.getElementById('kbIsDefault')?.checked,
            modalTitle: document.getElementById('kbModalTitle')?.textContent
          };
        });
        
        console.log('\n8. Form contents after modal open:');
        console.log('   Name: "' + formData.nameValue + '"');
        console.log('   Description: "' + formData.descValue + '"');
        console.log('   Industry: "' + formData.industryValue + '"');
        console.log('   Is Default: ' + formData.isDefaultChecked);
        console.log('   Modal Title: "' + formData.modalTitle + '"');
        
        if (formData.nameValue === 'Test KB') {
          console.log('\n   EXCELLENT: Form was populated correctly!');
        }
      } else {
        console.log('\n   ERROR: Modal not showing with show class');
      }
    }
    
    console.log('\n9. Taking screenshot...');
    const ts = new Date().toISOString().split('.')[0].replace(/:/g, '-');
    const shot = '/c/Users/teach/Desktop/kb-direct-test-' + ts + '.png';
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

testKBEdit().catch(console.error);
