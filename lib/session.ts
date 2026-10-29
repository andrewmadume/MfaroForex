export type SessionUser={userId:string;displayName:string;email:string;fullName:string|null};
export const SESSION_COOKIE='mfaro_session';
const encode=(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64url');
async function key(secret:string){return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signSession(user:SessionUser,secret:string,now=Date.now()) {
  if(secret.length<32)throw new Error('Session secret must contain at least 32 characters.');
  const payload=encode(new TextEncoder().encode(JSON.stringify({...user,expires:Math.floor(now/1000)+28800})));
  const signature=await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}
export async function verifySession(value:string|undefined,secret:string|undefined,now=Date.now()):Promise<SessionUser|null>{
  if(!value||!secret||secret.length<32||value.length>8192)return null;
  try {const parts=value.split('.');if(parts.length!==2)return null;const [payload,signature]=parts;
    if(!await crypto.subtle.verify('HMAC',await key(secret),Buffer.from(signature,'base64url'),new TextEncoder().encode(payload)))return null;
    const user=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(typeof user.expires!=='number'||user.expires<=now/1000||typeof user.userId!=='string'||!user.userId.startsWith('github:')||typeof user.email!=='string'||typeof user.displayName!=='string')return null;
    return {userId:user.userId,email:user.email,displayName:user.displayName,fullName:typeof user.fullName==='string'?user.fullName:null};
  }catch{return null;}
}
