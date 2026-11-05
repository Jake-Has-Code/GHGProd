import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCart, configuration, stripeForm, verifyStripe, checkoutKey, printItems, printifyPayload, createPrintifyOrder, stripe } from '../lib/commerce.mjs';
import { products, sizes } from '../lib/catalog.mjs';
import { saveOrder, readOrder, fulfill, linkPrintifyOrder } from '../server/orders.mjs';

const items=[{id:'ghost-protocol',size:'L',quantity:2}];
const variants=Object.fromEntries(products.map((product,p)=>[product.id,Object.fromEntries(sizes.map((size,s)=>[size,{product_id:`product-${p}`,variant_id:100+p*10+s}]))]));
const env={APP_URL:'https://greyhatgoods.com',CHECKOUT_ENABLED:'true',DOCKER_RUNTIME:'true',ORDER_STORE_DIR:'/tmp/unused',STRIPE_SECRET_KEY:'sk_live_example',STRIPE_WEBHOOK_SECRET:'whsec_example',PRINTIFY_API_TOKEN:'example-token',PRINTIFY_SHOP_ID:'12345',SHIPPING_CENTS:'599',SHIPPING_COUNTRIES:'US',PRINTIFY_VARIANTS_JSON:JSON.stringify(variants)};
const session={id:'cs_live_123456789012345',livemode:true,payment_status:'paid',metadata:{store:'greyhatgoods'},customer_details:{email:'buyer@example.com',phone:'+15555550123'},collected_information:{shipping_details:{name:'Test Buyer Smith',address:{line1:'1 Test St',line2:'Apt 2',city:'Example',state:'NY',postal_code:'10001',country:'US'}}}};
const print=()=>printItems(items,configuration(env));
const snapshot=()=>({sessionId:session.id,provider:'printify',printifyShopId:'12345',state:'checkout_created',printItems:print()});
async function withOrder(fn){
 const dir=await mkdtemp(join(tmpdir(),'ghg-printify-'));
 const local={...env,ORDER_STORE_DIR:dir};
 try {await saveOrder(snapshot(),local);await fn(local);}
 finally {await rm(dir,{recursive:true,force:true});}
}

test('cart rejects invalid sizes, unknown products, duplicates, and abusive quantities',()=>{
 for(const invalid of [[],[{...items[0],size:'XXS'}],[{...items[0],id:'unknown'}],[{...items[0],quantity:-1}],[{...items[0],quantity:1.5}],[...items,...items]])assert.throws(()=>validateCart(invalid));
 assert.deepEqual(validateCart(items),items);
});
test('checkout requires Printify credentials, shop, complete product/variant mapping and explicit enablement',()=>{
 assert.equal(configuration(env).enabled,true);
 assert.equal(configuration({...env,STRIPE_SECRET_KEY:'sk_test_example',APP_URL:'http://localhost:3000'}).enabled,true);
 for(const patch of [{CHECKOUT_ENABLED:'false'},{DOCKER_RUNTIME:'false'},{PRINTIFY_API_TOKEN:''},{PRINTIFY_SHOP_ID:'../other'},{STRIPE_WEBHOOK_SECRET:''},{PRINTIFY_VARIANTS_JSON:'{}'},{PRINTIFY_VARIANTS_JSON:'null'},{PRINTIFY_VARIANTS_JSON:'bad json'},{SHIPPING_CENTS:'NaN'}])assert.equal(configuration({...env,...patch}).enabled,false);
 const invalid=structuredClone(variants);invalid['ghost-protocol'].L.variant_id='102';
 assert.equal(configuration({...env,PRINTIFY_VARIANTS_JSON:JSON.stringify(invalid)}).enabled,false);
});
test('prices and selected sizes come from the server catalog',()=>{
 const form=stripeForm(validateCart([{...items[0],price:1}]),configuration(env));
 assert.equal(form.get('line_items[0][price_data][unit_amount]'),'3200');
 assert.equal(form.get('line_items[0][quantity]'),'2');
 assert.match(form.get('line_items[0][price_data][product_data][name]'),/Black \/ L/);
 assert.equal(form.get('automatic_tax[enabled]'),'true');
});
test('checkout retry keys change when the cart changes',()=>{
 assert.equal(checkoutKey('some-test-key-1234',items),checkoutKey('some-test-key-1234',items));
 assert.notEqual(checkoutKey('some-test-key-1234',items),checkoutKey('some-test-key-1234',[{...items[0],size:'M'}]));
 assert.throws(()=>checkoutKey('bad',items));
});
test('webhook signatures reject tampering, missing signatures and expired timestamps',()=>{
 const body=JSON.stringify({id:'evt_test'}),t=Math.floor(Date.now()/1000);
 const sig=createHmac('sha256','secret').update(`${t}.${body}`).digest('hex');
 assert.equal(verifyStripe(body,`t=${t},v1=${sig}`,'secret').id,'evt_test');
 assert.throws(()=>verifyStripe(body+' ',`t=${t},v1=${sig}`,'secret'));
 assert.throws(()=>verifyStripe(body,null,'secret'));
 assert.throws(()=>verifyStripe(body,`t=${t},v1=${sig}`,'secret',t+301));
});
test('Printify receives the mapped product, size variant, quantity, address and required headers',async()=>{
 const payload=printifyPayload(session,print());
 assert.equal(payload.line_items[0].product_id,'product-0');
 assert.equal(payload.line_items[0].variant_id,102);
 assert.equal(payload.line_items[0].quantity,2);
 assert.equal(payload.external_id,session.id);
 assert.equal(payload.label,session.id);
 assert.equal(payload.address_to.first_name,'Test');
 assert.equal(payload.address_to.last_name,'Buyer Smith');
 assert.equal(payload.address_to.address2,'Apt 2');
 assert.equal(payload.address_to.country,'US');
 assert.equal(payload.shipping_method,1);
 assert.equal(payload.send_shipping_notification,false);
 let call;
 const result=await createPrintifyOrder(session,print(),{env,fetcher:async(url,options)=>{
  call={url,options};return Response.json({id:'print-order-1',status:'on-hold'});
 }});
 assert.equal(result.id,'print-order-1');
 assert.equal(call.url,'https://api.printify.com/v1/shops/12345/orders.json');
 assert.equal(call.options.headers.Authorization,'Bearer example-token');
 assert.equal(call.options.headers['User-Agent'],'GreyHatGoods/1.0');
 assert.equal(call.options.headers['Idempotency-Key'],undefined);
});
test('unpaid, foreign, test or mismatched sessions cannot create a Printify order',async()=>{
 let calls=0;const options={env,fetcher:async()=>{calls++;throw Error('must not call');}};
 for(const change of [{payment_status:'unpaid'},{metadata:{store:'other'}},{livemode:false}])await assert.rejects(createPrintifyOrder({...session,...change},print(),options));
 await assert.rejects(createPrintifyOrder(session,print(),{...options,env:{...env,STRIPE_SECRET_KEY:'sk_test_example'}}));
 assert.equal(calls,0);
});
test('Stripe API credentials, API version and retry key remain server-side',async()=>{
 let call;await stripe('checkout/sessions',{env,method:'POST',body:new URLSearchParams({mode:'payment'}),key:'key',fetcher:async(url,options)=>{call={url,options};return Response.json({id:session.id});}});
 assert.equal(call.options.headers['Stripe-Version'],'2026-10-28.endive');
 assert.equal(call.options.headers['Idempotency-Key'],'key');
 assert.equal(call.options.headers.Authorization,'Bearer sk_live_example');
});
test('accepted Printify orders persist and duplicate webhook deliveries never create another',async()=>withOrder(async local=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({id:'print-order-1',status:'on-hold'});};
 await fulfill(session,{env:local,fetcher});
 assert.equal((await readOrder(session.id,local)).printify.id,'print-order-1');
 assert.equal((await fulfill(session,{env:local,fetcher})).duplicate,true);
 assert.equal(calls,1);
}));
test('concurrent paid webhook events create just one Printify order',async()=>withOrder(async local=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({id:'print-order-1',status:'pending'});};
 await Promise.all([fulfill(session,{env:local,fetcher}),fulfill(session,{env:local,fetcher}),fulfill(session,{env:local,fetcher})]);
 assert.equal(calls,1);
}));
test('Stripe test payments are stored locally without any Printify requests',async()=>withOrder(async local=>{
 const result=await fulfill({...session,livemode:false},{env:{...local,STRIPE_SECRET_KEY:'sk_test_example'},fetcher:async()=>{throw Error('must not call');}});
 assert.deepEqual(result,{testMode:true,production:false});
 assert.equal((await readOrder(session.id,local)).state,'test_paid');
}));
test('explicit rejection can retry after correction',async()=>withOrder(async local=>{
 await assert.rejects(fulfill(session,{env:local,fetcher:async()=>Response.json({}, {status:422})}));
 assert.equal((await readOrder(session.id,local)).state,'submission_rejected');
 await fulfill(session,{env:local,fetcher:async()=>Response.json({id:'print-order-1',status:'pending'})});
 assert.equal((await readOrder(session.id,local)).printify.id,'print-order-1');
}));
test('uncertain provider responses remain blocked across later webhook attempts',async()=>withOrder(async local=>{
 let calls=0;const fetcher=async()=>{calls++;throw new Error('Connection reset after order acceptance');};
 await assert.rejects(fulfill(session,{env:local,fetcher}));
 assert.equal((await readOrder(session.id,local)).state,'submission_unknown');
 await assert.rejects(fulfill(session,{env:local,fetcher}),/Reconcile/);
 assert.equal(calls,1);
}));
test('ambiguous success and provider 5xx responses never lead to another create request',async()=>{
 for(const response of [()=>Response.json({id:'created-but-invalid'},{status:503}),()=>Response.json({status:'pending'}),()=>new Response('not-json')])await withOrder(async local=>{
  let calls=0;const fetcher=async()=>{calls++;return response();};
  await assert.rejects(fulfill(session,{env:local,fetcher}));
  await assert.rejects(fulfill(session,{env:local,fetcher}));
  assert.equal(calls,1);
 });
});
test('missing credentials do not claim creation; a fixed configuration can retry',async()=>withOrder(async local=>{
 await assert.rejects(fulfill(session,{env:{...local,PRINTIFY_API_TOKEN:''},fetcher:async()=>{throw Error('must not call');}}),/configured/);
 await fulfill(session,{env:local,fetcher:async()=>Response.json({id:'print-order-1',status:'pending'})});
}));
test('legacy snapshots cannot be sent using unrelated new provider mappings',async()=>withOrder(async local=>{
 await saveOrder({sessionId:session.id,state:'checkout_created',printItems:[]},local);
 await assert.rejects(fulfill(session,{env:local,fetcher:async()=>{throw Error('must not call');}}),/older fulfillment mapping/);
}));
test('lost responses can be linked only to a matching Printify reference and exact variants',async()=>withOrder(async local=>{
 const remote={id:'print-order-1',status:'on-hold',metadata:{shop_order_label:session.id},line_items:print()};
 await assert.rejects(linkPrintifyOrder(session.id,'print-order-1',{env:local,fetcher:async()=>Response.json({...remote,metadata:{shop_order_label:'different'}})}),/does not match/);
 await assert.rejects(linkPrintifyOrder(session.id,'print-order-1',{env:local,fetcher:async()=>Response.json({...remote,line_items:[{...print()[0],variant_id:999}]})}),/does not match/);
 await linkPrintifyOrder(session.id,'print-order-1',{env:local,fetcher:async()=>Response.json(remote)});
 assert.equal((await readOrder(session.id,local)).printify.id,'print-order-1');
 assert.equal((await fulfill(session,{env:local,fetcher:async()=>{throw Error('must not call');}})).duplicate,true);
}));
