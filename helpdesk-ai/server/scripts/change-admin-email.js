// Owner-only recovery. Never expose this through a public HTTP route.
async function changeAdminEmail(db,from,to,apply=false){
 const email=value=>typeof value==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?value.trim().toLowerCase():null;
 const oldEmail=email(from),newEmail=email(to);
 if(!oldEmail||!newEmail||oldEmail===newEmail)throw Error('Provide different valid old and new administrator emails');
 return db.$transaction(async tx=>{
  const user=await tx.user.findUnique({where:{email:oldEmail},select:{id:true,email:true,role:true,isActive:true,tokenVersion:true}});
  if(!user||user.role!=='ADMIN'||!user.isActive)throw Error('Old email does not identify an active administrator');
  if(await tx.user.findUnique({where:{email:newEmail},select:{id:true}}))throw Error('New email is already assigned to an account');
  if(!apply)return {id:user.id,from:oldEmail,to:newEmail,changed:false};
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mfa:${user.id}`}))`;
  const changed=await tx.user.updateMany({where:{id:user.id,email:oldEmail,role:'ADMIN',isActive:true,tokenVersion:user.tokenVersion},data:{email:newEmail,tokenVersion:{increment:1}}});
  if(changed.count!==1)throw Error('Account changed during recovery; check it again');
  await tx.$executeRaw`DELETE FROM "AdminSecurity" WHERE "userId"=${user.id}`;
  await tx.refreshToken.deleteMany({where:{userId:user.id}});
  await tx.adminAuditLog.create({data:{actorId:0,method:'MAINTENANCE',path:`/maintenance/admin-email-change/${user.id}`,status:200,metadata:{actorRole:'DATABASE_OWNER',operation:'ADMIN_EMAIL_CHANGE',targetUserId:user.id}}});
  return {id:user.id,from:oldEmail,to:newEmail,changed:true};
 });
}
async function main(){
 const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
 if(!args.includes('--env-file')||!args.includes('--from')||!args.includes('--to'))throw Error('Use --env-file, --from and --to; --apply commits the change');
 require('./owner-config');
 if(!process.env.ADMIN_DATABASE_URL)throw Error('Explicit maintenance file must contain ADMIN_DATABASE_URL');
 const {PrismaClient}=require('@prisma/client');const db=new PrismaClient({datasources:{db:{url:process.env.ADMIN_DATABASE_URL}}});
 try{console.log(JSON.stringify(await changeAdminEmail(db,arg('--from'),arg('--to'),args.includes('--apply'))));}finally{await db.$disconnect();}
}
if(require.main===module)main().catch(error=>{console.error('Administrator email change failed. Check the exact emails and private maintenance connection. No secrets printed.');process.exitCode=1;});
module.exports={changeAdminEmail};
