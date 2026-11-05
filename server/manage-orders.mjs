// Run with: node --env-file=.env server/manage-orders.mjs [list|status|retry] [session_id]
import { readdir } from 'node:fs/promises';
import { readOrder, fulfill } from './orders.mjs';
import { stripe } from '../lib/commerce.mjs';
const [action='list',id]=process.argv.slice(2);
if(action==='list'){
 const files=await readdir(process.env.ORDER_STORE_DIR);
 for(const file of files.filter(f=>/^cs_.*\.json$/.test(f))){const order=await readOrder(file.slice(0,-5));console.log(JSON.stringify({sessionId:order.sessionId,state:order.state,prodigi:order.prodigi||null,createdAt:order.createdAt}));}
}else if(action==='status'&&id){const order=await readOrder(id);if(!order?.prodigi?.id)throw Error('No Prodigi order found.');const response=await fetch('https://api.prodigi.com/v5/orders/'+encodeURIComponent(order.prodigi.id),{headers:{'X-API-Key':process.env.PRODIGI_API_KEY},signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error('Provider lookup failed.');console.log(JSON.stringify({id:result.data.id,status:result.data.status,issues:result.data.issues},null,2));
}else if(action==='retry'&&id){const session=await stripe('checkout/sessions/'+encodeURIComponent(id));console.log(JSON.stringify(await fulfill(session)));}
else throw Error('Usage: manage-orders.mjs list | status <session_id> | retry <session_id>');
