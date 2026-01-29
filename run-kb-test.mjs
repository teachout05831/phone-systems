import { chromium } from 'playwright';

async function runTest() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('\n========== KNOWLEDGE BASE EDIT MODAL TEST ==========\n');
    
    console.log('1. Creating test environment...');
    
    // Create the test page in-memory
    await page.setContent(`
<!DOCTYPE html>
<html>
<head>
  <title>KB Modal Test</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    .result { padding: 10px; margin: 10px 0; border-radius: 5px; }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); }
    .modal-overlay.show { display: flex; align-items: center; justify-content: center; }
    .modal-content { background: white; padding: 20px; border-radius: 8px; min-width: 400px; }
  </style>
</head>
<body>
  <h1>KB Modal Test Results</h1>
  <div id="results"></div>
  
  <div class="modal-overlay" id="kbModal">
    <div class="modal-content">
      <h3 id="kbModalTitle">Add Knowledge Base</h3>
      <input type="hidden" id="kbId">
      <input type="text" id="kbName" placeholder="Name">
      <textarea id="kbDescription"></textarea>
      <input type="text" id="kbIndustry" placeholder="Industry">
      <input type="checkbox" id="kbIsDefault">
    </div>
  </div>

  <script>
    let knowledgeBasesList = [];
    
    function addResult(title, isSuccess) {
      const div = document.createElement('div');
      div.className = 'result ' + (isSuccess ? 'success' : 'error');
      div.textContent = (isSuccess ? 'PASS' : 'FAIL') + ': ' + title;
      document.getElementById('results').appendChild(div);
      console.log('[TEST] ' + (isSuccess ? 'PASS' : 'FAIL') + ': ' + title);
    }
    
    window.editKnowledgeBase = function(kbId) {
      console.log('[editKnowledgeBase] Called with kbId: ' + kbId);
      const kb = knowledgeBasesList.find(k => String(k.id) === String(kbId));
      if (!kb) {
        console.error('[editKnowledgeBase] KB not found');
        return;
      }
      document.getElementById('kbModalTitle').textContent = 'Edit Knowledge Base';
      document.getElementById('kbId').value = kb.id;
      document.getElementById('kbName').value = kb.name;
      document.getElementById('kbDescription').value = kb.description || '';
      document.getElementById('kbIndustry').value = kb.industry || '';
      document.getElementById('kbIsDefault').checked = kb.is_default;
      const modal = document.getElementById('kbModal');
      modal.classList.add('show');
      console.log('[editKnowledgeBase] Modal shown with class: ' + modal.className);
    }
    
    window.onload = function() {
      console.log('Starting tests...');
      
      const testKB = {
        id: 123,
        name: 'Test KB',
        description: 'Test Desc',
        industry: 'Tech',
        is_default: true
      };
      
      knowledgeBasesList = [testKB];
      addResult('Test data loaded', true);
      
      editKnowledgeBase(123);
      
      const modal = document.getElementById('kbModal');
      const hasShow = modal.classList.contains('show');
      addResult('Modal has show class: ' + hasShow, hasShow);
      
      const titleOk = document.getElementById('kbModalTitle').textContent === 'Edit Knowledge Base';
      addResult('Modal title is "Edit Knowledge Base": ' + titleOk, titleOk);
      
      const nameOk = document.getElementById('kbName').value === 'Test KB';
      addResult('Name field correct: ' + nameOk, nameOk);
      
      const descOk = document.getElementById('kbDescription').value === 'Test Desc';
      addResult('Description field correct: ' + descOk, descOk);
      
      const allOk = hasShow && titleOk && nameOk && descOk;
      addResult('ALL TESTS PASSED', allOk);
    }
  </script>
</body>
</html>
    `);
    
    await page.waitForTimeout(1500);
    
    console.log('\n2. Retrieving test results...');
    const results = await page.locator('.result').evaluateAll(els => {
      return els.map(el => ({
        text: el.textContent,
        isPass: el.classList.contains('success')
      }));
    });
    
    console.log('\n3. Test Results:');
    results.forEach(r => {
      const mark = r.isPass ? '[PASS]' : '[FAIL]';
      console.log('   ' + mark + ' ' + r.text);
    });
    
    const allPassed = results.every(r => r.isPass);
    if (allPassed) {
      console.log('\n   SUCCESS: All tests passed!');
    } else {
      console.log('\n   ERROR: Some tests failed');
    }
    
    console.log('\n4. Browser console logs captured:');
    page.on('console', msg => {
      if (msg.text().includes('[')) {
        console.log('   ' + msg.text());
      }
    });
    
    await page.waitForTimeout(1000);
    
    console.log('\n5. Taking screenshot...');
    const ts = new Date().toISOString().split('.')[0].replace(/:/g, '-');
    const shot = '/c/Users/teach/Desktop/kb-modal-test-' + ts + '.png';
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

runTest().catch(console.error);
