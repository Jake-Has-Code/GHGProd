// Run with node --env-file=.env server/manage-orders.mjs <action> [session_id] [printify_order_id]
import { readdir } from 'node:fs/promises';
import { readOrder, fulfill, linkPrintifyOrder } from './orders.mjs';
import { stripe, printify, printifyShopPath } from '../lib/commerce.mjs';
const [action='list',id,providerId]=process.argv.slice(2);
if(action==='list'){
 const files=await readdir(process.env.ORDER_STORE_DIR);
 for(const file of files.filter(f=>/^cs_.*\.json$/.test(f))){
  const order=await readOrder(file.slice(0,-5));
  console.log(JSON.stringify({sessionId:order.sessionId,state:order.state,printify:order.printify||null,createdAt:order.createdAt}));
 }
}else if(action==='status'&&id){
 const order=await readOrder(id);
 if(!order?.printify?.id)throw Error('No Printify order found.');
 const result=await printify(printifyShopPath(order.printify.shopId)+'/orders/'+encodeURIComponent(order.printify.id)+'.json');
 console.log(JSON.stringify({id:result.id,status:result.status,shipments:result.shipments},null,2));
}else if(action==='retry'&&id){
 const session=await stripe('checkout/sessions/'+encodeURIComponent(id));
 console.log(JSON.stringify(await fulfill(session)));
}else if(action==='link'&&id&&providerId){
 console.log(JSON.stringify(await linkPrintifyOrder(id,providerId)));
}else throw Error('Usage: manage-orders.mjs list | status <session_id> | retry <session_id> | link <session_id> <printify_order_id>');
