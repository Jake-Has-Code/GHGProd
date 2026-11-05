import { verifyStripe, stripe, ShopError } from '../../../../lib/commerce.mjs';
import { fulfill } from '../../../../server/orders.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(process.env.DOCKER_RUNTIME!=='true'||!process.env.STRIPE_WEBHOOK_SECRET)return Response.json({error:'Webhook not configured.'},{status:503});
 let event;try{const body=await request.text();if(body.length>1000000)return Response.json({error:'Request too large.'},{status:413});event=verifyStripe(body,request.headers.get('stripe-signature'),process.env.STRIPE_WEBHOOK_SECRET);}catch{return Response.json({error:'Invalid webhook signature.'},{status:400});}
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return Response.json({received:true});
 try{const session=await stripe('checkout/sessions/'+encodeURIComponent(event.data.object.id));if(session.metadata?.store!=='greyhatgoods')return Response.json({received:true});const result=await fulfill(session);return Response.json({received:true,...result});}
 catch(e){console.error('Order fulfillment requires retry:',event.id,e instanceof ShopError?e.message:'Internal error');return Response.json({error:'Fulfillment requires retry.'},{status:500});}
}
