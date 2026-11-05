import { configuration, validateCart, stripeForm, stripe, checkoutKey, printItems, ShopError } from '../../../lib/commerce.mjs';
import { readOrder, saveOrder } from '../../../server/orders.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 const config=configuration();if(!config.enabled)return Response.json({error:'The collection is getting ready. Checkout will open soon.'},{status:503});
 if(request.headers.get('origin')!==config.origin)return Response.json({error:'Invalid request origin.'},{status:403});
 if(Number(request.headers.get('content-length')||0)>16000)return Response.json({error:'Request too large.'},{status:413});
 const text=await request.text();if(text.length>16000)return Response.json({error:'Request too large.'},{status:413});
 const {items:raw}=JSON.parse(text);const items=validateCart(raw);const key=checkoutKey(request.headers.get('idempotency-key'),items);
 const session=await stripe('checkout/sessions',{method:'POST',body:stripeForm(items,config),key});
 if(!session.url||!session.id)throw new ShopError('Unable to open checkout.',502);
 const existing=await readOrder(session.id);if(!existing)await saveOrder({sessionId:session.id,state:'checkout_created',items,printItems:printItems(items,config),createdAt:new Date().toISOString()});
 return Response.json({url:session.url},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof ShopError?e.message:'Checkout could not be opened. Please try again.'},{status:e instanceof ShopError?e.status:400});}}
