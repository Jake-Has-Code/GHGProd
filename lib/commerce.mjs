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
 let variants;try{variants=env.PRODIGI_VARIANTS_JSON?JSON.parse(env.PRODIGI_VARIANTS_JSON):defaultVariants;}catch{return {enabled:false,reason:'Invalid product configuration.'};}
 let origin;try{const url=new URL(env.APP_URL);if(url.protocol!=='https:'&&!(['localhost','127.0.0.1'].includes(url.hostname)&&env.STRIPE_SECRET_KEY?.startsWith('sk_test_')))throw 0;origin=url.origin;}catch{return {enabled:false,reason:'Store URL is not configured.'};}
 const test=env.STRIPE_SECRET_KEY?.startsWith('sk_test_')&&env.PRODIGI_API_KEY?.startsWith('sandbox_');
 const live=env.STRIPE_SECRET_KEY?.startsWith('sk_live_')&&env.PRODIGI_API_KEY?.startsWith('live_');
 const mapped=products.every(p=>sizes.every(s=>{const v=variants[p.id]?.[s];return typeof v?.sku==='string'&&v.sku.length>0&&Array.isArray(v.assets)&&v.assets.length>0&&v.assets.every(a=>{try{return Boolean(a.printArea)&&new URL(a.url).protocol==='https:';}catch{return false;}});}));
 const countries=(env.SHIPPING_COUNTRIES||'US').split(',').map(x=>x.trim()).filter(x=>/^[A-Z]{2}$/.test(x));
 const shipping=Number(env.SHIPPING_CENTS);
 const enabled=env.CHECKOUT_ENABLED==='true'&&env.DOCKER_RUNTIME==='true'&&Boolean(env.ORDER_STORE_DIR)&&Boolean(env.STRIPE_WEBHOOK_SECRET)&&Boolean(test||live)&&mapped&&countries.length>0&&Number.isInteger(shipping)&&shipping>=0;
 return {enabled,origin,variants,countries,shipping,test:Boolean(test),reason:enabled?'':'The collection is getting ready. Checkout will open soon.'};
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
export function printItems(items,config){return items.map(i=>{const p=products.find(p=>p.id===i.id);const v=config.variants[i.id][i.size];return {sku:v.sku,quantity:i.quantity,attributes:v.attributes||{},assets:v.assets,sizing:'fitPrintArea',merchantReference:`${i.id}:${i.size}`,recipientCost:{amount:(p.price/100).toFixed(2),currency:'USD'}};});}
export function prodigiPayload(session,items){
 const shipping=session.collected_information?.shipping_details||session.shipping_details;
 if(!shipping?.name||!shipping.address?.line1)throw new ShopError('Paid order is missing shipping details.',422);
 const a=shipping.address;
 return {merchantReference:session.id,submit:true,shippingMethod:'standard',recipient:{name:shipping.name,email:session.customer_details?.email||undefined,address:{line1:a.line1,line2:a.line2||undefined,townOrCity:a.city,stateOrCounty:a.state||undefined,postalOrZipCode:a.postal_code,countryCode:a.country}},items,metadata:{stripeSessionId:session.id,store:'greyhatgoods'}};
}
export async function submitProdigi(session,items,{env=process.env,fetcher=fetch}={}){
 if(session.payment_status!=='paid'||session.metadata?.store!=='greyhatgoods')throw new ShopError('Order is not paid.',422);
 const sandbox=env.PRODIGI_API_KEY?.startsWith('sandbox_');if(Boolean(session.livemode)===sandbox)throw new ShopError('Payment and fulfillment environments do not match.',422);
 const response=await fetcher('https://api.prodigi.com/v5/orders',{method:'POST',headers:{'X-API-Key':env.PRODIGI_API_KEY,'Content-Type':'application/json','Idempotency-Key':'ghg-'+session.id},body:JSON.stringify(prodigiPayload(session,items)),signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok||!result.data?.id)throw new ShopError('Print provider could not accept the order. Retry required.',502);return {id:result.data.id,status:result.data.status};
}
