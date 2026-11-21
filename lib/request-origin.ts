import {sitesPlatform} from './platform.ts';
export function validRequestOrigin(req:Request, configured=process.env.MFARO_PUBLIC_URL, embedded=!!sitesPlatform()):boolean {
 try {
  const expected=new URL(!embedded&&configured?configured:req.url);
  if(expected.protocol!=='https:'&&!(expected.protocol==='http:'&&['localhost','127.0.0.1'].includes(expected.hostname)))return false;
  return req.headers.get('origin')===expected.origin;
 }catch{return false;}
}
