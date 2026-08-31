/**
 * Promote a user to owner role in Supabase
 * Usage: node make-owner.js "your-service-role-key" "user-email@example.com"
 *
 * Get Service Role Key from: Supabase Dashboard → Settings → API → service_role (secret)
 * NEVER commit this key to git.
 */

const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE_KEY = process.argv[2];
const USER_EMAIL = process.argv[3];

if (!SERVICE_ROLE_KEY || !USER_EMAIL) {
  console.error(`
❌ Usage: node make-owner.js "your-service-role-key" "user-email@example.com"

Get Service Role Key from: Supabase Dashboard → Settings → API → service_role (secret)
  `);
  process.exit(1);
}

const SUPABASE_URL = 'https://krdtfonxxdugmhduzwld.supabase.co';

async function promote() {
  console.log('🔌 Connecting to Supabase with service role...');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  });

  // Find the user by email
  console.log(`🔍 Looking up user: ${USER_EMAIL}`);
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    console.error('❌ Failed to list users:', userError.message);
    process.exit(1);
  }

  const user = users.users.find(u => u.email === USER_EMAIL);
  if (!user) {
    console.error(`❌ No user found with email: ${USER_EMAIL}`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.id}`);

  // Update profile role to owner
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'owner', updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (profileError) {
    console.error('❌ Failed to update profile:', profileError.message);
    process.exit(1);
  }

  console.log('✅ User promoted to owner!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Log out and log back in on the website');
  console.log('2. The Admin Dashboard button will appear in the nav');
  console.log('3. You can now generate owner/employee keys for others');
}

promote().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});