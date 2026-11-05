export { products, sizes, money, getProduct } from './catalog.mjs';
import { products } from './catalog.mjs';
export type Product = typeof products[number];
export type CartItem = { id: string; size: string; quantity: number };
