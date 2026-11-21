import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const repository=process.env.GITHUB_REPOSITORY;
const branch=process.env.GITHUB_HEAD_REF;
const expected=process.env.EXPECTED_HEAD;
if(repository!=='andrewmadume/MfaroForex'||branch!=='security-hardening-2026-11-21'||!expected||!process.env.GH_TOKEN)throw new Error('Dependency publishing context is not authorized.');
async function api(path,method='GET',body){
 const response=await fetch('https://api.github.com/repos/'+repository+path,{method,headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw new Error('GitHub dependency publishing failed: '+response.status);
 return response.json();
}
const ref=await api('/git/ref/heads/'+encodeURIComponent(branch));
if(ref.object.sha!==expected)throw new Error('Branch changed during validation. Re-run against the new head.');
const changed=execFileSync('git',['diff','--name-only','--','package.json','package-lock.json'],{encoding:'utf8'}).trim();
if(!changed){console.log('Dependency files already match the tested versions.');process.exit(0);}
const parent=await api('/git/commits/'+expected);
const tree=await api('/git/trees','POST',{base_tree:parent.tree.sha,tree:await Promise.all(['package.json','package-lock.json'].map(async path=>({path,mode:'100644',type:'blob',content:await readFile(path,'utf8')})))});
const commit=await api('/git/commits','POST',{message:'Refresh dependency versions after security validation',tree:tree.sha,parents:[expected]});
await api('/git/refs/heads/'+encodeURIComponent(branch),'PATCH',{sha:commit.sha,force:false});
console.log('Tested dependency commit: '+commit.sha);
