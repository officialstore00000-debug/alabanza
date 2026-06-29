'use client';

import { useState, useEffect, useRef } from 'react';

const STORE = 'thealabanza.myshopify.com';
const TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_TOKEN!;
const WA = process.env.NEXT_PUBLIC_WHATSAPP!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  priceRange: { minVariantPrice: { amount: string } };
  compareAtPriceRange: { minVariantPrice: { amount: string } };
  images: { edges: { node: { url: string } }[] };
  variants: { edges: { node: { id: string } }[] };
  productType: string;
  tags: string[];
}

interface CartItem {
  title: string;
  price: string;
  image: string;
  handle: string;
  variantId: string;
  qty: number;
}

const MALE_HANDLES = ['tissot-prx','custom-name-watch','a-luxury-arabic-dial-metal-watch-date-working-premium-look','rolex-first-copy-semi-auto-quartz-watch'];

function getCat(p: Product) {
  const t = (p.title+' '+p.productType+' '+p.tags.join(' ')).toLowerCase();
  if(t.includes('bracelet')) return 'bracelet';
  if(t.includes('necklace')||t.includes('pendant')) return 'necklace';
  if(t.includes('earring')) return 'earring';
  if(t.includes('bangle')||t.includes('kundan')) return 'bangle';
  if(t.includes('watch')) return 'watch';
  if(t.includes('bag')||t.includes('tote')) return 'bag';
  return 'other';
}

function fmt(amount: string) {
  return 'Rs. ' + Math.round(parseFloat(amount)).toLocaleString();
}

function isMale(p: Product) {
  return MALE_HANDLES.includes(p.handle);
}

async function fetchProducts(): Promise<Product[]> {
  const query = `{ products(first:40) { edges { node { id title handle description priceRange { minVariantPrice { amount } } compareAtPriceRange { minVariantPrice { amount } } images(first:4) { edges { node { url } } } productType tags variants(first:1) { edges { node { id } } } } } } }`;
  try {
    const r = await fetch(`https://${STORE}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
      body: JSON.stringify({ query })
    });
    const d = await r.json();
    return d.data.products.edges.map((e: any) => e.node).filter((p: Product) => !isMale(p));
  } catch { return []; }
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [codOpen, setCodOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState<'home'|'collection'|'product'>('home');
  const [collTitle, setCollTitle] = useState('');
  const [collFilter, setCollFilter] = useState('all');
  const [currentProduct, setCurrentProduct] = useState<Product|null>(null);
  const [mainImg, setMainImg] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', address:'', city:'', email:'', notes:'' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts().then(setProducts);
  }, []);

  useEffect(() => {
    document.querySelectorAll('.reveal').forEach(el => {
      const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); });
      }, { threshold: 0.07 });
      obs.observe(el);
    });
  }, [products, page]);

  const filtered = filter === 'all' ? products : products.filter(p => getCat(p) === filter);
  const collProducts = collFilter === 'all' ? products.filter(p => {
    if(collTitle === 'Bracelets') return getCat(p) === 'bracelet';
    if(collTitle === 'Necklaces') return getCat(p) === 'necklace';
    if(collTitle === 'Earrings') return getCat(p) === 'earring';
    if(collTitle === 'Bangles') return getCat(p) === 'bangle';
    if(collTitle === 'Watches') return getCat(p) === 'watch';
    if(collTitle === 'Bags') return getCat(p) === 'bag';
    return true;
  }) : products.filter(p => parseFloat(p.compareAtPriceRange.minVariantPrice.amount) > 0);

  const necklaces = products.filter(p => getCat(p) === 'necklace').slice(0, 4);
  const cartTotal = cart.reduce((s, i) => s + parseFloat(i.price) * i.qty, 0);
  const delivery = cartTotal >= 2000 ? 0 : 200;
  const grand = cartTotal + delivery;
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(p: Product) {
    const img = p.images.edges[0]?.node.url || '';
    const variantId = p.variants.edges[0]?.node.id || '';
    setCart(prev => {
      const ex = prev.find(i => i.handle === p.handle);
      if(ex) return prev.map(i => i.handle === p.handle ? {...i, qty: i.qty+1} : i);
      return [...prev, { title: p.title, price: p.priceRange.minVariantPrice.amount, image: img, handle: p.handle, variantId, qty: 1 }];
    });
    if(typeof window !== 'undefined') {
      (window as any).fbq?.('track', 'AddToCart', { content_name: p.title, content_ids: [p.handle], value: parseFloat(p.priceRange.minVariantPrice.amount), currency: 'PKR' });
      (window as any).ttq?.track('AddToCart', { content_id: p.handle, content_name: p.title, value: parseFloat(p.priceRange.minVariantPrice.amount), currency: 'PKR' });
    }
    setCartOpen(true);
  }

  async function submitOrder() {
    if(!form.name || !form.phone || !form.address || !form.city) { alert('Name, Phone, Address aur City zaroor bharein'); return; }
    setSubmitting(true);
    const orderNum = 'TA-' + Date.now().toString().slice(-6);
    
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ order_number: orderNum, name: form.name, phone: form.phone, address: form.address, city: form.city, email: form.email, items: cart, total: grand, delivery, notes: form.notes, status: 'pending' })
      });
    } catch(e) { console.log(e); }

    if(typeof window !== 'undefined') {
      (window as any).fbq?.('track', 'Purchase', { content_ids: cart.map(i=>i.handle), value: grand, currency: 'PKR', num_items: cartCount, order_id: orderNum });
      (window as any).ttq?.track('CompletePayment', { value: grand, currency: 'PKR', order_id: orderNum });
    }

    const msg = encodeURIComponent(`🛍 NEW ORDER — ${orderNum}\n\n👤 ${form.name}\n📞 ${form.phone}\n📍 ${form.address}, ${form.city}\n\n📦 Items:\n${cart.map(i=>`${i.title} x${i.qty} = Rs.${Math.round(parseFloat(i.price)*i.qty).toLocaleString()}`).join('\n')}\n\n💰 Total: Rs.${Math.round(grand).toLocaleString()} (COD)\n🚚 Delivery: ${delivery===0?'FREE':'Rs.'+delivery}`);
    window.open(`https://wa.me/${WA}?text=${msg}`, '_blank');
    
    setOrderSuccess(true);
    setCart([]);
    setSubmitting(false);
  }

  function showProduct(p: Product) {
    setCurrentProduct(p);
    setMainImg(p.images.edges[0]?.node.url || '');
    setPage('product');
    if(typeof window !== 'undefined') {
      (window as any).fbq?.('track', 'ViewContent', { content_name: p.title, content_ids: [p.handle], value: parseFloat(p.priceRange.minVariantPrice.amount), currency: 'PKR' });
      (window as any).ttq?.track('ViewContent', { content_id: p.handle, content_name: p.title, value: parseFloat(p.priceRange.minVariantPrice.amount), currency: 'PKR' });
    }
    window.scrollTo({top:0});
  }

  function showCollection(title: string) {
    setCollTitle(title);
    setCollFilter('all');
    setPage('collection');
    window.scrollTo({top:0});
  }

  const ProductCard = ({ p, i=0 }: { p: Product, i?: number }) => {
    const img = p.images.edges[0]?.node.url || '';
    const price = fmt(p.priceRange.minVariantPrice.amount);
    const oldAmt = parseFloat(p.compareAtPriceRange.minVariantPrice.amount);
    const isBest = p.handle === 'royal-sapphire-tulip-bracelet';
    return (
      <div className="product-card reveal" style={{transitionDelay:`${i*60}ms`}}>
        <div className="product-img-wrap" onClick={() => showProduct(p)}>
          <img src={img} alt={p.title} loading="lazy"/>
          {isBest && <span className="badge">Bestseller</span>}
          {!isBest && oldAmt > 0 && <span className="badge sale">Sale</span>}
          <button className="add-btn" onClick={e => { e.stopPropagation(); addToCart(p); }}>Add to Cart</button>
        </div>
        <div className="product-info" onClick={() => showProduct(p)}>
          <p className="product-cat">{getCat(p)}</p>
          <h3 className="product-name">{p.title}</h3>
          <div className="product-bot">
            <span className="product-price">{price}{oldAmt > 0 && <span className="product-old">{fmt(oldAmt.toString())}</span>}</span>
            <span className="stars">★★★★★</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .ann{background:#1C1009;color:rgba(255,255,255,0.9);padding:10px 0;overflow:hidden;font-size:11px;letter-spacing:0.16em;text-transform:uppercase}
        .ann-track{display:inline-flex;animation:marquee 30s linear infinite;white-space:nowrap}
        .ann-item{padding:0 48px}.ann-sep{color:#C9956C}.ann b{color:#C9956C}
        nav{position:sticky;top:0;z-index:200;background:rgba(250,248,244,0.97);backdrop-filter:blur(24px);border-bottom:1px solid var(--border)}
        .nav-top{display:flex;justify-content:center;align-items:center;padding:16px 60px 0;position:relative}
        .nav-logo{display:flex;flex-direction:column;align-items:center;text-decoration:none;cursor:pointer}
        .nav-logo img{height:40px;width:auto;object-fit:contain}
        .nav-logo-sub{font-family:'Playfair Display',serif;font-size:8px;letter-spacing:0.6em;color:var(--textmid);text-transform:uppercase;margin-top:3px}
        .nav-utils{position:absolute;right:60px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:20px}
        .nav-cart{background:var(--rose);color:#fff;border:none;padding:9px 20px;border-radius:40px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;font-family:'Jost',sans-serif;transition:all 0.3s;position:relative}
        .nav-cart:hover{background:var(--rose2);box-shadow:0 6px 20px rgba(183,104,121,0.35)}
        .cart-badge{position:absolute;top:-6px;right:-6px;background:var(--dark);color:white;border-radius:50%;width:18px;height:18px;font-size:10px;display:flex;align-items:center;justify-content:center}
        .nav-links{display:flex;justify-content:center;gap:40px;list-style:none;padding:12px 60px;border-top:1px solid var(--border2);margin-top:12px}
        .nav-links button{font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--textmid);background:none;border:none;cursor:pointer;font-family:'Jost',sans-serif;transition:color 0.2s}
        .nav-links button:hover{color:var(--rose)}
        
        /* CART */
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:500}
        .cart-drawer{position:fixed;top:0;right:0;width:420px;height:100vh;background:#fff;z-index:501;display:flex;flex-direction:column;box-shadow:-8px 0 40px rgba(0,0,0,0.15)}
        .cart-header{padding:24px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
        .cart-title{font-family:'Playfair Display',serif;font-size:22px;color:var(--text)}
        .cart-close{background:none;border:none;font-size:28px;cursor:pointer;color:var(--textmid)}
        .cart-items{flex:1;overflow-y:auto;padding:20px 28px}
        .cart-empty{text-align:center;padding:60px 20px}
        .cart-item{display:grid;grid-template-columns:80px 1fr auto;gap:16px;padding:16px 0;border-bottom:1px solid var(--border2);align-items:center}
        .cart-item img{width:80px;height:80px;object-fit:contain;background:var(--cream2);border-radius:12px;padding:8px}
        .cart-item-name{font-family:'Playfair Display',serif;font-size:15px;color:var(--text);margin-bottom:4px}
        .cart-item-price{font-size:14px;color:var(--rose)}
        .qty-wrap{display:flex;align-items:center;gap:8px;margin-top:8px}
        .qty-btn{background:var(--cream2);border:none;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background 0.2s}
        .qty-btn:hover{background:var(--rose);color:white}
        .remove-btn{background:none;border:none;color:var(--textlight);cursor:pointer;font-size:20px}
        .cart-footer{padding:20px 28px;border-top:1px solid var(--border)}
        .cart-subtotal{display:flex;justify-content:space-between;margin-bottom:16px}
        .cart-subtotal-label{font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:var(--textmid)}
        .cart-subtotal-price{font-family:'Playfair Display',serif;font-size:22px;color:var(--rose)}
        .cart-note{font-size:11px;color:var(--textlight);text-align:center;margin-bottom:12px}
        .btn-rose{background:var(--rose);color:#fff;border:none;padding:14px 32px;border-radius:40px;font-family:'Jost',sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;cursor:pointer;transition:all 0.3s;width:100%;margin-bottom:10px}
        .btn-rose:hover{background:var(--rose2);box-shadow:0 10px 28px rgba(183,104,121,0.3)}
        .btn-ghost{background:transparent;color:var(--text);border:1.5px solid var(--border);padding:13px;border-radius:40px;font-family:'Jost',sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;transition:all 0.3s;width:100%}
        .btn-ghost:hover{border-color:var(--rose);color:var(--rose)}

        /* COD MODAL */
        .cod-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:92vw;max-width:900px;max-height:90vh;background:#fff;z-index:601;border-radius:24px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 40px 100px rgba(0,0,0,0.3)}
        .cod-header{background:var(--dark);padding:20px 28px;display:flex;align-items:center;justify-content:space-between}
        .cod-close{background:none;border:none;color:rgba(255,255,255,0.6);font-size:28px;cursor:pointer}
        .cod-body{display:grid;grid-template-columns:1fr 1.4fr;overflow-y:auto;max-height:calc(90vh - 80px)}
        .cod-left{background:var(--cream2);padding:32px;border-right:1px solid var(--border)}
        .cod-right{padding:32px;overflow-y:auto}
        .cod-section-title{font-family:'Playfair Display',serif;font-size:20px;color:var(--text);margin-bottom:16px}
        .cod-item{display:grid;grid-template-columns:56px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border2)}
        .cod-item img{width:56px;height:56px;object-fit:contain;background:#fff;border-radius:10px;padding:6px}
        .cod-item-name{font-size:13px;color:var(--text);margin-bottom:3px}
        .cod-item-qty{font-size:11px;color:var(--textmid)}
        .cod-item-price{font-family:'Playfair Display',serif;font-size:15px;color:var(--rose);white-space:nowrap}
        .cod-divider{height:1px;background:var(--border);margin:16px 0}
        .cod-total-row{display:flex;justify-content:space-between;font-size:13px;color:var(--textmid);padding:6px 0}
        .cod-grand{font-family:'Playfair Display',serif;font-size:20px;color:var(--text);margin-top:8px;padding-top:12px;border-top:1px solid var(--border)}
        .cod-grand span:last-child{color:var(--rose)}
        .cod-badge{display:flex;align-items:center;gap:10px;background:var(--rosepale);border:1px solid rgba(183,104,121,0.2);border-radius:12px;padding:12px 16px;margin-top:20px;font-size:12px;color:var(--rose)}
        .cod-field{margin-bottom:16px}
        .cod-field-group{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .cod-label{font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:var(--textmid);display:block;margin-bottom:6px}
        .cod-input{width:100%;background:var(--cream);border:1.5px solid var(--border);border-radius:12px;color:var(--text);padding:12px 16px;font-family:'Jost',sans-serif;font-size:14px;outline:none;transition:border-color 0.3s}
        .cod-input:focus{border-color:var(--rose);background:#fff}
        .cod-trust-row{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;font-size:12px;color:var(--textmid)}
        .cod-success{text-align:center;padding:60px 20px}
        .cod-success-icon{width:72px;height:72px;background:var(--rosepale);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--rose);margin:0 auto 20px;border:2px solid var(--rose)}
        .cod-success-title{font-family:'Playfair Display',serif;font-size:28px;color:var(--text);margin-bottom:10px}
        .cod-success-sub{font-size:14px;color:var(--textmid);margin-bottom:20px}

        /* HERO */
        .hero{display:grid;grid-template-columns:1fr 1fr;min-height:calc(100vh - 108px);overflow:hidden}
        .hero-left{display:flex;flex-direction:column;justify-content:center;padding:80px 72px 80px 80px}
        .hero-badge{display:inline-flex;align-items:center;gap:10px;background:var(--rosepale);border:1px solid rgba(183,104,121,0.2);border-radius:40px;padding:7px 18px;width:fit-content;margin-bottom:32px;animation:fadeUp 0.9s ease 0.1s both}
        .badge-dot{width:6px;height:6px;border-radius:50%;background:var(--rose);animation:pulse 2s ease-in-out infinite}
        .hero-badge span{font-size:10.5px;letter-spacing:0.22em;color:var(--rose);text-transform:uppercase}
        .hero-title{font-family:'Playfair Display',serif;font-size:clamp(42px,5vw,74px);font-weight:400;line-height:1.06;color:var(--text);margin-bottom:24px;animation:fadeUp 0.9s ease 0.3s both}
        .hero-title em{font-style:italic;color:var(--rose);display:block}
        .hero-sub{font-size:14.5px;line-height:1.85;color:var(--textmid);max-width:380px;margin-bottom:40px;animation:fadeUp 0.9s ease 0.5s both}
        .hero-actions{display:flex;gap:14px;margin-bottom:48px;animation:fadeUp 0.9s ease 0.7s both}
        .btn-rose-sm{background:var(--rose);color:#fff;border:none;padding:14px 36px;border-radius:40px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;cursor:pointer;font-family:'Jost',sans-serif;transition:all 0.3s;text-decoration:none}
        .btn-rose-sm:hover{background:var(--rose2);transform:translateY(-2px);box-shadow:0 12px 32px rgba(183,104,121,0.35)}
        .btn-ghost-sm{background:transparent;color:var(--text);border:1.5px solid var(--border);padding:13px 30px;border-radius:40px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;font-family:'Jost',sans-serif;transition:all 0.3s}
        .btn-ghost-sm:hover{border-color:var(--rose);color:var(--rose)}
        .hero-trust{display:flex;border:1px solid var(--border);border-radius:16px;overflow:hidden;width:fit-content;animation:fadeUp 0.9s ease 0.9s both}
        .trust-pill{padding:12px 20px;border-right:1px solid var(--border);text-align:center}
        .trust-pill:last-child{border-right:none}
        .trust-val{font-family:'Playfair Display',serif;font-size:18px;color:var(--rose);display:block;line-height:1;margin-bottom:3px}
        .trust-key{font-size:10px;letter-spacing:0.14em;color:var(--textlight);text-transform:uppercase}
        .hero-right{position:relative;overflow:hidden;background:var(--blush)}
        .hero-right img{width:100%;height:100%;object-fit:contain;padding:40px}
        .float-card{position:absolute;bottom:40px;left:-16px;background:#fff;border-radius:18px;padding:18px 24px;box-shadow:0 20px 56px rgba(183,104,121,0.18);min-width:220px;border:1px solid rgba(183,104,121,0.1)}
        .float-lbl{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:0.22em;color:var(--rose);text-transform:uppercase;margin-bottom:6px}
        .float-d{width:5px;height:5px;border-radius:50%;background:var(--rose)}
        .float-name{font-family:'Playfair Display',serif;font-size:15px;color:var(--text);margin-bottom:4px}
        .float-price{font-size:15px;color:var(--rose);font-family:'Playfair Display',serif;margin-bottom:8px}
        .float-stars{font-size:12px;color:var(--rosegold);letter-spacing:2px}

        /* MARQUEE */
        .mq{background:var(--rose);padding:11px 0;overflow:hidden}
        .mq-track{display:inline-flex;animation:marquee 32s linear infinite;white-space:nowrap}
        .mq-item{font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.92);padding:0 36px}

        /* SECTIONS */
        .sw{padding:88px 80px}
        .stag{display:inline-flex;align-items:center;gap:10px;font-size:10.5px;letter-spacing:0.36em;color:var(--rose);text-transform:uppercase;margin-bottom:12px}
        .stag::before{content:'';width:24px;height:1px;background:var(--rose)}
        .sh{font-family:'Playfair Display',serif;font-size:clamp(28px,3.8vw,50px);font-weight:400;line-height:1.12;color:var(--text)}
        .sh em{font-style:italic;color:var(--rose)}
        .shr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:48px}
        .vlink{font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--rose);background:none;border:none;cursor:pointer;font-family:'Jost',sans-serif;display:flex;align-items:center;gap:8px;transition:gap 0.3s}
        .vlink:hover{gap:14px}

        /* COLLECTIONS */
        .coll-bg{background:var(--cream2)}
        .cg-row1{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:14px;margin-bottom:14px}
        .cg-row2{display:grid;grid-template-columns:1fr 1fr 1.5fr;gap:14px}
        .cc{position:relative;border-radius:20px;overflow:hidden;cursor:pointer}
        .cc img{width:100%;aspect-ratio:3/4;object-fit:contain;background:var(--blush);padding:20px;transition:transform 0.8s;filter:brightness(0.85)}
        .cc:hover img{transform:scale(1.07);filter:brightness(0.95)}
        .co{position:absolute;inset:0;background:linear-gradient(to top,rgba(28,16,9,0.85) 0%,transparent 60%);display:flex;flex-direction:column;justify-content:flex-end;padding:28px;border-radius:20px}
        .ctag{font-size:10px;letter-spacing:0.28em;color:rgba(240,216,220,0.85);text-transform:uppercase;margin-bottom:5px}
        .cname{font-family:'Playfair Display',serif;font-size:26px;color:#fff;margin-bottom:14px}
        .cbtn{display:inline-flex;font-size:10.5px;letter-spacing:0.18em;color:#fff;text-transform:uppercase;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);backdrop-filter:blur(8px);padding:9px 20px;border-radius:40px;transition:all 0.3s;opacity:0;transform:translateY(8px)}
        .cc:hover .cbtn{opacity:1;transform:translateY(0)}

        /* PRODUCTS */
        .pf{display:flex;gap:8px;margin-bottom:40px;flex-wrap:wrap}
        .ftag{background:transparent;border:1.5px solid var(--border);color:var(--textmid);padding:7px 20px;border-radius:40px;font-size:11px;letter-spacing:0.1em;cursor:pointer;font-family:'Jost',sans-serif;transition:all 0.3s}
        .ftag.active,.ftag:hover{background:var(--rose);border-color:var(--rose);color:#fff}
        .pg{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
        .product-card{background:#fff;border-radius:18px;overflow:hidden;transition:all 0.4s;cursor:pointer;border:1px solid var(--border2)}
        .product-card:hover{transform:translateY(-7px);box-shadow:0 24px 56px rgba(183,104,121,0.14)}
        .product-img-wrap{position:relative;aspect-ratio:1;overflow:hidden;background:var(--cream2)}
        .product-img-wrap img{width:100%;height:100%;object-fit:cover;transition:transform 0.7s}
        .product-card:hover .product-img-wrap img{transform:scale(1.08)}
        .badge{position:absolute;top:12px;left:12px;background:var(--rose);color:#fff;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;padding:5px 11px;border-radius:40px;z-index:2}
        .badge.sale{background:var(--rosegold)}
        .add-btn{position:absolute;bottom:0;left:0;right:0;background:var(--rose);color:#fff;border:none;padding:13px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;font-family:'Jost',sans-serif;transform:translateY(100%);transition:transform 0.35s;z-index:2}
        .product-card:hover .add-btn{transform:translateY(0)}
        .add-btn:hover{background:var(--rose2)}
        .product-info{padding:16px 18px 20px}
        .product-cat{font-size:9.5px;letter-spacing:0.24em;color:var(--rose);text-transform:uppercase;margin-bottom:5px}
        .product-name{font-family:'Playfair Display',serif;font-size:15.5px;line-height:1.3;color:var(--text);margin-bottom:10px}
        .product-bot{display:flex;justify-content:space-between;align-items:center}
        .product-price{font-family:'Playfair Display',serif;font-size:16px;color:var(--rose)}
        .product-old{font-size:11.5px;color:var(--textlight);text-decoration:line-through;margin-left:4px;font-family:'Jost',sans-serif}
        .stars{font-size:10.5px;color:var(--rosegold);letter-spacing:2px}

        /* FEATURED */
        .feat{display:grid;grid-template-columns:1fr 1fr}
        .feat-img{overflow:hidden;min-height:580px;background:var(--cream2);position:relative}
        .feat-img img{width:100%;height:100%;object-fit:contain;padding:40px}
        .feat-badge{position:absolute;top:28px;right:28px;background:var(--rose);color:#fff;border-radius:50%;width:72px;height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;line-height:1.4}
        .feat-content{padding:72px 60px;display:flex;flex-direction:column;justify-content:center;background:var(--cream)}
        .fstars{color:var(--rosegold);font-size:15px;letter-spacing:3px;margin-bottom:5px}
        .frc{font-size:12.5px;color:var(--textlight);margin-bottom:24px}
        .ftitle{font-family:'Playfair Display',serif;font-size:42px;font-weight:400;line-height:1.1;color:var(--text);margin-bottom:10px}
        .ftitle em{font-style:italic;color:var(--rose)}
        .fpw{display:flex;align-items:baseline;gap:10px;margin-bottom:20px}
        .fprice{font-family:'Playfair Display',serif;font-size:32px;color:var(--rose)}
        .fpo{font-size:17px;color:var(--textlight);text-decoration:line-through}
        .fdesc{font-size:14px;line-height:1.85;color:var(--textmid);margin-bottom:28px;max-width:380px}
        .fspecs{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:32px}
        .fspec{padding:14px 18px;border-right:1px solid var(--border);border-bottom:1px solid var(--border)}
        .fspec:nth-child(2n){border-right:none}.fspec:nth-child(3),.fspec:nth-child(4){border-bottom:none}
        .fsl{font-size:9px;letter-spacing:0.22em;color:var(--rose);text-transform:uppercase;margin-bottom:3px}
        .fsv{font-size:13px;color:var(--text)}
        .factions{display:flex;gap:12px}
        .btn-feat{background:var(--rose);color:#fff;border:none;padding:14px;border-radius:40px;font-family:'Jost',sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;cursor:pointer;transition:all 0.3s;flex:1}
        .btn-feat:hover{background:var(--rose2)}
        .btn-feat-ghost{background:transparent;color:var(--text);border:1.5px solid var(--border);padding:13px 24px;border-radius:40px;font-family:'Jost',sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;transition:all 0.3s}
        .btn-feat-ghost:hover{border-color:var(--rose);color:var(--rose)}

        /* STATS */
        .stats{background:var(--dark);display:grid;grid-template-columns:repeat(4,1fr)}
        .stat{padding:52px 40px;border-right:1px solid rgba(255,255,255,0.06);text-align:center}
        .stat:last-child{border-right:none}
        .stat-n{font-family:'Playfair Display',serif;font-size:52px;font-weight:300;color:var(--gold);line-height:1;margin-bottom:6px}
        .stat-l{font-size:11px;letter-spacing:0.2em;color:rgba(255,255,255,0.45);text-transform:uppercase}

        /* WHY */
        .why{background:var(--rose);padding:88px 80px}
        .why-title{font-family:'Playfair Display',serif;font-size:clamp(26px,3.5vw,46px);color:#fff;text-align:center;margin-bottom:52px}
        .why-title em{font-style:italic;opacity:0.8}
        .wg{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid rgba(255,255,255,0.15);border-radius:20px;overflow:hidden}
        .wi{padding:40px 32px;border-right:1px solid rgba(255,255,255,0.12);text-align:center}
        .wi:last-child{border-right:none}
        .wicon{font-size:32px;margin-bottom:16px;display:block}
        .wname{font-size:12px;letter-spacing:0.14em;color:#fff;text-transform:uppercase;margin-bottom:8px}
        .wdesc{font-size:12.5px;line-height:1.75;color:rgba(255,255,255,0.65)}

        /* TESTIMONIALS */
        .tg{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .tc{background:#fff;border-radius:22px;padding:36px;border:1px solid var(--border2);transition:all 0.4s}
        .tc:hover{transform:translateY(-6px);box-shadow:0 18px 48px rgba(183,104,121,0.12)}
        .tstars{color:var(--rosegold);font-size:14px;letter-spacing:3px;margin-bottom:18px}
        .ttext{font-family:'Playfair Display',serif;font-size:16.5px;font-style:italic;line-height:1.65;color:var(--text);margin-bottom:24px}
        .tdiv{width:32px;height:2px;background:var(--rose);border-radius:2px;margin-bottom:16px}
        .tname{font-size:12.5px;font-weight:500;color:var(--text);margin-bottom:3px}
        .tcity{font-size:11px;color:var(--textlight)}

        /* COLLECTION PAGE */
        .coll-hero{background:var(--dark);padding:64px 80px;text-align:center}
        .cph-tag{font-size:10px;letter-spacing:0.4em;color:var(--gold);text-transform:uppercase;margin-bottom:12px}
        .cph-title{font-family:'Playfair Display',serif;font-size:clamp(36px,5vw,64px);font-weight:400;color:#fff;margin-bottom:16px}
        .cph-title em{font-style:italic;color:var(--rose3)}
        .coll-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
        .coll-filter-bar{display:flex;gap:8px;margin-bottom:40px;flex-wrap:wrap}

        /* PRODUCT PAGE */
        .prod-layout{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start;padding:60px 80px}
        .prod-main-img{width:100%;aspect-ratio:1;object-fit:contain;background:var(--cream2);border-radius:20px;padding:32px;margin-bottom:12px}
        .prod-thumbs{display:flex;gap:8px;flex-wrap:wrap}
        .thumb{width:72px;height:72px;object-fit:contain;background:var(--cream2);border-radius:10px;cursor:pointer;padding:8px;border:2px solid transparent;transition:border-color 0.2s}
        .thumb.active,.thumb:hover{border-color:var(--rose)}
        .prod-breadcrumb{font-size:11px;color:var(--textlight);margin-bottom:16px}
        .prod-breadcrumb button{background:none;border:none;color:var(--textlight);cursor:pointer;font-family:'Jost',sans-serif;font-size:11px}
        .prod-breadcrumb button:hover{color:var(--rose)}
        .prod-title{font-family:'Playfair Display',serif;font-size:36px;font-weight:400;line-height:1.15;color:var(--text);margin-bottom:12px}
        .prod-rating{display:flex;align-items:center;gap:8px;margin-bottom:16px}
        .prod-price-row{display:flex;align-items:baseline;gap:12px;margin-bottom:24px}
        .prod-price{font-family:'Playfair Display',serif;font-size:32px;color:var(--rose)}
        .prod-compare{font-size:18px;color:var(--textlight);text-decoration:line-through}
        .prod-desc{font-size:14px;line-height:1.85;color:var(--textmid);margin-bottom:28px}
        .prod-specs{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:28px}
        .pspec{padding:13px 18px;border-right:1px solid var(--border);border-bottom:1px solid var(--border)}
        .pspec:nth-child(2n){border-right:none}.pspec:nth-child(3),.pspec:nth-child(4){border-bottom:none}
        .pspec-l{font-size:9px;letter-spacing:0.2em;color:var(--rose);text-transform:uppercase;margin-bottom:3px}
        .pspec-v{font-size:13px;color:var(--text)}
        .prod-actions{display:flex;flex-direction:column;gap:12px;margin-bottom:24px}
        .btn-add{background:var(--rose);color:#fff;border:none;padding:16px;border-radius:40px;font-family:'Jost',sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;cursor:pointer;transition:all 0.3s;width:100%}
        .btn-add:hover{background:var(--rose2)}
        .prod-trust{display:flex;gap:20px;flex-wrap:wrap;padding:20px;background:var(--cream2);border-radius:14px;font-size:12px;color:var(--textmid)}

        /* FOOTER */
        footer{background:var(--dark);color:var(--cream);padding:72px 80px 0}
        .ftop{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:56px;padding-bottom:56px;border-bottom:1px solid rgba(250,248,244,0.08)}
        .fblogo{height:32px;filter:brightness(0) invert(1);opacity:0.8;margin-bottom:16px}
        .fabout{font-size:12.5px;line-height:1.85;color:rgba(250,248,244,0.45);max-width:240px;margin-bottom:28px}
        .fsocials{display:flex;gap:10px}
        .fsc{width:38px;height:38px;border-radius:50%;border:1px solid rgba(250,248,244,0.12);display:flex;align-items:center;justify-content:center;color:rgba(250,248,244,0.45);text-decoration:none;font-size:12px;transition:all 0.3s}
        .fsc:hover{background:var(--rose);border-color:var(--rose);color:white}
        .fcol h4{font-size:9.5px;letter-spacing:0.32em;color:var(--rose3);text-transform:uppercase;margin-bottom:22px;padding-bottom:12px;border-bottom:1px solid rgba(250,248,244,0.06)}
        .fcol ul{list-style:none}.fcol li{margin-bottom:11px}
        .fcol button{font-size:13px;color:rgba(250,248,244,0.45);background:none;border:none;cursor:pointer;font-family:'Jost',sans-serif;transition:color 0.2s;text-align:left}
        .fcol button:hover{color:var(--rose3)}
        .fbot{padding:24px 0;display:flex;justify-content:space-between;align-items:center}
        .fcopy{font-size:11.5px;color:rgba(250,248,244,0.28)}
        .fcopy span{color:var(--rose3)}
        .fpills{display:flex;gap:8px}
        .fpill{background:rgba(250,248,244,0.04);border:1px solid rgba(250,248,244,0.08);color:rgba(250,248,244,0.3);font-size:9.5px;letter-spacing:0.1em;text-transform:uppercase;padding:6px 14px;border-radius:40px}

        /* WA */
        .wa{position:fixed;bottom:28px;right:28px;z-index:400;background:#25D366;color:white;border-radius:50%;width:56px;height:56px;display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 8px 24px rgba(37,211,102,0.4);font-size:24px;transition:all 0.3s}
        .wa:hover{transform:scale(1.1)}

        /* LOADING */
        .loading{display:flex;align-items:center;justify-content:center;padding:60px;gap:10px;grid-column:1/-1}
        .ld{width:8px;height:8px;border-radius:50%;background:var(--rose);animation:ldp 1.2s ease-in-out infinite}
        .ld:nth-child(2){animation-delay:0.2s}.ld:nth-child(3){animation-delay:0.4s}

        /* NEWSLETTER */
        .nl{background:var(--cream2);display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center;padding:88px 80px}
        .nlsub{font-size:14px;line-height:1.8;color:var(--textmid);margin-top:16px}
        .nlf{display:flex;flex-direction:column;gap:12px}
        .nlinput{background:#fff;border:1.5px solid var(--border);border-radius:40px;color:var(--text);padding:14px 24px;font-family:'Jost',sans-serif;font-size:13.5px;outline:none;transition:border-color 0.3s}
        .nlinput:focus{border-color:var(--rose)}
        .nlbtn{background:var(--rose);color:#fff;border:none;padding:15px 32px;border-radius:40px;font-family:'Jost',sans-serif;font-size:11.5px;letter-spacing:0.16em;text-transform:uppercase;cursor:pointer;transition:all 0.3s}
        .nlbtn:hover{background:var(--rose2)}

        @media(max-width:768px){
          .nav-top{padding:14px 20px 0}.nav-links{display:none}
          .hero{grid-template-columns:1fr}.hero-right{height:60vw}.hero-left{padding:52px 24px}
          .float-card{display:none}.sw{padding:56px 24px}
          .cg-row1,.cg-row2{grid-template-columns:1fr 1fr}
          .pg,.coll-grid{grid-template-columns:1fr 1fr;gap:12px}
          .feat{grid-template-columns:1fr}.feat-content{padding:44px 24px}
          .stats{grid-template-columns:1fr 1fr}.wg{grid-template-columns:1fr 1fr}
          .tg{grid-template-columns:1fr}.nl{grid-template-columns:1fr;gap:36px;padding:56px 24px}
          .prod-layout{grid-template-columns:1fr;padding:40px 20px}
          .coll-hero{padding:48px 24px}.why{padding:56px 24px}
          .ftop{grid-template-columns:1fr 1fr;gap:36px}
          .fbot{flex-direction:column;gap:14px;padding:20px 0}
          .cart-drawer{width:100%}
          .cod-body{grid-template-columns:1fr}.cod-left{display:none}.cod-right{padding:24px}
          .cod-field-group{grid-template-columns:1fr}
          .nav-utils{right:20px}
        }
      `}</style>

      {/* ANNOUNCEMENT */}
      <div className="ann">
        <div className="ann-track">
          {[...Array(2)].map((_, i) => (
            <span key={i} style={{display:'contents'}}>
              <span className="ann-item">🚚 Free Delivery on Orders Over <b>Rs.2000/-</b> <span className="ann-sep"> ✦ </span></span>
              <span className="ann-item">Cash on Delivery Available Across Pakistan <span className="ann-sep"> ✦ </span></span>
              <span className="ann-item">Easy <b>15-Day</b> Returns & Exchange <span className="ann-sep"> ✦ </span></span>
              <span className="ann-item">Trusted by <b>10,000+</b> Happy Customers ⭐ 4.9 <span className="ann-sep"> ✦ </span></span>
              <span className="ann-item">First Check, Then Pay — Order with Confidence <span className="ann-sep"> ✦ </span></span>
            </span>
          ))}
        </div>
      </div>

      {/* NAV */}
      <nav>
        <div className="nav-top">
          <div className="nav-logo" onClick={() => setPage('home')}>
            <img src="https://www.thealabanza.com/cdn/shop/files/ALABANZA_Logo_2ed50e44-3f22-4238-bf4d-073a2189b824.png?height=120&v=1781839650" alt="The Alabanza"/>
            <span className="nav-logo-sub">Fine Jewelry Pakistan</span>
          </div>
          <div className="nav-utils">
            <button className="nav-cart" onClick={() => setCartOpen(true)}>
              🛍 Cart {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
        <ul className="nav-links">
          <li><button onClick={() => setPage('home')}>Home</button></li>
          <li><button onClick={() => showCollection('Bracelets')}>Bracelets</button></li>
          <li><button onClick={() => showCollection('Necklaces')}>Necklaces</button></li>
          <li><button onClick={() => showCollection('Earrings')}>Earrings</button></li>
          <li><button onClick={() => showCollection('Bangles')}>Bangles</button></li>
          <li><button onClick={() => showCollection('Watches')}>Watches</button></li>
          <li><button onClick={() => showCollection('Bags')}>Bags</button></li>
        </ul>
      </nav>

      {/* CART DRAWER */}
      {cartOpen && <div className="overlay" onClick={() => setCartOpen(false)}/>}
      {cartOpen && (
        <div className="cart-drawer">
          <div className="cart-header">
            <h2 className="cart-title">Your Cart</h2>
            <button className="cart-close" onClick={() => setCartOpen(false)}>×</button>
          </div>
          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="cart-empty">
                <div style={{fontSize:48,marginBottom:16}}>🛍</div>
                <p style={{fontFamily:'Playfair Display,serif',fontSize:18,color:'var(--textmid)',marginBottom:20}}>Your cart is empty</p>
                <button className="btn-rose" onClick={() => setCartOpen(false)}>Continue Shopping</button>
              </div>
            ) : cart.map((item, i) => (
              <div key={i} className="cart-item">
                <img src={item.image} alt={item.title}/>
                <div>
                  <p className="cart-item-name">{item.title}</p>
                  <p className="cart-item-price">Rs. {Math.round(parseFloat(item.price)).toLocaleString()}</p>
                  <div className="qty-wrap">
                    <button className="qty-btn" onClick={() => setCart(prev => prev.map((x,j) => j===i ? {...x,qty:Math.max(0,x.qty-1)} : x).filter(x=>x.qty>0))}>−</button>
                    <span>{item.qty}</span>
                    <button className="qty-btn" onClick={() => setCart(prev => prev.map((x,j) => j===i ? {...x,qty:x.qty+1} : x))}>+</button>
                  </div>
                </div>
                <button className="remove-btn" onClick={() => setCart(prev => prev.filter((_,j) => j!==i))}>×</button>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="cart-footer">
              <div className="cart-subtotal">
                <span className="cart-subtotal-label">Total</span>
                <span className="cart-subtotal-price">Rs. {Math.round(grand).toLocaleString()}</span>
              </div>
              <p className="cart-note">🚚 {delivery === 0 ? 'Free delivery included!' : `Add Rs. ${2000-cartTotal} more for free delivery`}</p>
              <button className="btn-rose" onClick={() => { setCartOpen(false); setCodOpen(true); setOrderSuccess(false); }}>Checkout — Cash on Delivery</button>
              <button className="btn-ghost" onClick={() => setCartOpen(false)}>Continue Shopping</button>
            </div>
          )}
        </div>
      )}

      {/* COD MODAL */}
      {codOpen && <div className="overlay" onClick={() => setCodOpen(false)}/>}
      {codOpen && (
        <div className="cod-modal">
          <div className="cod-header">
            <img src="https://www.thealabanza.com/cdn/shop/files/ALABANZA_Logo_2ed50e44-3f22-4238-bf4d-073a2189b824.png?height=80&v=1781839650" alt="The Alabanza" style={{height:32,filter:'brightness(0) invert(1)'}}/>
            <button className="cod-close" onClick={() => setCodOpen(false)}>×</button>
          </div>
          <div className="cod-body">
            <div className="cod-left">
              <h3 className="cod-section-title">Order Summary</h3>
              {cart.map((item, i) => (
                <div key={i} className="cod-item">
                  <img src={item.image} alt={item.title}/>
                  <div>
                    <p className="cod-item-name">{item.title}</p>
                    <p className="cod-item-qty">Qty: {item.qty}</p>
                  </div>
                  <span className="cod-item-price">Rs. {Math.round(parseFloat(item.price)*item.qty).toLocaleString()}</span>
                </div>
              ))}
              <div className="cod-divider"/>
              <div className="cod-total-row"><span>Subtotal</span><span>Rs. {Math.round(cartTotal).toLocaleString()}</span></div>
              <div className="cod-total-row"><span>Delivery</span><span style={{color: delivery===0?'#22c55e':'inherit'}}>{delivery===0?'FREE':'Rs. '+delivery}</span></div>
              <div className="cod-total-row cod-grand"><span>Total</span><span>Rs. {Math.round(grand).toLocaleString()}</span></div>
              <div className="cod-badge">🔒 Cash on Delivery — Pay when you receive</div>
            </div>
            <div className="cod-right">
              {orderSuccess ? (
                <div className="cod-success">
                  <div className="cod-success-icon">✓</div>
                  <h3 className="cod-success-title">Order Placed!</h3>
                  <p className="cod-success-sub">Shukriya! Hamari team 24 ghante mein WhatsApp pe confirm karegi.</p>
                  <button className="btn-rose" style={{marginTop:20}} onClick={() => { setCodOpen(false); setPage('home'); }}>Continue Shopping</button>
                </div>
              ) : (
                <>
                  <h3 className="cod-section-title">Delivery Information</h3>
                  <p style={{fontSize:13,color:'var(--textmid)',marginBottom:24}}>Apni details bharein — hum doorstep pe deliver karenge</p>
                  <div className="cod-field-group">
                    <div className="cod-field">
                      <label className="cod-label">Full Name *</label>
                      <input className="cod-input" placeholder="Ayesha Khan" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
                    </div>
                    <div className="cod-field">
                      <label className="cod-label">Phone Number *</label>
                      <input className="cod-input" placeholder="03XXXXXXXXX" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})}/>
                    </div>
                  </div>
                  <div className="cod-field">
                    <label className="cod-label">Full Address *</label>
                    <input className="cod-input" placeholder="House #, Street, Area" value={form.address} onChange={e => setForm({...form, address:e.target.value})}/>
                  </div>
                  <div className="cod-field-group">
                    <div className="cod-field">
                      <label className="cod-label">City *</label>
                      <select className="cod-input" value={form.city} onChange={e => setForm({...form, city:e.target.value})}>
                        <option value="">Select City</option>
                        {['Karachi','Lahore','Islamabad','Rawalpindi','Faisalabad','Multan','Peshawar','Quetta','Sialkot','Gujranwala','Hyderabad','Abbottabad','Other'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="cod-field">
                      <label className="cod-label">Email (Optional)</label>
                      <input className="cod-input" placeholder="email@example.com" value={form.email} onChange={e => setForm({...form, email:e.target.value})}/>
                    </div>
                  </div>
                  <div className="cod-trust-row">
                    <span>🚚 2-5 Day Delivery</span>
                    <span>💰 Pay on Delivery</span>
                    <span>🔄 15-Day Returns</span>
                  </div>
                  <button className="btn-rose" disabled={submitting} onClick={submitOrder}>
                    {submitting ? 'Placing Order...' : 'Place Order — Cash on Delivery'}
                  </button>
                  <p style={{fontSize:11,color:'var(--textlight)',textAlign:'center',marginTop:12}}>Order confirm hone ke baad WhatsApp pe message aayega</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HOME PAGE */}
      {page === 'home' && (
        <>
          {/* HERO */}
          <div className="hero">
            <div className="hero-left">
              <div className="hero-badge"><span className="badge-dot"/><span>New Arrivals — Summer 2026</span></div>
              <h1 className="hero-title">Where Every<br/>Woman Wears<br/><em>Her Story</em></h1>
              <p className="hero-sub">Handcrafted fine jewelry designed for the modern Pakistani woman — pieces that feel as beautiful as they look, delivered Cash on Delivery.</p>
              <div className="hero-actions">
                <button className="btn-rose-sm" onClick={() => showCollection('Bracelets')}>Shop Bracelets</button>
                <button className="btn-ghost-sm" onClick={() => showCollection('Necklaces')}>Explore Necklaces</button>
              </div>
              <div className="hero-trust">
                <div className="trust-pill"><span className="trust-val">10K+</span><span className="trust-key">Customers</span></div>
                <div className="trust-pill"><span className="trust-val">4.9★</span><span className="trust-key">Rated</span></div>
                <div className="trust-pill"><span className="trust-val">COD</span><span className="trust-key">Available</span></div>
                <div className="trust-pill"><span className="trust-val">15D</span><span className="trust-key">Returns</span></div>
              </div>
            </div>
            <div className="hero-right">
              <img src="https://www.thealabanza.com/cdn/shop/files/PinkNew1.png?v=1782535866&width=1200" alt="The Alabanza"/>
              <div className="float-card">
                <div className="float-lbl"><span className="float-d"/><span>Bestseller</span></div>
                <p className="float-name">Royal Sapphire Tulip Bracelet</p>
                <p className="float-price">Rs. 1,199 <span style={{fontSize:12,color:'var(--textlight)',textDecoration:'line-through',fontFamily:'Jost'}}>Rs. 1,899</span></p>
                <p className="float-stars">★★★★★ <span style={{fontSize:11,color:'var(--textlight)',marginLeft:4}}>2,847 reviews</span></p>
              </div>
            </div>
          </div>

          {/* MARQUEE */}
          <div className="mq">
            <div className="mq-track">
              {[...Array(2)].map((_,i) => (
                <span key={i} style={{display:'contents'}}>
                  {['Handcrafted Fine Jewelry','Cash on Delivery Pakistan','Free Delivery Rs.2000+','10,000+ Happy Women','15-Day Easy Returns','Premium 18K Gold Plated'].map(t => (
                    <span key={t} className="mq-item">{t} <span style={{color:'rgba(255,255,255,0.4)',fontSize:8}}>✦</span></span>
                  ))}
                </span>
              ))}
            </div>
          </div>

          {/* COLLECTIONS */}
          <div className="sw coll-bg">
            <div className="shr">
              <div><p className="stag">Explore</p><h2 className="sh">Shop by <em>Collection</em></h2></div>
              <button className="vlink" onClick={() => showCollection('All')}>View All →</button>
            </div>
            <div className="cg-row1 reveal">
              {[
                {title:'Bracelets',tag:'Most Loved',img:'https://www.thealabanza.com/cdn/shop/files/PinkNew1.png?v=1782535866&width=800'},
                {title:'Necklaces',tag:'New Season',img:'https://www.thealabanza.com/cdn/shop/files/tulip-ruby-necklace.png?v=1782433142&width=600'},
                {title:'Earrings',tag:'Trending',img:'https://www.thealabanza.com/cdn/shop/files/Butterfly_Earrings.png?v=1782528676&width=600'},
              ].map(c => (
                <div key={c.title} className="cc" onClick={() => showCollection(c.title)}>
                  <img src={c.img} alt={c.title}/>
                  <div className="co"><p className="ctag">{c.tag}</p><h3 className="cname">{c.title}</h3><span className="cbtn">Shop Now →</span></div>
                </div>
              ))}
            </div>
            <div className="cg-row2 reveal">
              {[
                {title:'Bangles',tag:'Premium',img:'https://www.thealabanza.com/cdn/shop/files/Sunburst-Bangle.png?v=1782535871&width=600'},
                {title:'Bags',tag:'Designer',img:'https://www.thealabanza.com/cdn/shop/files/ChatGPTImageJun8_2026_10_13_22PM.png?v=1782536073&width=600'},
                {title:'Watches',tag:'Luxury',img:'https://www.thealabanza.com/cdn/shop/files/Tissot-PRX.png?v=1782535871&width=800'},
              ].map(c => (
                <div key={c.title} className="cc" onClick={() => showCollection(c.title)}>
                  <img src={c.img} alt={c.title}/>
                  <div className="co"><p className="ctag">{c.tag}</p><h3 className="cname">{c.title}</h3><span className="cbtn">Shop Now →</span></div>
                </div>
              ))}
            </div>
          </div>

          {/* PRODUCTS */}
          <div className="sw">
            <div className="shr">
              <div><p className="stag">Trending</p><h2 className="sh">New <em>Arrivals</em></h2></div>
              <button className="vlink" onClick={() => showCollection('All')}>All Products →</button>
            </div>
            <div className="pf">
              {['all','bracelet','necklace','earring','bangle','watch','bag'].map(f => (
                <button key={f} className={`ftag ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase()+f.slice(1)+'s'}
                </button>
              ))}
            </div>
            <div className="pg">
              {products.length === 0 ? (
                <div className="loading"><div className="ld"/><div className="ld"/><div className="ld"/></div>
              ) : filtered.slice(0,8).map((p,i) => <ProductCard key={p.id} p={p} i={i}/>)}
            </div>
          </div>

          {/* TRENDING NECKLACES */}
          <div className="sw" style={{background:'var(--cream2)'}}>
            <div className="shr">
              <div><p className="stag">New Season</p><h2 className="sh">Trending <em>Necklaces</em></h2></div>
              <button className="vlink" onClick={() => showCollection('Necklaces')}>View All →</button>
            </div>
            <div className="pg">
              {necklaces.length === 0 ? (
                <div className="loading"><div className="ld"/><div className="ld"/><div className="ld"/></div>
              ) : necklaces.map((p,i) => <ProductCard key={p.id} p={p} i={i}/>)}
            </div>
          </div>

          {/* FEATURED */}
          <div className="feat">
            <div className="feat-img">
              <img src="https://www.thealabanza.com/cdn/shop/files/PinkNew1.png?v=1782535866&width=900" alt="Royal Sapphire Tulip Bracelet"/>
              <div className="feat-badge"><span>93%</span><span>of orders</span></div>
            </div>
            <div className="feat-content reveal">
              <p className="stag">Signature Piece</p>
              <p className="fstars">★★★★★</p>
              <p className="frc">4.9 out of 5 — 2,847 verified reviews</p>
              <h2 className="ftitle">Royal Sapphire<br/><em>Tulip Bracelet</em></h2>
              <div className="fpw"><span className="fprice">Rs. 1,199</span><span className="fpo">Rs. 1,899</span></div>
              <p className="fdesc">Our most-loved piece since day one. A delicate tulip motif set with hand-selected sapphire crystals, plated in 18K gold.</p>
              <div className="fspecs">
                <div className="fspec"><p className="fsl">Material</p><p className="fsv">18K Gold Plated</p></div>
                <div className="fspec"><p className="fsl">Stone</p><p className="fsv">Sapphire Crystal</p></div>
                <div className="fspec"><p className="fsl">Delivery</p><p className="fsv">Cash on Delivery</p></div>
                <div className="fspec"><p className="fsl">Returns</p><p className="fsv">15-Day Free Return</p></div>
              </div>
              <div className="factions">
                <button className="btn-feat" onClick={() => { const p = products.find(x=>x.handle==='royal-sapphire-tulip-bracelet'); if(p) addToCart(p); }}>Add to Cart</button>
                <button className="btn-feat-ghost" onClick={() => { const p = products.find(x=>x.handle==='royal-sapphire-tulip-bracelet'); if(p) showProduct(p); }}>View Details</button>
              </div>
            </div>
          </div>

          {/* STATS */}
          <div className="stats">
            {[{n:'10K+',l:'Happy Customers'},{n:'4.9',l:'Average Rating'},{n:'98%',l:'Satisfaction Rate'},{n:'15D',l:'Easy Returns'}].map(s => (
              <div key={s.l} className="stat reveal"><p className="stat-n">{s.n}</p><p className="stat-l">{s.l}</p></div>
            ))}
          </div>

          {/* WHY */}
          <div className="why">
            <h2 className="why-title">Why <em>10,000+</em> Women Choose The Alabanza</h2>
            <div className="wg">
              {[{icon:'💎',name:'Premium Quality',desc:'18K gold plating, genuine crystals — crafted to last.'},{icon:'🚚',name:'Cash on Delivery',desc:'Pay only when your jewelry arrives safely.'},{icon:'🎁',name:'Gift Packaging',desc:'Every order arrives in elegant gift-ready packaging.'},{icon:'🔄',name:'15-Day Returns',desc:'Not satisfied? Return within 15 days, no questions.'}].map(w => (
                <div key={w.name} className="wi"><span className="wicon">{w.icon}</span><p className="wname">{w.name}</p><p className="wdesc">{w.desc}</p></div>
              ))}
            </div>
          </div>

          {/* TESTIMONIALS */}
          <div className="sw">
            <div style={{textAlign:'center',marginBottom:52}}><p className="stag" style={{justifyContent:'center'}}>Customer Love</p><h2 className="sh">Loved by <em>Thousands</em></h2></div>
            <div className="tg">
              {[{text:'"The Royal Sapphire Tulip Bracelet is absolutely stunning. So many compliments!"',name:'Ayesha Malik',city:'Lahore'},{text:'"Ordered for my sister\'s wedding. Beautiful packaging, arrived perfectly."',name:'Sana Ahmed',city:'Karachi'},{text:'"Cash on delivery made it so easy. Quality is exceptional — feels premium!"',name:'Fatima Zahra',city:'Islamabad'}].map(t => (
                <div key={t.name} className="tc reveal">
                  <p className="tstars">★★★★★</p>
                  <p className="ttext">{t.text}</p>
                  <div className="tdiv"/>
                  <p className="tname">{t.name}</p>
                  <p className="tcity">{t.city}, Pakistan</p>
                </div>
              ))}
            </div>
          </div>

          {/* NEWSLETTER */}
          <div className="nl">
            <div>
              <p className="stag">Stay Connected</p>
              <h2 className="sh">Get <em>First Access</em><br/>to New Arrivals</h2>
              <p className="nlsub">Join 10,000+ women who get exclusive early access to new collections and special offers.</p>
            </div>
            <div className="nlf">
              <input type="text" className="nlinput" placeholder="Your name"/>
              <input type="email" className="nlinput" placeholder="Your email address"/>
              <button className="nlbtn">Subscribe — Get 10% Off First Order</button>
              <p style={{fontSize:11,color:'var(--textlight)',textAlign:'center'}}>No spam, ever. Unsubscribe anytime.</p>
            </div>
          </div>
        </>
      )}

      {/* COLLECTION PAGE */}
      {page === 'collection' && (
        <>
          <div className="coll-hero">
            <p className="cph-tag">Collection</p>
            <h1 className="cph-title"><em>{collTitle}</em></h1>
          </div>
          <div className="sw">
            <div className="coll-filter-bar">
              <button className={`ftag ${collFilter==='all'?'active':''}`} onClick={() => setCollFilter('all')}>All</button>
              <button className={`ftag ${collFilter==='sale'?'active':''}`} onClick={() => setCollFilter('sale')}>On Sale</button>
            </div>
            <div className="coll-grid">
              {collProducts.length === 0 ? (
                <div className="loading"><div className="ld"/><div className="ld"/><div className="ld"/></div>
              ) : collProducts.map((p,i) => <ProductCard key={p.id} p={p} i={i}/>)}
            </div>
          </div>
        </>
      )}

      {/* PRODUCT PAGE */}
      {page === 'product' && currentProduct && (
        <div className="prod-layout">
          <div>
            <img className="prod-main-img" src={mainImg} alt={currentProduct.title}/>
            <div className="prod-thumbs">
              {currentProduct.images.edges.map((e,i) => (
                <img key={i} className={`thumb ${mainImg===e.node.url?'active':''}`} src={e.node.url} alt={`View ${i+1}`} onClick={() => setMainImg(e.node.url)}/>
              ))}
            </div>
          </div>
          <div>
            <p className="prod-breadcrumb">
              <button onClick={() => setPage('home')}>Home</button> / 
              <button onClick={() => showCollection(getCat(currentProduct).charAt(0).toUpperCase()+getCat(currentProduct).slice(1)+'s')}> {getCat(currentProduct)}</button> / 
              <span> {currentProduct.title}</span>
            </p>
            <h1 className="prod-title">{currentProduct.title}</h1>
            <div className="prod-rating"><span style={{color:'var(--rosegold)',fontSize:14,letterSpacing:2}}>★★★★★</span><span style={{fontSize:12,color:'var(--textlight)'}}>4.9 (2,847 reviews)</span></div>
            <div className="prod-price-row">
              <span className="prod-price">{fmt(currentProduct.priceRange.minVariantPrice.amount)}</span>
              {parseFloat(currentProduct.compareAtPriceRange.minVariantPrice.amount) > 0 && (
                <span className="prod-compare">{fmt(currentProduct.compareAtPriceRange.minVariantPrice.amount)}</span>
              )}
            </div>
            <p className="prod-desc">{currentProduct.description || 'A beautiful handcrafted piece from The Alabanza collection. Premium quality, 18K gold plated, delivered Cash on Delivery across Pakistan.'}</p>
            <div className="prod-specs">
              <div className="pspec"><p className="pspec-l">Material</p><p className="pspec-v">18K Gold Plated</p></div>
              <div className="pspec"><p className="pspec-l">Delivery</p><p className="pspec-v">Cash on Delivery</p></div>
              <div className="pspec"><p className="pspec-l">Returns</p><p className="pspec-v">15-Day Free Return</p></div>
              <div className="pspec"><p className="pspec-l">Packaging</p><p className="pspec-v">Gift Ready Box</p></div>
            </div>
            <div className="prod-actions">
              <button className="btn-add" onClick={() => addToCart(currentProduct)}>Add to Cart</button>
              <button className="btn-add" style={{background:'var(--dark)'}} onClick={() => { addToCart(currentProduct); setCodOpen(true); }}>Buy Now</button>
            </div>
            <div className="prod-trust">
              <span>🚚 Free Delivery Rs.2000+</span>
              <span>🔒 Secure</span>
              <span>🔄 15-Day Returns</span>
              <span>📦 Gift Box</span>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer>
        <div className="ftop">
          <div>
            <img className="fblogo" src="https://www.thealabanza.com/cdn/shop/files/ALABANZA_Logo_2ed50e44-3f22-4238-bf4d-073a2189b824.png?height=120&v=1781839650" alt="The Alabanza"/>
            <p className="fabout">Crafting fine jewelry for the modern Pakistani woman. Each piece tells a story of elegance and artistry.</p>
            <div className="fsocials">
              <a href="https://www.facebook.com/profile.php?id=61590523686077" target="_blank" className="fsc">f</a>
              <a href="https://www.instagram.com/the.alabanza" target="_blank" className="fsc">in</a>
              <a href="https://www.tiktok.com/@thealabanza.com" target="_blank" className="fsc">tk</a>
            </div>
          </div>
          <div className="fcol"><h4>Shop</h4><ul>
            {['Bracelets','Necklaces','Earrings','Bangles','Watches','Bags'].map(c => <li key={c}><button onClick={() => showCollection(c)}>{c}</button></li>)}
          </ul></div>
          <div className="fcol"><h4>Help</h4><ul>
            <li><a href="https://thealabanza.com/policies/refund-policy" target="_blank" style={{color:'rgba(250,248,244,0.45)',textDecoration:'none',fontSize:13}}>Returns Policy</a></li>
            <li><a href="https://thealabanza.com/policies/shipping-policy" target="_blank" style={{color:'rgba(250,248,244,0.45)',textDecoration:'none',fontSize:13}}>Shipping Policy</a></li>
            <li><a href="https://thealabanza.com/policies/contact-information" target="_blank" style={{color:'rgba(250,248,244,0.45)',textDecoration:'none',fontSize:13}}>Contact Us</a></li>
          </ul></div>
          <div className="fcol"><h4>Contact</h4><ul>
            <li><a href={`https://wa.me/${WA}`} target="_blank" style={{color:'rgba(250,248,244,0.45)',textDecoration:'none',fontSize:13}}>WhatsApp Us</a></li>
            <li><a href="mailto:thealabanzaofficial@gmail.com" style={{color:'rgba(250,248,244,0.45)',textDecoration:'none',fontSize:13}}>thealabanzaofficial@gmail.com</a></li>
          </ul></div>
        </div>
        <div className="fbot">
          <p className="fcopy">© 2026 <span>The Alabanza</span>. All rights reserved. Made with ♡ in Pakistan.</p>
          <div className="fpills">
            <span className="fpill">Cash on Delivery</span>
            <span className="fpill">15-Day Returns</span>
          </div>
        </div>
      </footer>

      <a href={`https://wa.me/${WA}?text=Hi%20The%20Alabanza!`} className="wa" target="_blank">💬</a>
    </>
  );
}