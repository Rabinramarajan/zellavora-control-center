/** Import the real website into an isolated tenant; never modifies the source site. */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { list, put, head } = require('@vercel/blob');

const backend = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backend, '.env.local') });
dotenv.config({ path: path.join(backend, '../../.env.local') });
const sourceProject = process.argv[2]
  ? path.resolve(process.env.INIT_CWD || process.cwd(), process.argv[2])
  : path.resolve(backend, '../../../galaxy-sofas-websites');
const sourceEnvFile = path.join(sourceProject, '.env.local');
if (!fs.existsSync(sourceEnvFile)) {
  console.error(
    `Galaxy Sofas source environment not found: ${sourceEnvFile}\n` +
      'Pass the website project folder explicitly:\n' +
      'npm run db:import:galaxy-sofas --prefix apps/backend -- "D:/path/to/galaxy-sofas-websites"'
  );
  process.exit(1);
}
const sourceEnv = dotenv.parse(fs.readFileSync(sourceEnvFile));
const token = sourceEnv.BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error('Source project has no Blob token');
const db = new Client({
  // Advisory locks and transactions need a session connection, not the transaction pooler.
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const code = 'galaxy-sofas';
// Stable on retries, including a failed upload before the DB transaction commits.
const seedId = '9809684a-674b-4d13-a729-b2090a2d9924';

async function main() {
  await db.connect();
  // Serialize repeat imports without holding a transaction during network uploads.
  const { locked } = (
    await db.query("select pg_try_advisory_lock(hashtext('import:galaxy-sofas')) as locked")
  ).rows[0];
  if (!locked) throw new Error('Another Galaxy Sofas import is running or left a stale session');
  const existing = (
    await db.query('select id,is_deleted from organizations where client_code=$1', [code])
  ).rows[0];
  if (existing?.is_deleted)
    throw new Error('Galaxy Sofas exists but is deleted; restore it explicitly first');
  const tenantId = existing?.id || seedId;
  const owners = (
    await db.query("select id,email from users where role='owner' and is_deleted=false")
  ).rows;
  const owner = process.env.GALAXY_OWNER_EMAIL
    ? owners.find((user) => user.email === process.env.GALAXY_OWNER_EMAIL)
    : owners.length === 1
      ? owners[0]
      : null;
  if (!owner)
    throw new Error('Set GALAXY_OWNER_EMAIL to an existing owner; no account will be created');

  let cursor;
  const sourceBlobs = [];
  do {
    const page = await list({ prefix: 'galaxy-sofas/', token, cursor, limit: 1000 });
    sourceBlobs.push(...page.blobs.filter((blob) => !blob.pathname.endsWith('/')));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const sourceContent = sourceBlobs.find(
    (blob) => blob.pathname === 'galaxy-sofas/content/site-content.json'
  );
  if (!sourceContent) throw new Error('The source store has no website content JSON');
  const response = await fetch(`${sourceContent.url}?v=${Date.now()}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Content download failed: ${response.status}`);
  const original = await response.json();
  if (original.site?.name !== 'Galaxy Sofas' || !Array.isArray(original.products))
    throw new Error('Unexpected website content');

  const prefix = `tenants/${tenantId}/`;
  const existingBlobs = new Map();
  do {
    const page = await list({ prefix, token, cursor, limit: 1000 });
    page.blobs.forEach((blob) => existingBlobs.set(blob.pathname, blob));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const manifest = [];
  const replacements = new Map();
  const mediaBlobs = sourceBlobs.filter((item) => item !== sourceContent);
  for (let offset = 0; offset < mediaBlobs.length; offset += 5) {
    const results = await Promise.allSettled(
      mediaBlobs.slice(offset, offset + 5).map(async (blob) => {
        const relative = blob.pathname.slice('galaxy-sofas/'.length);
        const pathname = prefix + relative;
        let copy = existingBlobs.has(pathname) ? await head(pathname, { token }) : null;
        if (!copy) {
          const asset = await fetch(blob.url, { signal: AbortSignal.timeout(30000) });
          if (!asset.ok)
            throw new Error(`Asset download failed (${asset.status}): ${blob.pathname}`);
          const bytes = Buffer.from(await asset.arrayBuffer());
          if (bytes.length !== blob.size) throw new Error(`Asset size mismatch: ${blob.pathname}`);
          copy = await put(pathname, bytes, {
            token,
            access: 'public',
            addRandomSuffix: false,
            contentType: asset.headers.get('content-type') || 'application/octet-stream',
          });
          copy = await head(copy.url, { token });
        }
        manifest.push({
          pathname,
          url: copy.url,
          size: copy.size,
          contentType: copy.contentType,
          sourceUrl: blob.url,
        });
        replacements.set(`/images/${relative}`, copy.url);
        replacements.set(blob.url, copy.url);
        if (manifest.length % 25 === 0) console.log(`Verified ${manifest.length} media files`);
      })
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  manifest.sort((a, b) => a.pathname.localeCompare(b.pathname));
  const content = JSON.parse(JSON.stringify(original), (_key, value) =>
    typeof value === 'string' ? replacements.get(value) || value : value
  );
  // Source keeps this generated image outside its /images manifest.
  content.site.ogImage = new URL(content.site.ogImage, content.site.defaultUrl).href;
  const s = content.site;
  const contentPath = prefix + 'content/site-content.json';
  let contentBlob = existingBlobs.get(contentPath);
  if (!contentBlob)
    contentBlob = await put(contentPath, JSON.stringify(content, null, 2), {
      token,
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

  await db.query('BEGIN');
  try {
    await db.query(
      `insert into organizations
      (id,name,client_code,industry,website,email,phone,address,city,state,country,pincode,logo_url,gst_number,updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now()) on conflict (client_code) do nothing`,
      [
        tenantId,
        s.name,
        code,
        'Furniture manufacturing',
        s.defaultUrl,
        s.email,
        s.phones[0].e164,
        s.addressDisplay,
        s.city,
        s.state,
        s.country,
        s.postalCode.replace(/\s/g, ''),
        s.logo,
        s.trust.gstNumber || null,
      ]
    );
    await db.query(
      `insert into branches (id,organization_id,name,code,is_head_office,address,city,state,country,pincode,phone,email,updated_at)
      select $1,$2,$3,'GS-NERKUNDRAM',true,$4,$5,$6,$7,$8,$9,$10,now()
      where not exists (select 1 from branches where organization_id=$2 and code='GS-NERKUNDRAM')`,
      [
        randomUUID(),
        tenantId,
        'Nerkundram Workshop & Showroom',
        s.addressDisplay,
        s.city,
        s.state,
        s.country,
        s.postalCode.replace(/\s/g, ''),
        s.phones[0].e164,
        s.email,
      ]
    );
    await db.query(
      `insert into workspaces (id,organization_id,name,slug,description,updated_at)
      values ($1,$2,'Galaxy Sofas Website','website','Company content, products, services and media',now())
      on conflict (organization_id,slug) do nothing`,
      [randomUUID(), tenantId]
    );
    await db.query(
      `insert into organization_members (user_id,organization_id,role) values ($1,$2,'owner')
      on conflict (user_id,organization_id) do nothing`,
      [owner.id, tenantId]
    );
    const roleKey = `${tenantId}_owner`;
    await db.query(
      `insert into roles (id,name,key,organization_id,description,updated_at)
      values ($1,'Owner',$2,$3,'Galaxy Sofas workspace owner',now()) on conflict (key) do nothing`,
      [randomUUID(), roleKey, tenantId]
    );
    const role = (await db.query('select id from roles where key=$1', [roleKey])).rows[0];
    const permission = (await db.query("select id from permissions where key='*:*'")).rows[0];
    if (!permission) throw new Error('Existing owner wildcard permission is missing');
    await db.query(
      `insert into role_permissions (id,organization_id,role_id,permission_id,effect)
      values ($1,$2,$3,$4,'allow') on conflict (role_id,permission_id) do nothing`,
      [randomUUID(), tenantId, role.id, permission.id]
    );
    await db.query(
      `insert into user_role_assignments (id,user_id,role_id,organization_id,resource_type,resource_id)
      select $1,$2,$3,$4::uuid,'tenant',$4::text where not exists
      (select 1 from user_role_assignments where user_id=$2 and role_id=$3 and organization_id=$4)`,
      [randomUUID(), owner.id, role.id, tenantId]
    );
    const configurations = {
      'website.content': content,
      'website.source': {
        url: s.defaultUrl,
        sourceContentUrl: sourceContent.url,
        importedAt: new Date().toISOString(),
        sha256: createHash('sha256').update(JSON.stringify(original)).digest('hex'),
      },
      'website.media': manifest,
      'website.stores': [
        {
          name: 'Nerkundram Workshop & Showroom',
          address: s.addressFull,
          phones: s.phones,
          openingHours: s.place.openingHours,
        },
      ],
      'storage.blob': { prefix, access: 'public', contentUrl: contentBlob.url },
    };
    for (const [key, value] of Object.entries(configurations)) {
      await db.query(
        `insert into common_configurations (id,organization_id,key,value,category,updated_at)
        values ($1,$2,$3,$4,'website',now()) on conflict (organization_id,key) do nothing`,
        [randomUUID(), tenantId, key, JSON.stringify(value)]
      );
    }
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }

  const envName = `BLOB_READ_WRITE_TOKEN_${tenantId.replace(/-/g, '_').toUpperCase()}`;
  const envFile = path.join(backend, '.env.local');
  const currentEnv = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const configuredToken = dotenv.parse(currentEnv)[envName];
  if (configuredToken && configuredToken !== token)
    throw new Error('Tenant is imported, but a different local store token already exists');
  if (!configuredToken)
    fs.appendFileSync(
      envFile,
      `\n# Galaxy Sofas tenant media\n${envName}=${JSON.stringify(token)}\n`
    );
  const result = {
    tenantId,
    clientCode: code,
    ownerEmail: owner.email,
    source: s.defaultUrl,
    products: content.products.length,
    categories: content.productCategories.length,
    services: content.services.length,
    gallery: content.gallery.items.length,
    images: manifest.filter((item) => item.contentType.startsWith('image/')).length,
    videos: manifest.filter((item) => item.contentType.startsWith('video/')).length,
    mediaBytes: manifest.reduce((sum, item) => sum + item.size, 0),
    contentUrl: contentBlob.url,
    envName,
  };
  console.log(JSON.stringify(result, null, 2));
}
main()
  .catch((error) => {
    console.error('Galaxy Sofas import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
