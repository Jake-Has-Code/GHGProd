import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider, Header, Footer } from '../components/Store';
export const metadata: Metadata = {title:{default:'Grey Hat Goods — Gear for the Curious',template:'%s | Grey Hat Goods'},description:'Independent minds. Everyday gear. Original Grey Hat Goods tees and field notes on cybersecurity and technology.',metadataBase:new URL('https://greyhatgoods.com'),icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body id="top"><a className="skip-link" href="#main">Skip to content</a><StoreProvider><Header/><main id="main">{children}</main><Footer/></StoreProvider></body></html>}
