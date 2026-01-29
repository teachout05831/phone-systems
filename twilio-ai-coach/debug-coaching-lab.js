/**
 * Debug Coaching Lab - Systematic Component Testing
 * Tests each component of the coaching lab flow
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const SERVER_URL = 'http://localhost:8080';

async function debugAll() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           COACHING LAB DEBUG - COMPONENT TESTING             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results = {
    passed: 0,
    failed: 0,
    issues: []
  };

  // ============ TEST 1: Database Connection ============
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 1: Database Connection                                 │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  try {
    const { data, error } = await supabase.from('calls').select('id').limit(1);
    if (error) throw error;
    console.log('  ✓ Database connection successful');
    results.passed++;
  } catch (e) {
    console.log('  ✗ Database connection FAILED:', e.message);
    results.failed++;
    results.issues.push('Database connection failed');
  }

  // ============ TEST 2: Test Calls Exist ============
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 2: Test Calls in Database                              │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  try {
    const { data: testCalls, error } = await supabase
      .from('calls')
      .select('id, external_call_id, phone_number')
      .like('external_call_id', 'test_%');

    if (error) throw error;

    console.log(`  Found ${testCalls?.length || 0} test calls:`);
    testCalls?.forEach(c => {
      console.log(`    - ${c.external_call_id} (${c.phone_number})`);
    });

    if (testCalls?.length >= 5) {
      console.log('  ✓ All 5 test calls present');
      results.passed++;
    } else {
      console.log('  ✗ Missing test calls - expected 5');
      results.failed++;
      results.issues.push(`Only ${testCalls?.length || 0} test calls found, expected 5`);
    }
  } catch (e) {
    console.log('  ✗ FAILED:', e.message);
    results.failed++;
    results.issues.push('Could not query test calls');
  }

  // ============ TEST 3: Transcripts Exist ============
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 3: Transcripts for Test Calls                          │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  try {
    const { data: callsWithTranscripts, error } = await supabase
      .from('calls')
      .select(`
        id,
        external_call_id,
        call_transcripts (id, segments)
      `)
      .like('external_call_id', 'test_%');

    if (error) throw error;

    let allHaveTranscripts = true;
    callsWithTranscripts?.forEach(c => {
      const hasTranscript = c.call_transcripts && c.call_transcripts.length > 0;
      const segmentCount = c.call_transcripts?.[0]?.segments?.length || 0;
      const status = hasTranscript ? '✓' : '✗';
      console.log(`  ${status} ${c.external_call_id}: ${segmentCount} segments`);
      if (!hasTranscript) allHaveTranscripts = false;
    });

    if (allHaveTranscripts) {
      console.log('  ✓ All test calls have transcripts');
      results.passed++;
    } else {
      console.log('  ✗ Some test calls missing transcripts');
      results.failed++;
      results.issues.push('Some test calls missing transcripts');
    }
  } catch (e) {
    console.log('  ✗ FAILED:', e.message);
    results.failed++;
    results.issues.push('Could not query transcripts');
  }

  // ============ TEST 4: Server Running ============
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 4: Server Connectivity                                 │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  try {
    const response = await fetch(`${SERVER_URL}/api/calls?limit=5&hasTranscript=true`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.log(`  ✓ Server responding - found ${data.calls?.length || 0} calls`);
    results.passed++;

    // Show what the API returns
    console.log('\n  API Response structure:');
    if (data.calls && data.calls.length > 0) {
      const sample = data.calls[0];
      console.log(`    - callSid: ${sample.callSid}`);
      console.log(`    - phone: ${sample.phone}`);
      console.log(`    - hasTranscript: ${sample.hasTranscript}`);
    }
  } catch (e) {
    console.log('  ✗ Server NOT responding:', e.message);
    console.log('  → Make sure to run: node server.js');
    results.failed++;
    results.issues.push('Server not running or not responding');
  }

  // ============ TEST 5: Transcript API ============
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 5: Transcript API Endpoint                             │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  try {
    const response = await fetch(`${SERVER_URL}/api/calls/test_full_cycle_001/transcript`);
    const data = await response.json();

    if (data.success) {
      console.log(`  ✓ Transcript API working`);
      console.log(`    - Segments: ${data.transcript?.segments?.length || 0}`);
      console.log(`    - First segment: "${data.transcript?.segments?.[0]?.text?.substring(0, 50)}..."`);
      results.passed++;
    } else {
      console.log(`  ✗ Transcript API failed: ${data.error}`);
      results.failed++;
      results.issues.push(`Transcript API error: ${data.error}`);
    }
  } catch (e) {
    console.log('  ✗ FAILED:', e.message);
    results.failed++;
    results.issues.push('Transcript API not accessible');
  }

  // ============ TEST 6: Coaching Lab Test Endpoint ============
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 6: Coaching Lab Test Endpoint                          │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  try {
    // Get a knowledge base ID first
    const { data: kbs } = await supabase
      .from('knowledge_bases')
      .select('id, name')
      .limit(1);

    const kbId = kbs?.[0]?.id;
    if (!kbId) {
      console.log('  ✗ No knowledge base found to test with');
      results.failed++;
      results.issues.push('No knowledge base available');
    } else {
      console.log(`  Using KB: ${kbs[0].name} (${kbId})`);

      const response = await fetch(`${SERVER_URL}/api/coaching-lab/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "That's way too expensive for us",
          knowledgeBaseId: kbId,
          useLiveMode: true,
          conversationHistory: [
            { speaker: 'rep', text: 'Hi, this is a test call' },
            { speaker: 'customer', text: "That's way too expensive for us" }
          ]
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('  ✓ Coaching lab test endpoint working');
        console.log(`    - Result type: ${data.result?.type}`);
        console.log(`    - Phase detected: ${data.context?.phase || data.result?.phase || 'unknown'}`);
        console.log(`    - Context returned: ${data.context ? 'YES' : 'NO'}`);
        if (data.context) {
          console.log(`    - Context summary: ${data.context.summary ? 'YES' : 'NO'}`);
          console.log(`    - Context topics: ${data.context.topics?.length || 0}`);
          console.log(`    - Context sentiment: ${data.context.sentiment || 'none'}`);
        }
        results.passed++;
      } else {
        console.log(`  ✗ Coaching test failed: ${data.error}`);
        results.failed++;
        results.issues.push(`Coaching test error: ${data.error}`);
      }
    }
  } catch (e) {
    console.log('  ✗ FAILED:', e.message);
    results.failed++;
    results.issues.push('Coaching lab test endpoint failed');
  }

  // ============ TEST 7: Context Generation ============
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 7: Context Window Data Generation                      │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  try {
    const { data: kbs } = await supabase.from('knowledge_bases').select('id').limit(1);
    const kbId = kbs?.[0]?.id;

    if (!kbId) {
      console.log('  ✗ No KB for testing');
      results.failed++;
    } else {
      // Test with enough conversation history to trigger context generation
      const longHistory = [
        { speaker: 'rep', text: 'Hi, this is Sarah from CleanPro' },
        { speaker: 'customer', text: 'Oh hi, I was looking for cleaning services' },
        { speaker: 'rep', text: 'Great! Tell me about your home' },
        { speaker: 'customer', text: 'Its a 3 bedroom house, pretty messy lately' },
        { speaker: 'rep', text: 'How often would you like cleaning?' },
        { speaker: 'customer', text: 'Maybe every two weeks' },
        { speaker: 'rep', text: 'Our bi-weekly service is $180' },
        { speaker: 'customer', text: 'Thats more than I expected, seems expensive' }
      ];

      const response = await fetch(`${SERVER_URL}/api/coaching-lab/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Thats more than I expected, seems expensive',
          knowledgeBaseId: kbId,
          useLiveMode: true,
          conversationHistory: longHistory
        })
      });

      const data = await response.json();

      console.log('  Context generation test:');
      console.log(`    - Response success: ${data.success}`);
      console.log(`    - Has context object: ${!!data.context}`);
      if (data.context) {
        console.log(`    - Phase: ${data.context.phase}`);
        console.log(`    - Summary: ${data.context.summary ? data.context.summary.substring(0, 80) + '...' : 'NONE'}`);
        console.log(`    - Topics: ${JSON.stringify(data.context.topics)}`);
        console.log(`    - Sentiment: ${data.context.sentiment}`);
        console.log(`    - Insights: ${JSON.stringify(data.context.insights)}`);

        if (data.context.summary) {
          console.log('  ✓ Context generation working');
          results.passed++;
        } else {
          console.log('  ⚠ Context returned but no summary generated');
          console.log('    → This may indicate AI API timeout or no API key');
          results.issues.push('Context summary not generated - check ANTHROPIC_API_KEY');
        }
      } else {
        console.log('  ✗ No context object in response');
        results.failed++;
        results.issues.push('Context object missing from response');
      }
    }
  } catch (e) {
    console.log('  ✗ FAILED:', e.message);
    results.failed++;
    results.issues.push('Context generation test failed');
  }

  // ============ TEST 8: Previous Call Loading (Simulated) ============
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TEST 8: Previous Call Flow (API Chain)                      │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  try {
    // Step 1: Get calls list
    console.log('  Step 1: Fetch calls list...');
    const callsRes = await fetch(`${SERVER_URL}/api/calls?limit=10&hasTranscript=true`);
    const callsData = await callsRes.json();

    if (!callsData.success || !callsData.calls?.length) {
      throw new Error('No calls returned from API');
    }

    // Find a test call
    const testCall = callsData.calls.find(c => c.callSid?.startsWith('test_'));
    if (!testCall) {
      console.log('  ⚠ No test calls in API response');
      console.log('    Available calls:', callsData.calls.map(c => c.callSid).join(', '));
      results.issues.push('Test calls not appearing in /api/calls response');
    } else {
      console.log(`    ✓ Found test call: ${testCall.callSid}`);

      // Step 2: Load transcript
      console.log('  Step 2: Load transcript...');
      const transcriptRes = await fetch(`${SERVER_URL}/api/calls/${testCall.callSid}/transcript`);
      const transcriptData = await transcriptRes.json();

      if (transcriptData.success) {
        console.log(`    ✓ Transcript loaded: ${transcriptData.transcript?.segments?.length} segments`);

        // Step 3: Test coaching replay
        console.log('  Step 3: Test coaching replay...');
        const { data: kbs } = await supabase.from('knowledge_bases').select('id').limit(1);

        if (kbs?.[0]?.id) {
          const replayRes = await fetch(`${SERVER_URL}/api/calls/${testCall.callSid}/coaching-replay?knowledgeBaseId=${kbs[0].id}`);
          const replayData = await replayRes.json();

          if (replayData.success) {
            console.log(`    ✓ Coaching replay: ${replayData.coachingMoments?.length || 0} moments found`);
            console.log('  ✓ Previous call flow working');
            results.passed++;
          } else {
            console.log(`    ✗ Coaching replay failed: ${replayData.error}`);
            results.issues.push('Coaching replay failed');
          }
        }
      } else {
        console.log(`    ✗ Transcript load failed: ${transcriptData.error}`);
        results.failed++;
        results.issues.push('Transcript loading failed');
      }
    }
  } catch (e) {
    console.log('  ✗ FAILED:', e.message);
    results.failed++;
    results.issues.push('Previous call flow broken: ' + e.message);
  }

  // ============ SUMMARY ============
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                         SUMMARY                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n  Tests Passed: ${results.passed}`);
  console.log(`  Tests Failed: ${results.failed}`);

  if (results.issues.length > 0) {
    console.log('\n  Issues Found:');
    results.issues.forEach((issue, i) => {
      console.log(`    ${i + 1}. ${issue}`);
    });
  }

  console.log('\n  Debugging Tips:');
  console.log('  - Check browser console (F12) for JavaScript errors');
  console.log('  - Check server terminal for backend errors');
  console.log('  - Verify ANTHROPIC_API_KEY is set for context generation');
  console.log('  - Try clearing browser cache and refreshing');
}

debugAll().catch(console.error);
