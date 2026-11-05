import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { products, sizes } from './catalog.mjs';
import defaultVariants from '../config/variants.json' with { type: 'json' };
export class ShopError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export function validateCart(input){
 if(!Array.isArray(input)||input.length<1||input.length>18)throw new ShopError('Your bag must contain between 1 and 18 selections.');
 const seen=new Set();let count=0;
 return input.map(i=>{const product=products.find(p=>p.id===i?.id);if(!product||!sizes.includes(i.size)||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>10)throw new ShopError('Check the product, size, and quantity in your bag.');
 const key=i.id+':'+i.size;if(seen.has(key))throw new ShopError('Duplicate bag selections.');seen.add(key);count+=i.quantity;if(count>30)throw new ShopError('Please limit your order to 30 tees.');return {id:i.id,size:i.size,quantity:i.quantity};});
}
export function configuration(env=process.env){
 let variants;
 try { variants=env.PRINTIFY_VARIANTS_JSON?JSON.parse(env.PRINTIFY_VARIANTS_JSON):defaultVariants; }
 catch { return {enabled:false,reason:'Invalid product configuration.'}; }
 let origin;
 try {
  const url=new URL(env.APP_URL);
  if(url.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(url.hostname)&&env.STRIPE_SECRET_KEY?.startsWith('sk_test_')))throw 0;
  origin=url.origin;
 } catch { return {enabled:false,reason:'Store URL is not configured.'}; }
 const test=Boolean(env.STRIPE_SECRET_KEY?.startsWith('sk_test_'));
 const live=Boolean(env.STRIPE_SECRET_KEY?.startsWith('sk_live_'));
 const mapped=products.every(p=>sizes.every(size=>{
  const variant=variants?.[p.id]?.[size];
  return typeof variant?.product_id==='string'&&/^[a-zA-Z0-9_-]+$/.test(variant.product_id)&&Number.isSafeInteger(variant.variant_id)&&variant.variant_id>0;
 }));
 const countries=(env.SHIPPING_COUNTRIES||'US').split(',').map(x=>x.trim()).filter(x=>/^[A-Z]{2}$/.test(x));
 const shipping=Number(env.SHIPPING_CENTS);
 const shopId=env.PRINTIFY_SHOP_ID||'';
 const providerReady=Boolean(env.PRINTIFY_API_TOKEN?.trim())&&/^[1-9][0-9]*$/.test(shopId);
 const enabled=env.CHECKOUT_ENABLED==='true'&&env.DOCKER_RUNTIME==='true'&&Boolean(env.ORDER_STORE_DIR)&&Boolean(env.STRIPE_WEBHOOK_SECRET)&&(test||live)&&providerReady&&mapped&&countries.length>0&&Number.isInteger(shipping)&&shipping>=0;
 return {enabled,origin,variants,countries,shipping,shopId,test,reason:enabled?'':'The collection is getting ready. Checkout will open soon.'};
}
export function stripeForm(items,config){
 const form=new URLSearchParams({mode:'payment',success_url:config.origin+'/order?session_id={CHECKOUT_SESSION_ID}',cancel_url:config.origin+'/cart','payment_method_types[0]':'card','billing_address_collection':'required','customer_creation':'always','metadata[store]':'greyhatgoods','automatic_tax[enabled]':'true'});
 config.countries.forEach((c,i)=>form.set(`shipping_address_collection[allowed_countries][${i}]`,c));
 form.set('shipping_options[0][shipping_rate_data][type]','fixed_amount');form.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]',String(config.shipping));form.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]','usd');form.set('shipping_options[0][shipping_rate_data][display_name]','Standard shipping');
 items.forEach((i,n)=>{const p=products.find(p=>p.id===i.id);form.set(`line_items[${n}][price_data][currency]`,'usd');form.set(`line_items[${n}][price_data][unit_amount]`,String(p.price));form.set(`line_items[${n}][price_data][tax_behavior]`,'exclusive');form.set(`line_items[${n}][price_data][product_data][tax_code]`,'txcd_30011000');form.set(`line_items[${n}][price_data][product_data][name]`,`${p.name} / Black / ${i.size}`);form.set(`line_items[${n}][price_data][product_data][metadata][product_id]`,p.id);form.set(`line_items[${n}][price_data][product_data][metadata][size]`,i.size);form.set(`line_items[${n}][quantity]`,String(i.quantity));});
 return form;
}
/** @param {string} path @param {{env?:Record<string,string|undefined>,method?:string,body?:URLSearchParams,key?:string,fetcher?:typeof fetch}} [options] */
export async function stripe(path,{env=process.env,method='GET',body,key,fetcher=fetch}={}){
 const response=await fetcher('https://api.stripe.com/v1/'+path,{method,headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY,'Stripe-Version':'2026-10-28.endive',...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(key?{'Idempotency-Key':key}:{})},body,signal:AbortSignal.timeout(15000)});
 const data=await response.json();if(!response.ok)throw new ShopError('Payment service is temporarily unavailable. Please try again.',502);return data;
}
export function checkoutKey(clientKey,items){if(typeof clientKey!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(clientKey))throw new ShopError('Please refresh your bag and try again.');return 'ghg-'+createHash('sha256').update(clientKey+JSON.stringify(items)).digest('hex');}
export function verifyStripe(body,signature,secret,now=Math.floor(Date.now()/1000)){
 if(!secret||typeof signature!=='string')throw new ShopError('Invalid webhook signature.',400);
 const parts=signature.split(',');const timestamp=Number(parts.find(p=>p.startsWith('t='))?.slice(2));const candidates=parts.filter(p=>p.startsWith('v1=')).map(p=>p.slice(3));
 if(!Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>300)throw new ShopError('Expired webhook signature.',400);
 const expected=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest();
 const valid=candidates.some(v=>{if(!/^[a-f0-9]{64}$/i.test(v))return false;const actual=Buffer.from(v,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);});
 if(!valid)throw new ShopError('Invalid webhook signature.',400);return JSON.parse(body);
}
export function printItems(items,config){
 return items.map(item=>{
  const variant=config.variants[item.id][item.size];
  return {product_id:variant.product_id,variant_id:variant.variant_id,quantity:item.quantity,external_id:`${item.id}:${item.size}`};
 });
}
export function assertPaidSession(session,env=process.env){
 if(session.payment_status!=='paid'||session.metadata?.store!=='greyhatgoods')throw new ShopError('Order is not paid.',422);
 const test=env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
 const live=env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
 if(typeof session.livemode!=='boolean'||(session.livemode?!live:!test))throw new ShopError('Payment environment does not match the store.',422);
}
export function printifyPayload(session,items){
 const shipping=session.collected_information?.shipping_details||session.shipping_details;
 const address=shipping?.address;
 const name=shipping?.name?.trim();
 const email=session.customer_details?.email;
 if(!name||!address?.line1||!address.city||!address.postal_code||!address.country||!email)throw new ShopError('Paid order is missing shipping details.',422);
 if(!Array.isArray(items)||!items.length||items.some(item=>!item.product_id||!Number.isSafeInteger(item.variant_id)||item.variant_id<1||!Number.isSafeInteger(item.quantity)||item.quantity<1))throw new ShopError('Order has no valid Printify mapping.',422);
 const [firstName,...lastName]=name.split(/\s+/);
 return {
  external_id:session.id,label:session.id,
  line_items:items.map(item=>({product_id:item.product_id,variant_id:item.variant_id,quantity:item.quantity,external_id:item.external_id})),
  shipping_method:1,is_printify_express:false,is_economy_shipping:false,send_shipping_notification:false,
  address_to:{first_name:firstName,last_name:lastName.join(' '),email,phone:session.customer_details?.phone||'',country:address.country,region:address.state||'',address1:address.line1,address2:address.line2||'',city:address.city,zip:address.postal_code},
 };
}
export class PrintifyError extends ShopError {
 constructor(message,providerStatus=0){super(message,502);this.providerStatus=providerStatus;}
 get definitelyRejected(){return [400,401,403,404,422,429].includes(this.providerStatus);}
}
/** @param {string} path @param {{env?:Record<string,string|undefined>,method?:string,body?:object,fetcher?:typeof fetch}} [options] */
export async function printify(path,{env=process.env,method='GET',body,fetcher=fetch}={}){
 if(!env.PRINTIFY_API_TOKEN?.trim())throw new ShopError('Printify is not configured.',503);
 let response;
 try {
  response=await fetcher('https://api.printify.com/v1/'+path,{method,headers:{Authorization:'Bearer '+env.PRINTIFY_API_TOKEN,'User-Agent':'GreyHatGoods/1.0',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 } catch { throw new PrintifyError('Printify response is uncertain; reconcile the order before resubmitting.'); }
 if(!response.ok)throw new PrintifyError('Printify could not accept the request.',response.status);
 try { return await response.json(); }
 catch { throw new PrintifyError('Printify returned an unreadable response; reconcile the order before resubmitting.'); }
}
export function printifyShopPath(shopId){
 if(typeof shopId!=='string'||!/^[1-9][0-9]*$/.test(shopId))throw new ShopError('Printify shop is not configured.',503);
 return 'shops/'+shopId;
}
export async function createPrintifyOrder(session,items,{env=process.env,shopId=env.PRINTIFY_SHOP_ID,fetcher=fetch}={}){
 assertPaidSession(session,env);
 if(!session.livemode)throw new ShopError('Test payments are recorded locally and never sent to Printify.',422);
 const result=await printify(printifyShopPath(shopId)+'/orders.json',{env,method:'POST',body:printifyPayload(session,items),fetcher});
 if(typeof result.id!=='string'||!result.id)throw new PrintifyError('Printify order reference is missing; reconcile before resubmitting.');
 return {id:result.id,shopId,status:result.status||'pending'};
}
