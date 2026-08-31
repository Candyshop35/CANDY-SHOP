/**
 * Supabase Migration Runner (Direct SQL execution via Service Role)
 *
 * Usage:
 * 1. Get Service Role Key: Supabase Dashboard → Settings → API → service_role (secret)
 * 2. Run: node run-migration.js "your-service-role-key"
 *
 * NEVER commit the service role key to git.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE_KEY = process.argv[2];
if (!SERVICE_ROLE_KEY) {
  console.error(`
❌  Missing Service Role Key

Usage: node run-migration.js "your-service-role-key-here"

Get it from: Supabase Dashboard → Settings → API → service_role (secret)
  `);
  process.exit(1);
}

const SUPABASE_URL = 'https://krdtfonxxdugmhduzwld.supabase.co';
const SCHEMA_PATH = path.join(__dirname, 'supabase', 'schema.sql');

async function run() {
  console.log('🔌 Connecting to Supabase with service role...');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  });

  console.log('📄 Reading schema.sql...');
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');

  // Better splitting: handle semicolons inside strings/functions
  const statements = splitSqlStatements(sql);
  console.log(`📦 Found ${statements.length} statements to execute\n`);

  let success = 0, skipped = 0, errors = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt || stmt.startsWith('--')) continue;

    try {
      // Use raw query via the PostgREST RPC workaround
      // We'll use the internal pgmeta query approach
      const { error } = await supabase.rpc('pg_catalog.exec_sql', { sql: stmt });

      if (error) {
        // Many "errors" are actually OK (IF NOT EXISTS, etc.)
        const msg = error.message || '';
        if (msg.includes('already exists') ||
            msg.includes('duplicate') ||
            msg.includes('already exists') ||
            msg.includes('relation') && msg.includes('exists')) {
          skipped++;
        } else {
          console.warn(`  ⚠️  [${i+1}] ${msg.slice(0, 120)}`);
          errors++;
        }
      } else {
        success++;
      }
    } catch (e) {
      const msg = e.message || String(e);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        skipped++;
      } else {
        console.warn(`  ⚠️  [${i+1}] ${msg.slice(0, 120)}`);
        errors++;
      }
    }

    if ((i + 1) % 15 === 0) process.stdout.write('.');
  }

  console.log('\n');
  console.log(`✅ Completed:`);
  console.log(`   Success: ${success}`);
  console.log(`   Skipped (already exist): ${skipped}`);
  console.log(`   Errors:  ${errors}`);
  console.log('\n🔍 Verify in Supabase Dashboard → Table Editor');
}

function splitSqlStatements(sql) {
  // Remove comments first
  const lines = sql.split('\n').filter(l => !l.trim().startsWith('--'));
  const cleaned = lines.join('\n');

  // Split by semicolon followed by newline and uppercase keyword or end
  const parts = [];
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    current += ch;

    // Handle string literals
    if ((ch === "'" || ch === '"' || ch === '$') && !inString) {
      inString = true;
      stringChar = ch;
    } else if (ch === stringChar && inString && (next !== stringChar || ch === '$')) {
      inString = false;
    }

    // Statement end: semicolon not in string, followed by newline + keyword
    if (ch === ';' && !inString) {
      const remaining = cleaned.slice(i + 1).trimStart();
      if (!remaining || /^(create|insert|alter|drop|grant|comment|create|do|function|trigger|policy|index|bucket|select|update|delete)\b/i.test(remaining)) {
        parts.push(current);
        current = '';
      }
    }
  }
  if (current.trim()) parts.push(current);
  return parts.filter(p => p.trim().length > 10);
}

run().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});