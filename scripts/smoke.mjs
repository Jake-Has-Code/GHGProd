import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:3002';
const pages=['/','/shop','/shop/ghost-protocol','/shop/root-access','/shop/inner-circle','/blog','/blog/a-homelab-is-a-mindset','/blog/security-is-a-habit','/blog/small-tools-better-days','/about','/shipping','/privacy','/cart','/order'];
for(const path of pages){const response=await fetch(origin+path);assert.equal(response.status,200,path);const body=await response.text();assert.match(body,/Grey Hat Goods/);assert.doesNotMatch(body,/Starter Project/);}
let response=await fetch(origin+'/brand/01.svg');assert.equal(response.status,200);assert.match(await response.text(),/<svg/);
response=await fetch(origin+'/api/health');assert.equal((await response.json()).status,'ok');
response=await fetch(origin+'/api/checkout-status');assert.equal((await response.json()).enabled,false);
response=await fetch(origin+'/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"items":[]}'});assert.equal(response.status,503);
response=await fetch(origin+'/api/order-status?session_id=invalid');assert.equal(response.status,400);
response=await fetch(origin+'/api/webhooks/stripe',{method:'POST',body:'{}'});assert.equal(response.status,503);
response=await fetch(origin+'/shop/missing');assert.equal(response.status,404);
response=await fetch(origin+'/blog/missing');assert.equal(response.status,404);
console.log('PASS: 14 production pages, SVG artwork, health, closed checkout, webhook gate, invalid order references, and missing-page status codes.');
