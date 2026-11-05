import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ShopError, PrintifyError, assertPaidSession, printifyPayload, createPrintifyOrder, printify, printifyShopPath } from '../lib/commerce.mjs';

function location(id,env){
 if(env.DOCKER_RUNTIME!=='true'||!env.ORDER_STORE_DIR)throw new ShopError('Persistent order storage is not configured.',503);
 if(!/^cs_(test_|live_)?[a-zA-Z0-9_]+$/.test(id))throw new ShopError('Invalid order reference.');
 return join(env.ORDER_STORE_DIR,id+'.json');
}
export async function readOrder(id,env=process.env){
 try { return JSON.parse(await readFile(location(id,env),'utf8')); }
 catch(error){if(error.code==='ENOENT')return null;throw error;}
}
export async function saveOrder(order,env=process.env){
 const path=location(order.sessionId,env);
 await mkdir(env.ORDER_STORE_DIR,{recursive:true,mode:0o700});
 const temp=path+'.'+randomUUID()+'.tmp';
 await writeFile(temp,JSON.stringify(order,null,2),{mode:0o600});
 await rename(temp,path);
}
// One attempt file survives process restarts. Printify does not document a
// creation idempotency header; a lost response must never trigger a second POST.
async function claimCreation(id,env){
 try { await writeFile(location(id,env)+'.printify-attempt',new Date().toISOString(),{flag:'wx',mode:0o600});return true; }
 catch(error){if(error.code==='EEXIST')return false;throw error;}
}
const inFlight=new Map();
export async function fulfill(session,{env=process.env,fetcher=fetch}={}){
 const key=env.ORDER_STORE_DIR+':'+session.id;
 if(inFlight.has(key))return inFlight.get(key);
 const pending=fulfillOnce(session,{env,fetcher});
 inFlight.set(key,pending);
 try { return await pending; }
 finally { inFlight.delete(key); }
}
async function fulfillOnce(session,{env,fetcher}){
 if(session.payment_status!=='paid')return {ignored:true};
 assertPaidSession(session,env);
 const order=await readOrder(session.id,env);
 if(!order)throw new ShopError('Checkout order record not yet available. Retry required.',503);
 if(order.provider!=='printify'||!order.printifyShopId)throw new ShopError('Order uses an older fulfillment mapping; review before retry.',422);
 if(!session.livemode){
  if(order.state!=='test_paid')await saveOrder({...order,state:'test_paid',testMode:true,updatedAt:new Date().toISOString()},env);
  return {testMode:true,production:false};
 }
 if(order.printify?.id)return {duplicate:true,printify:order.printify};
 // Validate before claiming: configuration or address errors remain retryable.
 printifyShopPath(order.printifyShopId);
 if(!env.PRINTIFY_API_TOKEN?.trim())throw new ShopError('Printify is not configured.',503);
 printifyPayload(session,order.printItems);
 if(!await claimCreation(session.id,env))throw new ShopError('Printify creation was already attempted. Reconcile the order reference before retrying.',503);
 try {
  const result=await createPrintifyOrder(session,order.printItems,{env,shopId:order.printifyShopId,fetcher});
  await saveOrder({...order,state:'submitted',printify:result,updatedAt:new Date().toISOString()},env);
  return {printify:result};
 } catch(error){
  const rejected=error instanceof PrintifyError&&error.definitelyRejected;
  await saveOrder({...order,state:rejected?'submission_rejected':'submission_unknown',updatedAt:new Date().toISOString()},env);
  if(rejected)await unlink(location(session.id,env)+'.printify-attempt');
  throw error;
 }
}
// Recover a lost response by linking an existing order, never creating another.
export async function linkPrintifyOrder(sessionId,providerId,{env=process.env,fetcher=fetch}={}){
 const order=await readOrder(sessionId,env);
 if(!order||order.provider!=='printify'||order.testMode)throw new ShopError('No live Printify checkout record found.');
 if(order.printify?.id){if(order.printify.id!==providerId)throw new ShopError('A different Printify order is already linked.');return order.printify;}
 if(!/^[a-zA-Z0-9_-]+$/.test(providerId))throw new ShopError('Invalid Printify order reference.');
 const result=await printify(printifyShopPath(order.printifyShopId)+'/orders/'+providerId+'.json',{env,fetcher});
 const references=[result.external_id,result.label,result.metadata?.shop_order_id,result.metadata?.shop_order_label];
 const actual=result.line_items||[];
 const matches=order.printItems.length===actual.length&&order.printItems.every(expected=>actual.some(item=>item.product_id===expected.product_id&&item.variant_id===expected.variant_id&&item.quantity===expected.quantity));
 if(!references.includes(sessionId)||!matches||result.id!==providerId)throw new ShopError('Printify order does not match this checkout.');
 const linked={id:result.id,shopId:order.printifyShopId,status:result.status||'pending'};
 await saveOrder({...order,state:'submitted',printify:linked,updatedAt:new Date().toISOString()},env);
 return linked;
}
