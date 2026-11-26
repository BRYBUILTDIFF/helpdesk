const {createHmac,timingSafeEqual,createHash}=require('crypto');
const fail=()=>Object.assign(new Error('The evidence preview expired, changed, or belongs to another request. Find supporting passages again.'),{status:409,publicMessage:'The evidence preview expired, changed, or belongs to another request. Find supporting passages again.'});
const queryHash=query=>createHash('sha256').update(String(query).trim()).digest('hex');
function sign(value){if(!process.env.JWT_ACCESS_SECRET)throw Error('Access signing secret is required');return createHmac('sha256',process.env.JWT_ACCESS_SECRET).update(value).digest('base64url');}
function createEvidenceToken(query,userId,sources){
 const value=Buffer.from(JSON.stringify({query:queryHash(query),userId,sources,expires:Date.now()+10*60*1000})).toString('base64url');
 return value+'.'+sign(value);
}
async function readEvidenceToken(token,query,userId){
 let payload;
 try{
  if(typeof token!=='string'||token.length>120000)throw Error();
  const [value,signature,...extra]=token.split('.'),expected=sign(value||'');
  if(extra.length||!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw Error();
  payload=JSON.parse(Buffer.from(value,'base64url').toString());
  if(payload.userId!==userId||payload.query!==queryHash(query)||payload.expires<Date.now())throw Error();
 }catch{throw fail();}
 await require('./knowledgeService').assertSourcesCurrent(require('../prisma'),payload.sources);
 return payload.sources;
}
module.exports={createEvidenceToken,readEvidenceToken};
