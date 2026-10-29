export type FeedQuote={symbol:string;last:number;changePercent:number|null;asOf:string;stale:boolean};
export type FeedSnapshot={provider:'frankfurter-ecb'|'twelvedata';cadence:'daily-reference'|'provider-quotes';fetchedAt:string;quotes:FeedQuote[];intervals:string[];notice:string};
export type FeedBar={time:number;close:number;open?:number;high?:number;low?:number;volume?:number};
export type FeedHistory={provider:FeedSnapshot['provider'];symbol:string;interval:string;kind:'line'|'candlestick';asOf:string;fetchedAt:string;bars:FeedBar[];notice:string};
