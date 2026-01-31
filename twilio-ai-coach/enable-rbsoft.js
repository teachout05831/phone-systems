// Quick script to enable RBsoft for the only company in the system
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function enableRBsoft() {
  try {
    // Get the first/only company
    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .limit(1);

    if (companyError) {
      console.error('Error fetching company:', companyError);
      return;
    }

    if (!companies || companies.length === 0) {
      console.error('No companies found');
      return;
    }

    const company = companies[0];
    console.log(`Found company: ${company.name} (${company.id})`);

    // Check if company_settings exists for this company
    const { data: existing, error: checkError } = await supabase
      .from('company_settings')
      .select('id, rbsoft_enabled')
      .eq('company_id', company.id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking settings:', checkError);
      return;
    }

    if (existing) {
      // Update existing row
      const { error: updateError } = await supabase
        .from('company_settings')
        .update({ rbsoft_enabled: true, updated_at: new Date().toISOString() })
        .eq('company_id', company.id);

      if (updateError) {
        console.error('Error updating:', updateError);
        return;
      }
      console.log('RBsoft ENABLED for', company.name);
    } else {
      // Insert new row
      const { error: insertError } = await supabase
        .from('company_settings')
        .insert({ company_id: company.id, rbsoft_enabled: true });

      if (insertError) {
        console.error('Error inserting:', insertError);
        return;
      }
      console.log('RBsoft ENABLED for', company.name, '(created new settings row)');
    }

    console.log('\nDone! Refresh your Settings page to see RBsoft enabled.');

  } catch (err) {
    console.error('Error:', err);
  }
}

enableRBsoft();
