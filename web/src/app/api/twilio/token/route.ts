import { createClient } from '@/lib/supabase/server';
import { generateAccessToken } from '@/lib/twilio';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use "rep" as identity to match inbound call routing
    // For multiple reps, you'd want to use unique identities and route accordingly
    const searchParams = req.nextUrl.searchParams;
    const identity = searchParams.get('identity') || 'rep';

    console.log('[Twilio Token] Generating token for identity:', identity);

    // Generate Twilio access token
    const token = generateAccessToken(identity);
    console.log('[Twilio Token] Token generated successfully for:', identity);

    return Response.json({
      token,
      identity,
      userId: user.id,
    });
  } catch (error) {
    console.error('Failed to generate Twilio token:', error);

    return Response.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
