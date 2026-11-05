import { notFound } from 'next/navigation';
import { getProduct, products } from '../../../lib/catalog';
import { ProductDetail } from '../../../components/Store';
export function generateStaticParams(){return products.map(p=>({slug:p.id}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const p=getProduct((await params).slug);return {title:p?.name||'Product not found',description:p?.description};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const p=getProduct((await params).slug);if(!p)notFound();return <ProductDetail product={p}/>}
