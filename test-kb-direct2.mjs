import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function testKBEdit() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[editKnowledgeBase]') || text.includes('error') || text.includes('Error')) {
      console.log('[BROWSER] ' + text);
    }
  });

  try {
    console.log('\n========== DIRECT KB FUNCTIONALITY TEST ==========\n');
    
    const settingsPath = 'file:///c:/Users/teach/OneDrive/Desktop/Outreach System WebSite/twilio-ai-coach/public/settings.html';
    console.log('1. Loading settings.html directly...');
    console.log('   Path: ' + settingsPath);
    
    await page.goto(settingsPath);
    await page.waitForTimeout(2000);
    
    console.log('2. Checking page load...');
    const pageTitle = await page.title();
    console.log('   Page title: ' + pageTitle);
    
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
      
      const testKB = {
        id: 1,
        name: 'Test KB',
        description: 'Test Description',
        industry: 'Testing',
        is_default: false
      };
      
      console.log('\n5. Setting up test data and calling editKnowledgeBase...');
      const result = await page.evaluate((kb) => {
        window.knowledgeBasesList = [kb];
        
        try {
          window.editKnowledgeBase(kb.id);
          
          const modal = document.getElementById('kbModal');
          return {
            success: true,
            modalExists: modal !== null,
            hasShow: modal ? modal.classList.contains('show') : false,
            computedDisplay: modal ? window.getComputedStyle(modal).display : 'N/A',
            className: modal ? modal.className : 'N/A',
            nameFieldValue: document.getElementById('kbName')?.value || 'NOT FOUND',
            modalTitle: document.getElementById('kbModalTitle')?.textContent || 'NOT FOUND'
          };
        } catch (e) {
          return {
            success: false,
            error: e.message
          };
        }
      }, testKB);
      
      console.log('\n6. Results:');
      console.log('   Function call success: ' + result.success);
      
      if (result.success) {
        console.log('   Modal exists: ' + result.modalExists);
        console.log('   Has "show" class: ' + result.hasShow);
        console.log('   CSS display: ' + result.computedDisplay);
        console.log('   Class attribute: ' + result.className);
        console.log('   Name field value: "' + result.nameFieldValue + '"');
        console.log('   Modal title: "' + result.modalTitle + '"');
        
        if (result.hasShow && result.nameFieldValue === 'Test KB') {
          console.log('\n   SUCCESS: Edit modal appeared and form was populated!');
        } else if (result.hasShow) {
          console.log('\n   PARTIAL: Modal appeared but form population issue');
        } else {
          console.log('\n   ERROR: Modal missing show class');
        }
      } else {
        console.log('   Error: ' + result.error);
      }
    }
    
    console.log('\n7. Taking screenshot...');
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
