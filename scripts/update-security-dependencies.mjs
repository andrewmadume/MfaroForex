import {readFile, writeFile} from 'node:fs/promises';

// Run explicitly during a reviewed dependency refresh, never during deployment.
// Stay within stable major versions (and within a minor for 0.x packages).
const path=new URL('../package.json',import.meta.url);
const pkg=JSON.parse(await readFile(path,'utf8'));
function parts(version){return /^(\d+)\.(\d+)\.(\d+)$/.exec(version)?.slice(1).map(Number);}
function compare(a,b){const x=parts(a),y=parts(b);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2];}
const updates=[];
async function refresh(name,current){
 const base=/\d+\.\d+\.\d+/.exec(current)?.[0];
 if(!base)throw new Error('Unsupported dependency range: '+name);
 const [major,minor]=parts(base);
 const response=await fetch('https://registry.npmjs.org/'+encodeURIComponent(name),{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('Cannot read registry metadata for '+name);
 const meta=await response.json();
 const candidates=Object.keys(meta.versions).filter(version=>{const p=parts(version);return p&&(name==='@cloudflare/workers-types'?p[0]===5:p[0]===major&&(major!==0||p[1]===minor))&&compare(version,base)>=0;});
 if(!candidates.length)return current; // Preserve an existing prerelease if no stable candidate exists.
 const selected=candidates.sort(compare).at(-1);
 if(current!==selected)updates.push({name,from:current,to:selected});
 return selected;
}
for(const section of ['dependencies','devDependencies'])for(const [name,current] of Object.entries(pkg[section]||{}))pkg[section][name]=await refresh(name,current);
// Keep the framework's ESLint package aligned with Next, and React's renderer aligned.
pkg.devDependencies['eslint-config-next']=pkg.dependencies.next;
pkg.dependencies['react-dom']=pkg.dependencies.react;
pkg.devDependencies['react-server-dom-webpack']=pkg.dependencies.react;
for(const [name,value] of Object.entries(pkg.overrides||{})){
 if(typeof value==='string')pkg.overrides[name]=await refresh(name,value);
 else for(const [child,version] of Object.entries(value))value[child]=await refresh(child,version);
}
// Deprecated esbuild-kit still pulls esbuild 0.18. Its transform API is exercised
// by db:generate in validation; narrow the override to this one legacy parent.
pkg.overrides['@esbuild-kit/core-utils']={esbuild:'^0.25.12'};
await writeFile(path,JSON.stringify(pkg,null,2)+'\n');
await writeFile(new URL('../dependency-updates.json',import.meta.url),JSON.stringify(updates,null,2)+'\n');
console.log(JSON.stringify(updates,null,2));
