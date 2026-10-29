import { markets } from './trading.ts';
import type { FeedQuote,FeedSnapshot,FeedHistory,FeedBar } from './market-types.ts';
export class FeedError extends Error {status:number;constructor(message:string,status=503){super(message);this.status=status;}}
const symbols=markets.map(m=>m.symbol as string);
const intervals:Record<string,string>={'1m':'1min','5m':'5min','15m':'15min','30m':'30min','1h':'1h','4h':'4h','1D':'1day','1W':'1week'};
const positive=(v:unknown)=>{const n=Number(v);if(v===null||v===''||!Number.isFinite(n)||n<=0)throw new FeedError('Market provider returned an invalid price.');return n;};
const timestamp=(v:unknown)=>{const n=typeof v==='number'?v*1000:Date.parse(String(v).includes('T')?String(v):String(v).replace(' ','T')+(String(v).length===10?'T00:00:00Z':'Z'));if(!Number.isFinite(n)||n<=0)throw new FeedError('Market provider omitted its price timestamp.');return n;};
type ReferenceRow={date:string;base:string;quote:string;rate:number};
export function referenceSeries(rows:ReferenceRow[],symbol:string):FeedBar[]{
 const [base,quote]=symbol.split('/');const days=new Map<string,Record<string,number>>();
 for(const row of rows){if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||row.base!=='EUR')throw new FeedError('Unexpected reference-rate response.');const values=days.get(row.date)||{EUR:1};values[row.quote]=positive(row.rate);days.set(row.date,values);}
 return [...days].sort(([a],[b])=>a.localeCompare(b)).filter(([,rates])=>rates[base]&&rates[quote]).map(([date,rates])=>({time:Date.parse(date+'T00:00:00Z'),close:positive(rates[quote]/rates[base])}));
}
export function candleSeries(values:any[]):FeedBar[]{
 if(!Array.isArray(values)||values.length<2||values.length>500)throw new FeedError('No usable candle history was returned.');
 const bars=values.map(v=>{const open=positive(v.open),high=positive(v.high),low=positive(v.low),close=positive(v.close);if(high<Math.max(open,close)||low>Math.min(open,close)||high<low)throw new FeedError('Market provider returned inconsistent candles.');return {time:timestamp(v.datetime),open,high,low,close,...(v.volume!==undefined&&Number.isFinite(Number(v.volume))&&Number(v.volume)>=0?{volume:Number(v.volume)}:{})};}).sort((a,b)=>a.time-b.time);
 if(new Set(bars.map(b=>b.time)).size!==bars.length)throw new FeedError('Market provider returned duplicate candle timestamps.');return bars;
}
export function createMarketFeed({provider='frankfurter',key,request=fetch,now=()=>Date.now()}:{provider?:string;key?:string;request?:typeof fetch;now?:()=>number}={}){
 if(!['frankfurter','twelvedata'].includes(provider))throw new FeedError('Unsupported FOREX_PROVIDER configuration.');
 if(provider==='twelvedata'&&!key)throw new FeedError('Intraday feed is not configured. Set TWELVE_DATA_API_KEY on the server.');
 const fetched=()=>new Date(now()).toISOString();
 async function json(url:URL){try{const r=await request(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(r.status===429)throw new FeedError('Market-data quota exceeded. Please retry later.',429);if(!r.ok)throw new FeedError('Market-data provider is unavailable.');const d=await r.json() as any;if(d?.status==='error'||d?.code){throw new FeedError(Number(d.code)===429?'Market-data quota exceeded. Please retry later.':'Market-data provider rejected this request or your plan does not cover it.',Number(d.code)===429?429:503);}return d;}catch(e){if(e instanceof FeedError)throw e;throw new FeedError('Market-data connection unavailable. No simulated data has been substituted.');}}
 let reference:Promise<ReferenceRow[]>|undefined;
 function rows(){return reference??=(()=>{const from=new Date(now()-150*86400000).toISOString().slice(0,10);const url=new URL('https://api.frankfurter.dev/v2/providers/ecb/rates');url.search=new URLSearchParams({base:'EUR',quotes:'USD,GBP,JPY,ZAR,AUD,CHF',from}).toString();return json(url).then(d=>{if(!Array.isArray(d)||d.length>2000)throw new FeedError('Unexpected reference-rate response.');return d;});})();}
 function twelve(path:string,params:Record<string,string>){const url=new URL('https://api.twelvedata.com/'+path);url.search=new URLSearchParams({...params,apikey:key!}).toString();return json(url);}
 return {
  async snapshot():Promise<FeedSnapshot>{
   if(provider==='frankfurter') {const source=await rows();const quotes=symbols.map(symbol=>{const series=referenceSeries(source,symbol);if(series.length<2)throw new FeedError('Insufficient reference-rate history.');const last=series[series.length-1],previous=series[series.length-2];return {symbol,last:last.close,changePercent:(last.close/previous.close-1)*100,asOf:new Date(last.time).toISOString().slice(0,10),stale:now()-last.time>5*86400000};});return {provider:'frankfurter-ecb',cadence:'daily-reference',fetchedAt:fetched(),quotes,intervals:['1D'],notice:'ECB daily reference rates via Frankfurter. Not real-time, executable bid/ask, or broker prices.'};}
   const data=await twelve('quote',{symbol:symbols.join(','),timezone:'UTC'});const quotes:FeedQuote[]=symbols.map(symbol=>{const v=data[symbol];if(!v||v.status==='error')throw new FeedError(`Provider coverage unavailable for ${symbol}.`);const time=timestamp(Number(v.timestamp));const change=Number(v.percent_change);return {symbol,last:positive(v.close),changePercent:v.percent_change!==undefined&&Number.isFinite(change)?change:null,asOf:new Date(time).toISOString(),stale:now()-time>120000};});return {provider:'twelvedata',cadence:'provider-quotes',fetchedAt:fetched(),quotes,intervals:Object.keys(intervals),notice:'Twelve Data indicative last prices. Delay and coverage depend on your subscription. No executable bid/ask is supplied. Polled every 60 seconds.'};
  },
  async history(symbol:string,interval:string):Promise<FeedHistory>{
   if(!symbols.includes(symbol)||!intervals[interval])throw new FeedError('Unsupported instrument or interval.',400);
   if(provider==='frankfurter'){if(interval!=='1D')throw new FeedError('Daily reference rates support the 1D line chart only. Configure an intraday provider for other intervals.',400);const bars=referenceSeries(await rows(),symbol);if(bars.length<2)throw new FeedError('No reference history is available.');return {provider:'frankfurter-ecb',symbol,interval,kind:'line',asOf:new Date(bars[bars.length-1].time).toISOString().slice(0,10),fetchedAt:fetched(),bars,notice:'Daily published reference observations. No invented OHLC candles or volume.'};}
   const response=await twelve('time_series',{symbol,interval:intervals[interval],outputsize:'160',timezone:'UTC',order:'asc'});const bars=candleSeries(response.values);return {provider:'twelvedata',symbol,interval,kind:'candlestick',asOf:new Date(bars[bars.length-1].time).toISOString(),fetchedAt:fetched(),bars,notice:'Provider OHLC history. Bar timestamps are UTC; volume appears only if supplied.'};
  }
 };
}
// Only public market data is cached; no account/session/trading data enters here.
let current:{id:string;expires:number;feed:ReturnType<typeof createMarketFeed>}|undefined;
const pending=new Map<string,{expires:number;result:Promise<unknown>}>();
export function configuredFeed(){const provider=process.env.FOREX_PROVIDER||'frankfurter',key=process.env.TWELVE_DATA_API_KEY;const id=provider+':'+(key||'');if(!current||current.id!==id||current.expires<Date.now()){current={id,expires:Date.now()+60000,feed:createMarketFeed({provider,key})};pending.clear();}return current.feed;}
export function cachedFeed<T>(key:string,run:()=>Promise<T>):Promise<T>{const cached=pending.get(key);if(cached&&cached.expires>Date.now())return cached.result as Promise<T>;if(pending.size>=64)pending.delete(pending.keys().next().value!);const result=run();pending.set(key,{expires:Date.now()+60000,result});return result;}


