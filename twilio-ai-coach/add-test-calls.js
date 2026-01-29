/**
 * Add Test Calls for Coaching Lab
 * Creates realistic test scenarios to test the coaching flow
 *
 * Run with: node add-test-calls.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPA')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test Call Scenarios
const testCalls = [
  {
    name: 'Test Model 1 - Full Sales Cycle',
    external_call_id: 'test_full_cycle_001',
    phone_number: '+15551234001',
    duration_seconds: 480,
    segments: [
      // INTRO PHASE
      { speaker: 'rep', text: "Hi, this is Sarah from CleanPro Services. I'm calling about the cleaning quote you requested online. Is this a good time?", timestamp: '00:00' },
      { speaker: 'customer', text: "Oh yes, I did fill that out. I've been meaning to look into getting some help around the house.", timestamp: '00:08' },
      { speaker: 'rep', text: "Great! I'd love to learn more about what you're looking for. My name is Sarah, and I've been helping homeowners in your area for about 3 years now.", timestamp: '00:15' },

      // DISCOVERY PHASE
      { speaker: 'customer', text: "Well, we just had our second baby and things have gotten pretty hectic. The house is a mess.", timestamp: '00:25' },
      { speaker: 'rep', text: "Congratulations on the new baby! I totally understand - that's such a busy time. Tell me, what areas of your home are you most concerned about?", timestamp: '00:32' },
      { speaker: 'customer', text: "Mainly the bathrooms and kitchen. They just don't get the deep cleaning they need anymore. And the floors are always dirty.", timestamp: '00:42' },
      { speaker: 'rep', text: "That makes complete sense. How often would you ideally like someone to come in and help?", timestamp: '00:50' },
      { speaker: 'customer', text: "I was thinking maybe every two weeks? But I'm not sure what's realistic.", timestamp: '00:58' },

      // PRESENTATION PHASE
      { speaker: 'rep', text: "Every two weeks is actually our most popular option for families. Let me tell you what that would include...", timestamp: '01:05' },
      { speaker: 'rep', text: "We'd do a full deep clean of all bathrooms, kitchen including appliances, vacuum and mop all floors, dust all surfaces, and make beds. It typically takes our team about 3 hours.", timestamp: '01:12' },
      { speaker: 'customer', text: "That sounds really thorough. Do you bring your own supplies?", timestamp: '01:25' },
      { speaker: 'rep', text: "Yes! We bring all eco-friendly supplies and equipment. Many of our clients with young children appreciate that we use non-toxic products.", timestamp: '01:32' },

      // PRICING PHASE
      { speaker: 'customer', text: "Okay, so how much would this cost?", timestamp: '01:42' },
      { speaker: 'rep', text: "For a home your size with bi-weekly service, we're looking at $180 per visit. That includes everything I mentioned.", timestamp: '01:48' },
      { speaker: 'customer', text: "Hmm, that's a bit more than I was expecting. I was hoping to stay under $150.", timestamp: '01:58' },

      // OBJECTION HANDLING PHASE
      { speaker: 'rep', text: "I completely understand budget is important, especially with a growing family. Let me ask - how many hours a week do you currently spend cleaning?", timestamp: '02:05' },
      { speaker: 'customer', text: "Probably about 5 or 6 hours when I can find the time. Which isn't often lately.", timestamp: '02:15' },
      { speaker: 'rep', text: "So if we think about it, you're getting back 6 hours every two weeks to spend with your family. That's 12 hours a month. For many of our clients, that time with their kids is priceless.", timestamp: '02:22' },
      { speaker: 'customer', text: "When you put it that way... I do miss having time to just play with the kids instead of always cleaning.", timestamp: '02:35' },
      { speaker: 'rep', text: "Exactly. And here's something else - we offer a satisfaction guarantee. If you're not happy with any cleaning, we'll come back and make it right at no extra charge.", timestamp: '02:42' },

      // CLOSING PHASE
      { speaker: 'customer', text: "That's reassuring. Okay, I think I want to try it. How do we get started?", timestamp: '02:55' },
      { speaker: 'rep', text: "Wonderful! I just need to schedule your first cleaning. We have availability this Thursday or Saturday. Which works better for you?", timestamp: '03:02' },
      { speaker: 'customer', text: "Saturday would be perfect.", timestamp: '03:12' },
      { speaker: 'rep', text: "Great! I have you down for Saturday at 9 AM. You'll receive a confirmation email with all the details. Is there anything else you'd like to know?", timestamp: '03:18' },
      { speaker: 'customer', text: "No, I think that covers it. Thank you so much, Sarah!", timestamp: '03:28' },
      { speaker: 'rep', text: "Thank you! We're excited to help you get your weekends back. Have a great day!", timestamp: '03:35' }
    ]
  },
  {
    name: 'Test Model 2 - Price Objection Heavy',
    external_call_id: 'test_price_objection_002',
    phone_number: '+15551234002',
    duration_seconds: 360,
    segments: [
      { speaker: 'rep', text: "Hi, this is Mike from Solar Solutions. I'm calling about the solar quote you requested. Do you have a few minutes?", timestamp: '00:00' },
      { speaker: 'customer', text: "Sure, I got the quote in my email.", timestamp: '00:08' },
      { speaker: 'rep', text: "Great! What did you think of the proposal?", timestamp: '00:12' },
      { speaker: 'customer', text: "Honestly, it's way too expensive for us right now. We weren't expecting it to cost that much.", timestamp: '00:18' },
      { speaker: 'rep', text: "I hear that a lot initially. Can I ask what you were expecting the investment to be?", timestamp: '00:28' },
      { speaker: 'customer', text: "I don't know, maybe half that? The neighbor said they paid like $15,000.", timestamp: '00:35' },
      { speaker: 'rep', text: "That's helpful context. Your neighbor might have a smaller system or gotten it a few years ago when incentives were different. But let me show you something interesting...", timestamp: '00:42' },
      { speaker: 'customer', text: "I'm listening.", timestamp: '00:52' },
      { speaker: 'rep', text: "Right now you're paying about $200 a month in electricity, right?", timestamp: '00:55' },
      { speaker: 'customer', text: "Yeah, sometimes more in summer.", timestamp: '01:02' },
      { speaker: 'rep', text: "With our financing, your solar payment would be $165 a month. So from day one, you're actually saving $35 a month. You're not spending more - you're spending less.", timestamp: '01:08' },
      { speaker: 'customer', text: "Wait, so I'd be paying less than my current electric bill?", timestamp: '01:22' },
      { speaker: 'rep', text: "Exactly. And in 7 years when it's paid off, your electricity is essentially free. We're talking about $2,400 a year back in your pocket.", timestamp: '01:28' },
      { speaker: 'customer', text: "I didn't realize it worked like that. But what if we move?", timestamp: '01:42' },
      { speaker: 'rep', text: "Great question. Solar actually adds about 4% to your home's value. So if you sell, you either sell with the solar and get more for your home, or you transfer the payments to the new owner.", timestamp: '01:48' },
      { speaker: 'customer', text: "My wife and I need to talk about this. Can you send me that breakdown in writing?", timestamp: '02:05' },
      { speaker: 'rep', text: "Absolutely. I'll email you a detailed comparison showing your current costs versus solar over the next 25 years. When would be a good time for me to follow up after you've had a chance to review it together?", timestamp: '02:12' },
      { speaker: 'customer', text: "Maybe give us a week? Call me next Monday.", timestamp: '02:28' },
      { speaker: 'rep', text: "Perfect. I'll call you Monday at this same time. And remember, the federal tax credit of 30% drops next year, so timing does matter. Talk soon!", timestamp: '02:35' }
    ]
  },
  {
    name: 'Test Model 3 - Discovery Deep Dive',
    external_call_id: 'test_discovery_003',
    phone_number: '+15551234003',
    duration_seconds: 420,
    segments: [
      { speaker: 'rep', text: "Hi, this is Jennifer from TechSupport Pro. I see you downloaded our IT services guide. I wanted to see if I could answer any questions.", timestamp: '00:00' },
      { speaker: 'customer', text: "Oh yes, we've been having some issues with our network lately.", timestamp: '00:10' },
      { speaker: 'rep', text: "I'm sorry to hear that. Tell me more - what kind of issues are you experiencing?", timestamp: '00:16' },
      { speaker: 'customer', text: "The internet keeps dropping during video calls. It's really embarrassing when I'm meeting with clients.", timestamp: '00:22' },
      { speaker: 'rep', text: "That sounds frustrating, especially with client calls. How often would you say this happens?", timestamp: '00:32' },
      { speaker: 'customer', text: "At least once or twice a day. Sometimes more.", timestamp: '00:40' },
      { speaker: 'rep', text: "And when did this start happening? Was it sudden or gradual?", timestamp: '00:45' },
      { speaker: 'customer', text: "It's been getting worse over the past few months. We added a few new employees and that's when it started.", timestamp: '00:52' },
      { speaker: 'rep', text: "That's a really good insight. How many employees do you have now versus before?", timestamp: '01:02' },
      { speaker: 'customer', text: "We went from 8 to 15 people. All working in the office.", timestamp: '01:10' },
      { speaker: 'rep', text: "Almost doubled! And your network equipment - do you know how old it is?", timestamp: '01:16' },
      { speaker: 'customer', text: "The router? I think we got it when we first opened... maybe 5 years ago?", timestamp: '01:24' },
      { speaker: 'rep', text: "That makes sense. A 5-year-old router designed for 8 people is now trying to handle 15 people on video calls. It's like trying to pour a gallon of water through a straw.", timestamp: '01:32' },
      { speaker: 'customer', text: "I never thought of it that way. So what do we need to do?", timestamp: '01:45' },
      { speaker: 'rep', text: "Before I make any recommendations, I want to understand your setup better. What other devices are connected to your network besides computers?", timestamp: '01:52' },
      { speaker: 'customer', text: "We have a printer, a security camera system, everyone's phones... probably some other stuff I'm forgetting.", timestamp: '02:02' },
      { speaker: 'rep', text: "Got it. And do you have any plans to grow more in the next year or two?", timestamp: '02:12' },
      { speaker: 'customer', text: "We're actually hoping to hire 5 more people by end of year if things go well.", timestamp: '02:18' },
      { speaker: 'rep', text: "That's exciting! So we should plan for 20+ people. What's your current IT support situation? Do you have someone in-house or...?", timestamp: '02:25' },
      { speaker: 'customer', text: "My nephew helps us sometimes but he's in college. It's kind of a mess to be honest.", timestamp: '02:35' },
      { speaker: 'rep', text: "No judgment - that's really common for growing businesses. Let me put together a proposal that addresses the immediate network issues and sets you up for growth. Can I schedule a quick site visit to assess your current setup?", timestamp: '02:42' }
    ]
  },
  {
    name: 'Test Model 4 - Closing Techniques',
    external_call_id: 'test_closing_004',
    phone_number: '+15551234004',
    duration_seconds: 300,
    segments: [
      { speaker: 'rep', text: "Hi Tom, this is David following up on our conversation last week about the marketing package. Have you had a chance to review the proposal?", timestamp: '00:00' },
      { speaker: 'customer', text: "I did. It looks good overall. I'm just not sure if now is the right time.", timestamp: '00:10' },
      { speaker: 'rep', text: "I understand. What's making you hesitant about the timing?", timestamp: '00:18' },
      { speaker: 'customer', text: "Q1 is usually slow for us. I'm thinking maybe we start in spring.", timestamp: '00:24' },
      { speaker: 'rep', text: "That makes sense to think about seasonality. But let me ask - if Q1 is slow, isn't that actually the perfect time to build momentum for when things pick up?", timestamp: '00:32' },
      { speaker: 'customer', text: "Hmm, I hadn't thought of it that way.", timestamp: '00:42' },
      { speaker: 'rep', text: "Think about it - marketing takes 2-3 months to really gain traction. If we start now, you'll be hitting your stride right when your busy season begins.", timestamp: '00:48' },
      { speaker: 'customer', text: "That's a good point. But I still need to run it by my partner.", timestamp: '01:00' },
      { speaker: 'rep', text: "Absolutely, that's important. Is your partner available now? I'd be happy to jump on a quick call with both of you.", timestamp: '01:08' },
      { speaker: 'customer', text: "She's actually in the office. Let me see if she can join.", timestamp: '01:16' },
      { speaker: 'rep', text: "Perfect, I'll hold.", timestamp: '01:22' },
      { speaker: 'customer', text: "Okay, I have Lisa here with me now.", timestamp: '01:45' },
      { speaker: 'rep', text: "Hi Lisa! Thanks for joining. Tom and I were just discussing the marketing package. He mentioned you'd want to be part of this decision.", timestamp: '01:50' },
      { speaker: 'customer', text: "Yes, I've seen the proposal. My main question is about the ROI.", timestamp: '02:00' },
      { speaker: 'rep', text: "Great question. Based on your average customer value of $500 and our typical conversion rates, you'd need just 4 new customers per month to break even. Most of our clients see 8-12 new customers.", timestamp: '02:08' },
      { speaker: 'customer', text: "And the contract length?", timestamp: '02:25' },
      { speaker: 'rep', text: "It's a 6-month commitment, which gives us enough time to show real results. After that, it's month-to-month.", timestamp: '02:30' },
      { speaker: 'customer', text: "Tom, what do you think?", timestamp: '02:40' },
      { speaker: 'customer', text: "I think we should do it. The timing argument makes sense.", timestamp: '02:45' },
      { speaker: 'rep', text: "Wonderful! To get you started this week, I just need a few details. Do you prefer the check or credit card for the initial payment?", timestamp: '02:52' }
    ]
  },
  {
    name: 'Test Model 5 - Multiple Objections',
    external_call_id: 'test_objections_005',
    phone_number: '+15551234005',
    duration_seconds: 540,
    segments: [
      { speaker: 'rep', text: "Good afternoon! This is Rachel from FitLife Gym. I'm calling about the membership inquiry you submitted. How are you today?", timestamp: '00:00' },
      { speaker: 'customer', text: "I'm okay. I did look at your gym online but I'm not sure it's for me.", timestamp: '00:10' },
      { speaker: 'rep', text: "I appreciate your honesty! What's making you unsure?", timestamp: '00:18' },
      { speaker: 'customer', text: "Well, I've never really been a gym person. I always feel intimidated.", timestamp: '00:24' },
      { speaker: 'rep', text: "You know, that's actually one of the most common things I hear. Can I share something with you?", timestamp: '00:32' },
      { speaker: 'customer', text: "Sure.", timestamp: '00:40' },
      { speaker: 'rep', text: "About 60% of our members felt the exact same way when they first joined. That's why we have a dedicated beginner area and free orientation sessions. You're never just thrown in.", timestamp: '00:44' },
      { speaker: 'customer', text: "That's good to know. But honestly, the cost is also a concern. I don't know if I'll actually use it.", timestamp: '00:58' },
      { speaker: 'rep', text: "That's a fair concern - no one wants to pay for something they won't use. What if I told you we have a 30-day money-back guarantee? If you don't feel like it's working for you, full refund, no questions asked.", timestamp: '01:06' },
      { speaker: 'customer', text: "Really? That's pretty rare.", timestamp: '01:20' },
      { speaker: 'rep', text: "We believe in what we offer. And honestly, once people get past the first two weeks, they're hooked. It's about building the habit.", timestamp: '01:26' },
      { speaker: 'customer', text: "I guess my schedule is the other issue. I work weird hours.", timestamp: '01:38' },
      { speaker: 'rep', text: "We're open 24/7. Literally any hour of the day or night. A lot of our members are nurses and shift workers who come in at 2 or 3 AM.", timestamp: '01:44' },
      { speaker: 'customer', text: "Oh wow, I didn't realize that. That actually solves a big problem.", timestamp: '01:56' },
      { speaker: 'rep', text: "Perfect! Is there anything else that's holding you back?", timestamp: '02:02' },
      { speaker: 'customer', text: "I've tried gyms before and always quit after a month. I just lose motivation.", timestamp: '02:10' },
      { speaker: 'rep', text: "I hear you. That's why every membership includes a free personal training session each month. Your trainer checks in, adjusts your program, and keeps you accountable. It's like having a fitness friend who actually knows what they're doing.", timestamp: '02:18' },
      { speaker: 'customer', text: "That does sound helpful. How much is the membership again?", timestamp: '02:35' },
      { speaker: 'rep', text: "It's $49 a month with no contract. And right now we're waiving the enrollment fee if you sign up this week - that's a $99 savings.", timestamp: '02:42' },
      { speaker: 'customer', text: "That's actually less than I expected. Can I come see the gym first?", timestamp: '02:55' },
      { speaker: 'rep', text: "Absolutely! When works best for you? I can have one of our trainers give you a personal tour and even a sample workout if you'd like.", timestamp: '03:02' },
      { speaker: 'customer', text: "How about tomorrow after work, around 6?", timestamp: '03:15' },
      { speaker: 'rep', text: "Perfect! I'll book you in with Marcus - he's great with beginners. You'll love him. I'll text you the confirmation. See you tomorrow!", timestamp: '03:20' }
    ]
  }
];

async function insertTestCalls() {
  console.log('Starting test data insertion...\n');

  // Get or create a company (needed for calls table)
  let { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .limit(1)
    .single();

  if (companyError || !company) {
    console.log('Creating test company...');
    const { data: newCompany, error: createError } = await supabase
      .from('companies')
      .insert({ name: 'Test Company', slug: 'test-company' })
      .select()
      .single();

    if (createError) {
      console.error('Error creating company:', createError);
      return;
    }
    company = newCompany;
  }

  console.log(`Using company ID: ${company.id}\n`);

  for (const testCall of testCalls) {
    console.log(`Processing: ${testCall.name}`);

    // Check if call already exists
    const { data: existing } = await supabase
      .from('calls')
      .select('id')
      .eq('external_call_id', testCall.external_call_id)
      .single();

    if (existing) {
      console.log(`  - Already exists, skipping...`);
      continue;
    }

    // Insert call - use valid outcome values: booked, callback, interested, not_interested, etc.
    const outcomes = ['booked', 'callback', 'interested', 'interested', 'booked'];
    const outcome = outcomes[testCalls.indexOf(testCall)] || 'interested';

    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        company_id: company.id,
        external_call_id: testCall.external_call_id,
        phone_number: testCall.phone_number,
        direction: 'outbound',
        status: 'completed',
        outcome: outcome,
        duration_seconds: testCall.duration_seconds,
        started_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // Random time in last 7 days
        ended_at: new Date().toISOString()
      })
      .select()
      .single();

    if (callError) {
      console.error(`  - Error inserting call:`, callError);
      continue;
    }

    console.log(`  - Call inserted with ID: ${call.id}`);

    // Build full text from segments
    const fullText = testCall.segments.map(s => `${s.speaker}: ${s.text}`).join('\n');

    // Insert transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('call_transcripts')
      .insert({
        call_id: call.id,
        segments: testCall.segments,
        full_text: fullText,
        word_count: fullText.split(/\s+/).length,
        duration_seconds: testCall.duration_seconds
      })
      .select()
      .single();

    if (transcriptError) {
      console.error(`  - Error inserting transcript:`, transcriptError);
      continue;
    }

    console.log(`  - Transcript inserted with ${testCall.segments.length} segments`);
    console.log(`  ✓ Complete!\n`);
  }

  console.log('Done! Test calls have been added.');
  console.log('\nTest calls available:');
  testCalls.forEach(tc => {
    console.log(`  - ${tc.name} (${tc.external_call_id})`);
  });
}

insertTestCalls().catch(console.error);
