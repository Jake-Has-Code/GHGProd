import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ShopError, submitProdigi } from '../lib/commerce.mjs';
function location(id,env){if(env.DOCKER_RUNTIME!=='true'||!env.ORDER_STORE_DIR)throw new ShopError('Persistent order storage is not configured.',503);if(!/^cs_(test_|live_)?[a-zA-Z0-9_]+$/.test(id))throw new ShopError('Invalid order reference.');return join(env.ORDER_STORE_DIR,id+'.json');}
export async function readOrder(id,env=process.env){const path=location(id,env);try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function saveOrder(order,env=process.env){const path=location(order.sessionId,env);await mkdir(env.ORDER_STORE_DIR,{recursive:true,mode:0o700});const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(order,null,2),{mode:0o600});await rename(temp,path);}
export async function fulfill(session,{env=process.env,fetcher=fetch}={}){
 if(session.payment_status!=='paid')return {ignored:true};
 const order=await readOrder(session.id,env);if(!order)throw new ShopError('Checkout order record not yet available. Retry required.',503);
 if(order.prodigi?.id)return {duplicate:true,prodigi:order.prodigi};
 // Prodigi atomically claims this session's idempotency key, including concurrent requests.
 // Persist only accepted submissions; failed calls return 5xx so Stripe retries.
 const result=await submitProdigi(session,order.printItems,{env,fetcher});
 await saveOrder({...order,state:'submitted',prodigi:result,updatedAt:new Date().toISOString()},env);
 return {prodigi:result};
}
