import {markets} from '../../../lib/trading';
export function GET(){return Response.json({mode:'demo',source:'fixed-synthetic',live:false,asOf:null,markets},{headers:{'Cache-Control':'no-store'}});}
