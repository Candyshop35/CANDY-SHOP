/**
 * Create the INVYX owner account in Supabase Auth
 * Usage: node create-invyx.js "your-service-role-key"
 *
 * This creates a real Supabase Auth user with email invyx@owner.local
 * and password "2705", then sets their profile role to "owner".
 * After running this, you can login with:
 *   Username: INVYX
 *   Password: 2705
 *
 * Get Service Role Key from: Supabase Dashboard → Settings → API → service_role (secret)
 * NEVER commit this key to git.
 */

const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error(`
❌ Usage: node create-invyx.js "your-service-role-key"

Get Service Role Key from: Supabase Dashboard → Settings → API → service_role (secret)
  `);
  process.exit(1);
}

const SUPABASE_URL = 'https://krdtfonxxdugmhduzwld.supabase.co';
const INVYX_EMAIL = 'invyx@owner.local';
const INVYX_PASSWORD = '2705';

async function createInvyx() {
  console.log('🔌 Connecting to Supabase with service role...');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  });

  // Check if user already exists
  console.log(`🔍 Checking for existing user: ${INVYX_EMAIL}`);
  const { data: users } = await supabase.auth.admin.listUsers();
  const existing = users.users.find(u => u.email === INVYX_EMAIL);

  let userId;

  if (existing) {
    console.log(`✅ User already exists: ${existing.id}`);
    userId = existing.id;

    // Update password to ensure it's "2705"
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: INVYX_PASSWORD
    });
    if (updateError) {
      console.error('❌ Failed to update password:', updateError.message);
    } else {
      console.log('✅ Password updated to 2705');
    }
  } else {
    // Create the user
    console.log('👤 Creating INVYX user...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: INVYX_EMAIL,
      password: INVYX_PASSWORD,
      email_confirm: true, // skip email confirmation
      user_metadata: { name: 'INVYX' }
    });

    if (createError) {
      console.error('❌ Failed to create user:', createError.message);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`✅ User created: ${userId}`);
  }

  // Update profile to owner role
  console.log('👑 Setting role to owner...');
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      name: 'INVYX',
      email: INVYX_EMAIL,
      role: 'owner',
      status: 'active',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (profileError) {
    console.error('❌ Failed to update profile:', profileError.message);
    process.exit(1);
  }

  console.log('✅ Profile updated to owner');
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('✅ INVYX owner account ready!');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('You can now login with:');
  console.log('  Username: INVYX');
  console.log('  Password: 2705');
  console.log('');
  console.log('Or use email: invyx@owner.local');
  console.log('');
  console.log('The username login works because the app');
  console.log('looks up the email from the username in profiles.');
}

createInvyx().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});