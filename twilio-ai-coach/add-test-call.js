// Script to add a test call with transcript for Coaching Lab testing
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addTestCall() {
  console.log('Adding test call with transcript...');

  // Create test call
  const { data: call, error: callError } = await supabase
    .from('calls')
    .insert({
      external_call_id: 'TEST-COACHING-LAB-001',
      phone_number: '+1 (555) 123-4567',
      direction: 'outbound',
      status: 'completed',
      duration_seconds: 180,
      outcome: 'interested',
      started_at: new Date().toISOString(),
      ended_at: new Date(Date.now() + 180000).toISOString()
    })
    .select('id')
    .single();

  if (callError) {
    console.error('Error creating call:', callError);
    return;
  }

  console.log('Created call:', call.id);

  // Create transcript with realistic conversation including objections
  const segments = [
    { speaker: 'rep', text: "Hi, this is Mike from Solar Solutions. I'm calling about the quote you requested for solar panels. Is this a good time?", timestamp: '00:00:05' },
    { speaker: 'customer', text: "Oh yeah, I remember. I got the quote in my email.", timestamp: '00:00:12' },
    { speaker: 'rep', text: "Great! What did you think? Any questions I can answer for you?", timestamp: '00:00:18' },
    { speaker: 'customer', text: "Honestly, it's way too expensive for us right now. We weren't expecting it to cost that much.", timestamp: '00:00:25' },
    { speaker: 'rep', text: "I completely understand - budget is always an important factor. Let me ask you this: what were you hoping to spend on a system like this?", timestamp: '00:00:35' },
    { speaker: 'customer', text: "I don't know, maybe half of what you quoted? My neighbor said he got his done for way less.", timestamp: '00:00:45' },
    { speaker: 'rep', text: "That's helpful to know. Every system is different based on your home's needs. What matters most to you - the lowest upfront cost, or the best long-term savings?", timestamp: '00:00:58' },
    { speaker: 'customer', text: "I guess long-term savings, but I still need to think about it and talk to my wife first.", timestamp: '00:01:10' },
    { speaker: 'rep', text: "Absolutely, I want you both to feel confident. What specifically would you want to discuss with her?", timestamp: '00:01:20' },
    { speaker: 'customer', text: "Well, she handles the budget. And honestly I'm not sure if solar is even worth it. How do I know this will actually save us money?", timestamp: '00:01:32' },
    { speaker: 'rep', text: "That's a great question. We actually guarantee your savings in writing. If you don't save what we project, we'll make up the difference.", timestamp: '00:01:45' },
    { speaker: 'customer', text: "Really? That sounds too good to be true. What's the catch?", timestamp: '00:01:55' },
    { speaker: 'rep', text: "No catch - it's our Solar Savings Guarantee. Would it help if I sent you some information about that, along with financing options that could work with your budget?", timestamp: '00:02:08' },
    { speaker: 'customer', text: "Yeah, send that over. My email is still the same.", timestamp: '00:02:20' },
    { speaker: 'rep', text: "Perfect, I'll get that to you today. When would be a good time to follow up after you've had a chance to review it with your wife?", timestamp: '00:02:30' },
    { speaker: 'customer', text: "Maybe next week? Give us a few days to look it over.", timestamp: '00:02:40' },
    { speaker: 'rep', text: "Sounds good. I'll call you Tuesday afternoon. Thanks for your time today!", timestamp: '00:02:48' },
    { speaker: 'customer', text: "Alright, thanks. Talk to you then.", timestamp: '00:02:55' }
  ];

  const fullText = segments.map(s => s.text).join(' ');

  const { data: transcript, error: transcriptError } = await supabase
    .from('call_transcripts')
    .insert({
      call_id: call.id,
      segments: segments,
      full_text: fullText,
      word_count: fullText.split(/\s+/).length,
      duration_seconds: 180
    })
    .select('id')
    .single();

  if (transcriptError) {
    console.error('Error creating transcript:', transcriptError);
    return;
  }

  console.log('Created transcript:', transcript.id);
  console.log('\nTest call created successfully!');
  console.log('Call SID: TEST-COACHING-LAB-001');
  console.log('\nThe transcript includes these objection types:');
  console.log('- Price Objection: "way too expensive", "cost that much"');
  console.log('- Authority Objection: "talk to my wife", "she handles the budget"');
  console.log('- Trust/Skepticism: "too good to be true", "what\'s the catch"');
  console.log('- Timing: "need to think about it"');
  console.log('\nOpen http://localhost:8080/coaching-lab to test!');
}

addTestCall().catch(console.error);
