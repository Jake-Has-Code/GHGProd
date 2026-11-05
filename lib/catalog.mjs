export var sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
export var products = [
    { id: 'ghost-protocol', name: 'Ghost Protocol Tee', art: '01', price: 3200, tag: 'THE ORIGINAL', description: 'A little mystery. A lot of curiosity. Our signature Grey Hat graphic takes center stage on a classic black tee. For the people who always need to know how it works.', detail: 'Full front graphic · Black · Unisex', print: 'signature' },
    { id: 'root-access', name: 'Root Access Tee', art: '03', price: 2800, tag: 'LESS NOISE. MORE SIGNAL.', description: 'The Grey Hat monogram, stripped back to the essentials. A clean statement for late nights in the lab, early coffee runs, and everything in between.', detail: 'Front monogram · Black · Unisex', print: 'monogram' },
    { id: 'inner-circle', name: 'Inner Circle Tee', art: '02', price: 3000, tag: 'FIND YOUR PEOPLE', description: 'Gear. Blog. Community. The circle that brings it all together. Our badge graphic is a nod to the curious minds building a better digital world.', detail: 'Front badge graphic · Black · Unisex', print: 'badge' },
];
export var money = function (cents) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100); };
export function getProduct(id) { return products.find(function (p) { return p.id === id; }); }
