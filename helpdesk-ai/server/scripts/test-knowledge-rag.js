const fs=require('fs');
const {spawnSync}=require('child_process');
const dotenv=require('dotenv');
// This runner never reads production maintenance credentials.
const value=process.env.RAG_TEST_ADMIN_URL||dotenv.parse(fs.readFileSync('.security/owner.env')).ADMIN_DATABASE_URL;
const target=new URL(value);
if(!['localhost','127.0.0.1'].includes(target.hostname))throw new Error('RAG integration verification requires a local PostgreSQL owner');
// Generate before importing the client so new JSON columns are recognized.
const generated=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'generate'],{env:{...process.env,DATABASE_URL:value},encoding:'utf8'});
if(generated.status!==0){console.error('Prisma client generation failed. Run npm run generate and check local file permissions. No credentials printed.');process.exit(1);}
console.log('Prisma client regenerated for the current schema.');
const {PrismaClient}=require('@prisma/client');
const name='knowledge_rag_test_'+Date.now();
const admin=new PrismaClient({datasources:{db:{url:value}}});
(async()=>{let created=false;try{
 await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);created=true;target.pathname='/'+name;
 const env={...process.env,DATABASE_URL:target.href};
 const migration=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{env,encoding:'utf8'});
 if(migration.status!==0)throw Error('Isolated migrations failed');
 const suite=spawnSync(process.execPath,['--test','test/knowledgeRag.integration.js'],{env,stdio:'inherit'});
 if(suite.status!==0)process.exitCode=1;
}finally{if(created)await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.$disconnect();}})().catch(()=>{console.error('Local RAG database verification failed. No connection details printed.');process.exitCode=1;});
