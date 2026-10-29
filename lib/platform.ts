import { AsyncLocalStorage } from 'node:async_hooks';
// Only the trusted Worker entrypoint can establish this context.
const context = new AsyncLocalStorage<{database?: D1Database}>();
export function withSitesPlatform<T>(database:D1Database|undefined, run:()=>T):T {return context.run({database},run);}
export function sitesPlatform(){return context.getStore();}
