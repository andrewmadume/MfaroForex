import { cookies } from 'next/headers';
import { sitesPlatform } from '../../../lib/platform';
import { signSession, SESSION_COOKIE } from '../../../lib/session';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const fail=(message:string,status=503)=>Response.json({error:message},{status,headers:noStore});
export async function GET(req:Request,{params}:{params:Promise<{action:string}>}) {
 const {action}=await params;
 if(sitesPlatform()) {
  if(!['signin','signout'].includes(action))return fail('Unknown authentication action.',404);
  return Response.redirect(new URL(`/${action==='signin'?'signin':'signout'}-with-chatgpt?return_to=/`,req.url));
 }
 const jar=await cookies();
 const options={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
 if(action==='signout') {
  const source=req.headers.get('sec-fetch-site');
  if(source&&source!=='same-origin'&&source!=='none')return fail('Cross-site sign-out denied.',403);
  jar.set(SESSION_COOKIE,'',{...options,maxAge:0});
  return new Response(null,{status:303,headers:{...noStore,Location:'/'}});
 }
 const {GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET,MFARO_SESSION_SECRET,MFARO_PUBLIC_URL}=process.env;
 if(!GITHUB_CLIENT_ID||!GITHUB_CLIENT_SECRET||!MFARO_SESSION_SECRET||MFARO_SESSION_SECRET.length<32||!MFARO_PUBLIC_URL)return fail('Vercel sign-in is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, MFARO_SESSION_SECRET (32+ characters), and MFARO_PUBLIC_URL in Vercel Environment Variables. The public demo preview remains available at /.');
 let origin:string;
 try {const configured=new URL(MFARO_PUBLIC_URL);if(configured.protocol!=='https:'&&!(configured.protocol==='http:'&&['localhost','127.0.0.1'].includes(configured.hostname)))throw new Error();origin=configured.origin;}catch{return fail('MFARO_PUBLIC_URL must be an HTTPS origin (or localhost for development).');}
 const callback=`${origin}/auth/callback`;
 if(action==='signin') {
  const state=crypto.randomUUID()+crypto.randomUUID();
  jar.set('mfaro_oauth_state',state,{...options,maxAge:600});
  const url=new URL('https://github.com/login/oauth/authorize');
  url.search=new URLSearchParams({client_id:GITHUB_CLIENT_ID,redirect_uri:callback,state,scope:'read:user user:email'}).toString();
  return new Response(null,{status:302,headers:{...noStore,Location:url.href}});
 }
 if(action!=='callback')return fail('Unknown authentication action.',404);
 const url=new URL(req.url),state=jar.get('mfaro_oauth_state')?.value;
 jar.set('mfaro_oauth_state','',{...options,maxAge:0});
 if(!state||url.searchParams.get('state')!==state||!url.searchParams.get('code'))return fail('Sign-in verification failed. Start sign-in again.',400);
 try {
  const tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:GITHUB_CLIENT_ID,client_secret:GITHUB_CLIENT_SECRET,code:url.searchParams.get('code')!,redirect_uri:callback}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  const token=await tokenResponse.json() as {access_token?:string};
  if(!tokenResponse.ok||!token.access_token)return fail('Identity provider rejected sign-in. Please retry.',401);
  const headers={Authorization:`Bearer ${token.access_token}`,Accept:'application/vnd.github+json','User-Agent':'MfaroForex'};
  const response=await fetch('https://api.github.com/user',{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
  const profile=await response.json() as {id:number;login:string;name?:string;email?:string};
  if(!response.ok||!Number.isInteger(profile.id)||!profile.login)return fail('Identity provider could not verify your profile.',401);
  let email=profile.email;
  if(!email){const emails=await fetch('https://api.github.com/user/emails',{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});if(emails.ok){const list=await emails.json() as {email:string;primary:boolean;verified:boolean}[];email=list.find(e=>e.primary&&e.verified)?.email;}}
  const user={userId:`github:${profile.id}`,email:email||`${profile.id}+${profile.login}@users.noreply.github.com`,displayName:profile.name||profile.login,fullName:profile.name||null};
  jar.set(SESSION_COOKIE,await signSession(user,MFARO_SESSION_SECRET),{...options,maxAge:28800});
  return new Response(null,{status:303,headers:{...noStore,Location:origin+'/'}});
 }catch{return fail('Identity provider unavailable. No session was created.');}
}
