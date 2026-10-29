import { sitesPlatform } from './platform.ts';
type Result={results:Record<string,unknown>[];meta:{changes:number};success:boolean};
export interface DatabaseStatement {
  bind(...values:unknown[]):DatabaseStatement;
  first<T=Record<string,unknown>>():Promise<T|null>;
  run():Promise<{meta:{changes:number}}>;
}
export interface Database {prepare(sql:string):DatabaseStatement;}
export function restDatabase(accountId:string,databaseId:string,token:string,request:typeof fetch=fetch):Database {
  const endpoint=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  return {prepare(sql:string){
    function statement(params:unknown[]=[]):DatabaseStatement {
      async function execute():Promise<Result>{
        try { const response=await request(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params}),cache:'no-store',signal:AbortSignal.timeout(15000)});
        const body=await response.json() as {success?:boolean;result?:Result[]};
        if(!response.ok||!body.success||!body.result?.[0]?.success)throw new Error('Account database unavailable.');
        return body.result[0];}catch{throw new Error('Account database unavailable.');}
      }
      return {bind:(...values)=>statement(values),async first<T>(){const result=await execute();return (result.results[0] as T)||null;},async run(){const result=await execute();return {meta:result.meta};}};
    }
    return statement();
  }};
}
export function getAccountDatabase():Database|undefined {
  const platform=sitesPlatform();
  if(platform)return platform.database as Database|undefined;
  const {CLOUDFLARE_ACCOUNT_ID,CLOUDFLARE_D1_DATABASE_ID,CLOUDFLARE_D1_API_TOKEN}=process.env;
  if(!CLOUDFLARE_ACCOUNT_ID||!CLOUDFLARE_D1_DATABASE_ID||!CLOUDFLARE_D1_API_TOKEN)return undefined;
  return restDatabase(CLOUDFLARE_ACCOUNT_ID,CLOUDFLARE_D1_DATABASE_ID,CLOUDFLARE_D1_API_TOKEN);
}

