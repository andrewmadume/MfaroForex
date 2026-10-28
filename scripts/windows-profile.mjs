// Restricted Windows sessions can deny os.userInfo(), used by tsx only to name
// a temporary cache directory. This fallback changes no OS permissions or identity.
import os from 'node:os';
import {syncBuiltinESMExports} from 'node:module';
if(process.platform==='win32'){
 const original=os.userInfo;
 try{original();}catch(error){
  if(error.info?.code!=='ENOMEM'&&error.code!=='ENOMEM')throw error;
  os.userInfo=(options)=>{try{return original(options);}catch(e){if(e.info?.code!=='ENOMEM'&&e.code!=='ENOMEM')throw e;return {username:process.env.USERNAME||'sites-local',homedir:os.homedir(),shell:null,uid:-1,gid:-1};}};
  syncBuiltinESMExports();
 }
}

