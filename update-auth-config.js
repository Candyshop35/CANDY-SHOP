/**
 * Update Supabase Auth Config via Management API
 * Usage: node update-auth-config.js "your-service-role-key"
 */

const SERVICE_ROLE_KEY = process.argv[2];
if (!SERVICE_ROLE_KEY) {
  console.error('❌ Usage: node update-auth-config.js "your-service-role-key"');
  console.error('Get it from: Dashboard → Settings → API → service_role (secret)');
  process.exit(1);
}

const PROJECT_REF = 'krdtfonxxdugmhduzwld';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

const config = {
  site_url: 'https://candyshop35.github.io/CANDY-SHOP/',
  additional_redirect_urls: [
    'https://candyshop35.github.io/CANDY-SHOP/',
    'http://localhost:5500'
  ],
  email_confirm: false  // Disable email confirmations
};

async function update() {
  console.log('🔧 Updating Supabase Auth config via Management API...');

  try {
    const response = await fetch(API_URL, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Auth config updated successfully!');
    console.log('   Site URL:', result.site_url);
    console.log('   Redirect URLs:', result.additional_redirect_urls);
    console.log('   Email confirm:', result.email_confirm);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
}

update();