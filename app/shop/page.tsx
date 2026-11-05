import { ProductCard } from '../../components/Store';
import { products } from '../../lib/catalog';
export const metadata={title:'Shop the Gear'};
export default function Shop(){return <section className="section wrap shop-page"><div className="page-intro"><span className="eyebrow blue">01 / THE CORE COLLECTION</span><h1>Gear for<br/>the curious<span className="blue">.</span></h1><p>Original graphics. Everyday rotation. Printed when you order.</p></div><div className="shop-toolbar"><span>ALL TEES <b>03</b></span><span>BLACK / UNISEX / S–3XL</span></div><div className="product-grid">{products.map((p,i)=><ProductCard key={p.id} product={p} index={i}/>)}</div><p className="shop-note">Collection preview · Sample retail prices · Final garment details confirmed before launch.</p></section>}
