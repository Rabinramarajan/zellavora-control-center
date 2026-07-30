import fs from 'fs';
import path from 'path';

async function main() {
  const migrationsDir = path.join(__dirname, '../../supabase/migrations');
  const files = fs.readdirSync(migrationsDir);

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    const filepath = path.join(migrationsDir, file);
    let content = fs.readFileSync(filepath, 'utf8');

    if (content.includes('organization_users(id)')) {
      console.log(`Fixing organization_users in ${file}...`);
      content = content.replace(/organization_users\(id\)/g, 'users(id)');
      fs.writeFileSync(filepath, content, 'utf8');
    }
  }
  console.log('✅ Done replacing organization_users references.');
}

main().catch(console.error);
