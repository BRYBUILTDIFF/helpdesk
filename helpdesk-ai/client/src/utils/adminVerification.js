const tokens = new Map();
const prefix = 'helpdesk-admin-verification:';
const key = userId => prefix + String(userId);
function valid(token,userId) {
  try {
    const payload = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length/4)*4,'=')));
    // This is an expiry/identity hint only. The API verifies the signature,
    // token version and current account factor before granting admin access.
    return claims.purpose==='admin-mfa' && String(claims.id)===String(userId) && Number.isFinite(claims.exp) && claims.exp*1000>Date.now();
  } catch { return false; }
}
export function getAdminVerification(userId) {
  const id=String(userId);
  let token=tokens.get(id)||'';
  if(!token){try{token=window.sessionStorage.getItem(key(userId))||'';}catch{/* Memory-only fallback when storage is blocked. */}}
  if(!valid(token,userId)){setAdminVerification(userId,'');return '';}
  tokens.set(id,token);
  return token;
}
export function setAdminVerification(userId,value) {
  const id=String(userId);
  if(value&&valid(value,userId)){
    tokens.set(id,value);
    try{window.sessionStorage.setItem(key(userId),value);}catch{/* Memory-only fallback. */}
  }else{
    tokens.delete(id);
    try{window.sessionStorage.removeItem(key(userId));}catch{/* Storage can be blocked. */}
  }
}
export function clearAdminVerification() {
  tokens.clear();
  try{
    const storage=window.sessionStorage;
    for(let index=storage.length-1;index>=0;index--){const name=storage.key(index);if(name?.startsWith(prefix))storage.removeItem(name);}
  }catch{/* Storage can be blocked. */}
}
