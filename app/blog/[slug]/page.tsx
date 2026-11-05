import Link from 'next/link';
import { notFound } from 'next/navigation';
import { articles } from '../../../lib/articles';
export const dynamicParams = false;
export function generateStaticParams(){return articles.map(a=>({slug:a.slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const a=articles.find(a=>a.slug===slug);return {title:a?.title,description:a?.excerpt};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const a=articles.find(a=>a.slug===slug);if(!a)notFound();return <article className="article wrap"><Link className="link-arrow" href="/blog">← ALL FIELD NOTES</Link><header><span className="eyebrow blue">{a.category} / {a.readTime} MIN READ</span><h1>{a.title}</h1><p>{a.excerpt}</p><span className="eyebrow">GREY HAT GOODS / FIELD NOTES</span></header><div className="article-body">{a.sections.map(([title,body])=><section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div><div className="article-end"><span>KEEP ASKING GOOD QUESTIONS.</span><Link href="/blog">More field notes ↗</Link></div></article>}
