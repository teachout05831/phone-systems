const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
console.log('Supabase URL:', supabaseUrl ? 'Found' : 'MISSING');
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Check tickets
  const { data: tickets, error: ticketErr } = await supabase
    .from('coaching_improvement_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('=== TICKETS ===');
  if (ticketErr) {
    console.log('Error:', ticketErr.message);
  } else if (tickets && tickets.length > 0) {
    tickets.forEach(t => console.log('Ticket #' + t.ticket_number + ':', t.title, '|', t.status, '|', t.category));
  } else {
    console.log('No tickets found');
  }

  // Check sessions
  const { data: sessions, error: sessErr } = await supabase
    .from('coaching_assistant_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(3);

  console.log('');
  console.log('=== SESSIONS ===');
  if (sessErr) {
    console.log('Error:', sessErr.message);
  } else if (sessions && sessions.length > 0) {
    sessions.forEach(s => console.log('Session:', s.session_token?.substring(0, 25) + '...', '| Messages:', s.message_count, '| Tickets:', s.tickets_created));
  } else {
    console.log('No sessions found');
  }

  // Check messages
  const { data: messages, error: msgErr } = await supabase
    .from('coaching_assistant_messages')
    .select('role, content')
    .order('created_at', { ascending: false })
    .limit(8);

  console.log('');
  console.log('=== RECENT MESSAGES ===');
  if (msgErr) {
    console.log('Error:', msgErr.message);
  } else if (messages && messages.length > 0) {
    messages.forEach(m => console.log(m.role + ':', m.content?.substring(0, 120) + '...'));
  } else {
    console.log('No messages found');
  }
}

check().catch(console.error);
