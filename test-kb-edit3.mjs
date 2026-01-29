import { chromium } from 'playwright';

async function testKBEdit() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('\n========== KNOWLEDGE BASE EDIT TEST v3 ==========\n');
    
    console.log('1. Navigating to settings page...');
    const response = await page.goto('http://localhost:8080/settings.html', { waitUntil: 'networkidle' });
    console.log('   Status: ' + response.status());
    
    console.log('\n2. Waiting for page initialization...');
    await page.waitForTimeout(4000);
    
    console.log('\n3. Checking for auth issues...');
    const bodyContent = await page.content();
    const hasAuthError = bodyContent.includes('initPage') || bodyContent.includes('Not authenticated');
    console.log('   Auth-related content found: ' + hasAuthError);
    
    console.log('\n4. Looking for main content...');
    const hasSettingsContainer = await page.locator('.settings-container').count().then(c => c > 0);
    console.log('   Settings container exists: ' + hasSettingsContainer);
    
    if (!hasSettingsContainer) {
      console.log('\n   Checking page title: ' + await page.title());
      console.log('   Checking current URL: ' + page.url());
      
      console.log('\n5. Checking for redirect to login...');
      const isLoginPage = await page.locator('[data-page="login"]').count().then(c => c > 0);
      console.log('   Login page: ' + isLoginPage);
    }
    
    console.log('\n6. Looking for any tabs on page...');
    const allElements = await page.evaluate(() => {
      const tabs = document.querySelectorAll('[data-tab]');
      const buttons = document.querySelectorAll('.settings-tab');
      const sections = document.querySelectorAll('.settings-section');
      return {
        dataTabElements: tabs.length,
        settingsTabButtons: buttons.length,
        settingsSections: sections.length
      };
    });
    console.log('   Results: ' + JSON.stringify(allElements));
    
    if (allElements.dataTabElements > 0) {
      console.log('\n7. Found data-tab elements! Listing them...');
      const tabs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-tab]')).map(el => ({
          tag: el.tagName,
          text: el.textContent.substring(0, 30),
          dataset: el.dataset.tab
        }));
      });
      tabs.forEach((tab, i) => {
        console.log('   Tab ' + i + ': <' + tab.tag + '> data-tab="' + tab.dataset + '" text="' + tab.text + '"');
      });
    }
    
    console.log('\n8. Capturing page screenshot for analysis...');
    const ts = new Date().toISOString().split('.')[0].replace(/:/g, '-');
    const shot = '/c/Users/teach/Desktop/kb-test-v3-' + ts + '.png';
    await page.screenshot({ path: shot, fullPage: true });
    console.log('   Screenshot: ' + shot);
    
    console.log('\n========== TEST COMPLETE ==========');
    console.log('STATUS: Authentication may be required. Check the screenshot.');
    console.log('Next step: Implement login flow if needed.\n');
    
  } catch (error) {
    console.error('ERROR: ' + error.message);
  } finally {
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testKBEdit().catch(console.error);
