/**
 * Test Coaching Lab Flow
 * Verifies test calls exist and tests the coaching detection
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('=== COACHING LAB TEST SUITE ===\n');

  // Test 1: Verify test calls exist
  console.log('TEST 1: Verify test calls exist in database');
  console.log('-'.repeat(50));

  const { data: calls, error: callsError } = await supabase
    .from('calls')
    .select(`
      id,
      external_call_id,
      phone_number,
      outcome,
      duration_seconds,
      call_transcripts (id, segments)
    `)
    .like('external_call_id', 'test_%')
    .order('external_call_id');

  if (callsError) {
    console.error('ERROR:', callsError);
    return;
  }

  console.log(`Found ${calls.length} test calls:\n`);
  calls.forEach(call => {
    const segmentCount = call.call_transcripts?.[0]?.segments?.length || 0;
    console.log(`  ✓ ${call.external_call_id}`);
    console.log(`    Phone: ${call.phone_number} | Outcome: ${call.outcome} | Duration: ${call.duration_seconds}s`);
    console.log(`    Transcript: ${segmentCount} segments\n`);
  });

  // Test 2: Verify transcript content for each call
  console.log('\nTEST 2: Sample transcript content');
  console.log('-'.repeat(50));

  for (const call of calls) {
    const segments = call.call_transcripts?.[0]?.segments || [];
    console.log(`\n${call.external_call_id}:`);

    // Show first 3 segments
    segments.slice(0, 3).forEach((seg, i) => {
      const text = seg.text.length > 60 ? seg.text.substring(0, 60) + '...' : seg.text;
      console.log(`  ${i + 1}. [${seg.speaker}]: ${text}`);
    });

    // Identify phases in the conversation
    const phases = identifyPhases(segments);
    console.log(`  Detected phases: ${phases.join(' → ')}`);
  }

  // Test 3: Test phase detection keywords
  console.log('\n\nTEST 3: Phase detection on sample utterances');
  console.log('-'.repeat(50));

  const testUtterances = [
    { text: "Hi, this is Sarah from CleanPro Services calling about your quote", expectedPhase: 'intro' },
    { text: "Tell me more about what challenges you're facing with your current setup", expectedPhase: 'discovery' },
    { text: "Let me show you how our solution can help with that", expectedPhase: 'presentation' },
    { text: "So how much does this cost? What's the price?", expectedPhase: 'pricing' },
    { text: "That's way too expensive for us right now", expectedPhase: 'objection_handling' },
    { text: "Okay, I'm ready to get started. How do we sign up?", expectedPhase: 'closing' }
  ];

  for (const u of testUtterances) {
    const detected = detectPhase(u.text);
    const match = detected === u.expectedPhase ? '✓' : '✗';
    console.log(`  ${match} "${u.text.substring(0, 50)}..."`);
    console.log(`    Expected: ${u.expectedPhase} | Detected: ${detected}`);
  }

  // Test 4: Verify knowledge bases exist
  console.log('\n\nTEST 4: Check knowledge bases and scripts');
  console.log('-'.repeat(50));

  const { data: kbs, error: kbError } = await supabase
    .from('knowledge_bases')
    .select(`
      id,
      name,
      is_default,
      scripts (id, title, trigger_phrases, applicable_phases)
    `)
    .limit(3);

  if (kbError) {
    console.error('ERROR fetching KBs:', kbError);
  } else {
    console.log(`Found ${kbs.length} knowledge bases:\n`);
    for (const kb of kbs) {
      console.log(`  ${kb.is_default ? '★' : '○'} ${kb.name} (${kb.id.substring(0, 8)}...)`);
      console.log(`    Scripts: ${kb.scripts?.length || 0}`);

      // Show scripts with their phases
      if (kb.scripts?.length > 0) {
        kb.scripts.slice(0, 3).forEach(s => {
          const phases = s.applicable_phases?.join(', ') || 'all phases';
          console.log(`      - ${s.title}: [${phases}]`);
        });
      }
    }
  }

  console.log('\n\n=== TEST SUITE COMPLETE ===');
  console.log('\nTo test in browser:');
  console.log('1. Start the server: node server.js');
  console.log('2. Go to http://localhost:3001/coaching-lab.html');
  console.log('3. Switch to "Previous Call" mode');
  console.log('4. Select one of the test calls from the dropdown');
  console.log('5. Click the "Context" button to see context window');
  console.log('6. Enable "Live Mode" and test with manual input');
}

// Simple phase detection (mirrors server logic)
function detectPhase(text) {
  const lowerText = text.toLowerCase();

  const PHASE_KEYWORDS = {
    intro: ['hello', 'hi', 'calling from', 'calling about', 'my name is', 'good morning', 'good afternoon', 'is this a good time'],
    discovery: ['tell me about', 'what challenges', 'currently using', 'what are you looking', 'how often', 'describe your', 'what problems'],
    presentation: ['let me show you', 'our solution', 'we offer', 'benefit', 'feature', 'here\'s how', 'this will help'],
    pricing: ['how much', 'price', 'cost', 'budget', 'investment', 'afford', 'what does it cost', 'pricing'],
    objection_handling: ['too expensive', 'think about it', 'not sure', 'need to talk', 'concerned', 'hesitant', 'can\'t afford', 'too much'],
    closing: ['ready to start', 'sign up', 'get started', 'let\'s do it', 'next steps', 'schedule', 'when can we']
  };

  for (const [phase, keywords] of Object.entries(PHASE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return phase;
      }
    }
  }
  return 'unknown';
}

// Identify phases in a conversation
function identifyPhases(segments) {
  const phases = [];
  let lastPhase = null;

  for (const seg of segments) {
    const phase = detectPhase(seg.text);
    if (phase !== 'unknown' && phase !== lastPhase) {
      phases.push(phase);
      lastPhase = phase;
    }
  }
  return phases.length > 0 ? phases : ['unknown'];
}

runTests().catch(console.error);
