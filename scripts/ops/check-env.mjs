const required=['APP_URL','DOMAIN','SESSION_SECRET','DATA_ENCRYPTION_KEY','DATABASE_URL','MIGRATION_DATABASE_URL','DB_ROOT_PASSWORD','DB_APP_PASSWORD','DB_MIGRATION_PASSWORD','DB_BACKUP_PASSWORD','SMTP_HOST','SMTP_FROM','RESTIC_REPOSITORY','RESTIC_PASSWORD'];
for(const key of required){const value=process.env[key];if(!value||value.includes('REPLACE')||value.includes('example.invalid'))throw Error(`Configure ${key}`)}
if(new URL(process.env.APP_URL).protocol!=='https:')throw Error('HTTPS APP_URL required');
if(Buffer.from(process.env.DATA_ENCRYPTION_KEY,'base64').length!==32||process.env.SESSION_SECRET.length<48)throw Error('Strong independent encryption/session keys required');
if(new Set(['DB_ROOT_PASSWORD','DB_APP_PASSWORD','DB_MIGRATION_PASSWORD','DB_BACKUP_PASSWORD'].map(k=>process.env[k])).size!==4)throw Error('Database roles must use different passwords');
for(const key of ['DB_ROOT_PASSWORD','DB_APP_PASSWORD','DB_MIGRATION_PASSWORD','DB_BACKUP_PASSWORD'])if(!/^[a-f0-9]{48,}$/i.test(process.env[key]))throw Error(`Use URL-safe random hex for ${key}`);
if(new URL(process.env.DATABASE_URL).username!=='tax_app'||new URL(process.env.MIGRATION_DATABASE_URL).username!=='tax_migrator')throw Error('Use separate application/migration roles');
console.log('Required deployment configuration is present; secret values omitted.');
