// Maintenance-only grants; never changes passwords or imports into the API.
if(!process.argv.includes('--env-file'))throw Error('Provide an explicit maintenance environment file');
require('./owner-config');
const index=process.argv.indexOf('--role');
const role=index<0?'helpdesk_runtime':process.argv[index+1];
if(!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(role||''))throw Error('Provide a valid runtime role name');
if(!process.env.ADMIN_DATABASE_URL)throw Error('ADMIN_DATABASE_URL is required');
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient({datasources:{db:{url:process.env.ADMIN_DATABASE_URL}}});
(async()=>{await db.$transaction(async tx=>{
 for(const table of ['KnowledgeDocument','KnowledgeChunk'])await tx.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "${table}" TO "${role}"`);
});console.log('Knowledge table grants applied. Existing credentials unchanged.');})().catch(()=>{console.error('Knowledge grants failed. Check migrations, owner access, and runtime role. No credentials printed.');process.exitCode=1;}).finally(()=>db.$disconnect());
