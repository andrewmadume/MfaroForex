import {configuredFeed,cachedFeed,FeedError} from '../../../lib/market-feed';
export const dynamic='force-dynamic';
export async function GET(){try{const feed=configuredFeed();const snapshot=await cachedFeed('snapshot',()=>feed.snapshot());return Response.json(snapshot,{headers:{'Cache-Control':'public, max-age=0, s-maxage=60','X-Content-Type-Options':'nosniff'}});}catch(e){return Response.json({error:e instanceof FeedError?e.message:'Market-data service unavailable.',quotes:[]},{status:e instanceof FeedError?e.status:503,headers:{'Cache-Control':'no-store'}});}}
