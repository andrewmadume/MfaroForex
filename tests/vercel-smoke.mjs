import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {signSession} from '../lib/session.ts';
const origin='http://127.0.0.1:3100';
assert.ok(JSON.parse(readFileSync('.next/routes-manifest.json','utf8')));
for(const path of ['/','/welcome','/login','/manifest.webmanifest','/sw.js','/offline.html']){const response=await fetch(origin+path);assert.equal(response.status,200,path);}
const forged=await fetch(origin+'/api/terminal',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.invalid'}});assert.equal(forged.status,401);assert.match(forged.headers.get('cache-control'),/no-store/);
const csrf=await fetch(origin+'/api/terminal',{method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
const login=await fetch(origin+'/auth/signin',{redirect:'manual'});assert.equal(login.status,302);assert.equal(new URL(login.headers.get('location')).origin,'https://github.com');const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');assert.ok(cookie.includes('mfaro_oauth_state='));assert.match(login.headers.getSetCookie().join('; '),/HttpOnly/);assert.match(login.headers.getSetCookie().join('; '),/Secure/);
const callback=await fetch(origin+'/auth/callback?code=invalid&state=wrong',{headers:{Cookie:cookie},redirect:'manual'});assert.equal(callback.status,400);
const secret='test-only-secret-0123456789abcdef0123456789';const signed=await signSession({userId:'github:12345',displayName:'Smoke',email:'test@example.invalid',fullName:null},secret);const account=await fetch(origin+'/api/terminal',{headers:{Cookie:'mfaro_session='+signed}});assert.equal(account.status,503);assert.match((await account.json()).error,/database unavailable/i);
console.log('PASS: native Next production pages/PWA, routes-manifest, spoofed-header denial, origin protection, OAuth redirect and secure cookie, invalid OAuth state, missing database fails closed.');
