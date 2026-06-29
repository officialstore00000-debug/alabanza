'use client';
import { useState, useEffect } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SHOPIFY_STORE = process.env.NEXT_PUBLIC_SHOPIFY_STORE!;
const SHOPIFY_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_TOKEN!;

interface Order {
  id: number;
  order_number: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  email: string;
  items: any[];
  total: number;
  delivery: number;
  notes: string;
  status: string;
  created_at: string;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  status: string;
  priceRange: { minVariantPrice: { amount: string } };
  images: { edges: { node: { url: string } }[] };
  productType: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#22c55e',
  cancelled: '#ef4444'
};

export default function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<'dashboard'|'orders'|'products'|'pixels'|'settings'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order|null>(null);
  const [dateFilter, setDateFilter] = useState('all');

  async function login() {
    if(email === 'thealabanzaofficial@gmail.com' && password === 'Alabanza@2026') {
      setAuthed(true);
      fetchOrders();
      fetchProducts();
    } else {
      alert('Wrong credentials!');
    }
  }

  async function fetchOrders() {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order=created_at.desc&limit=500`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch(e) { console.log(e); }
    setLoading(false);
  }

  async function fetchProducts() {
    const query = `{ products(first:50) { edges { node { id title handle status priceRange { minVariantPrice { amount } } images(first:1) { edges { node { url } } } productType } } } }`;
    try {
      const r = await fetch(`https://${SHOPIFY_STORE}/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': SHOPIFY_TOKEN },
        body: JSON.stringify({ query })
      });
      const d = await r.json();
      setProducts(d.data?.products?.edges?.map((e: any) => e.node) || []);
    } catch(e) { console.log(e); }
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status })
    });
    setOrders(prev => prev.map(o => o.id === id ? {...o, status} : o));
    if(selectedOrder?.id === id) setSelectedOrder(prev => prev ? {...prev, status} : null);
  }

  // ANALYTICS
  const today = new Date().toDateString();
  const thisWeek = new Date(Date.now() - 7*24*60*60*1000);
  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const filteredByDate = orders.filter(o => {
    const d = new Date(o.created_at);
    if(dateFilter === 'today') return d.toDateString() === today;
    if(dateFilter === 'week') return d >= thisWeek;
    if(dateFilter === 'month') return d >= thisMonth;
    return true;
  });

  const totalRevenue = filteredByDate.reduce((s,o) => s+(o.total||0), 0);
  const avgOrder = filteredByDate.length > 0 ? totalRevenue/filteredByDate.length : 0;
  const pendingCount = orders.filter(o => o.status==='pending').length;
  const deliveredCount = orders.filter(o => o.status==='delivered').length;

  // Orders by day (last 7 days)
  const last7Days = Array.from({length:7}, (_,i) => {
    const d = new Date(Date.now() - (6-i)*24*60*60*1000);
    const dayStr = d.toDateString();
    const dayOrders = orders.filter(o => new Date(o.created_at).toDateString() === dayStr);
    return {
      day: d.toLocaleDateString('en-US', {weekday:'short'}),
      count: dayOrders.length,
      revenue: dayOrders.reduce((s,o) => s+(o.total||0), 0)
    };
  });
  const maxRevenue = Math.max(...last7Days.map(d => d.revenue), 1);

  // Orders by city
  const cityMap: Record<string,number> = {};
  orders.forEach(o => { if(o.city) cityMap[o.city] = (cityMap[o.city]||0)+1; });
  const topCities = Object.entries(cityMap).sort((a,b) => b[1]-a[1]).slice(0,5);

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    const matchSearch = !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.order_number?.toLowerCase().includes(search.toLowerCase()) || o.phone?.includes(search);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if(!authed) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#1C1009 0%,#3D1F10 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Jost,sans-serif'}}>
      <div style={{background:'#fff',borderRadius:28,padding:52,width:420,boxShadow:'0 60px 120px rgba(0,0,0,0.5)'}}>
        <div style={{textAlign:'center',marginBottom:36}}>
          <img src="https://www.thealabanza.com/cdn/shop/files/ALABANZA_Logo_2ed50e44-3f22-4238-bf4d-073a2189b824.png?height=120&v=1781839650" alt="The Alabanza" style={{height:52,marginBottom:20}}/>
          <h1 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#241208',marginBottom:8}}>Admin Panel</h1>
          <p style={{fontSize:13,color:'#7A5C50'}}>The Alabanza Store Management</p>
        </div>
        <div style={{marginBottom:18}}>
          <label style={{fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',color:'#7A5C50',display:'block',marginBottom:8}}>Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@thealabanza.com" style={{width:'100%',background:'#FAF8F4',border:'1.5px solid rgba(183,104,121,0.25)',borderRadius:14,padding:'14px 18px',fontFamily:'Jost,sans-serif',fontSize:14,outline:'none',boxSizing:'border-box'}}/>
        </div>
        <div style={{marginBottom:28}}>
          <label style={{fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',color:'#7A5C50',display:'block',marginBottom:8}}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••" style={{width:'100%',background:'#FAF8F4',border:'1.5px solid rgba(183,104,121,0.25)',borderRadius:14,padding:'14px 18px',fontFamily:'Jost,sans-serif',fontSize:14,outline:'none',boxSizing:'border-box'}}/>
        </div>
        <button onClick={login} style={{width:'100%',background:'linear-gradient(135deg,#B76879,#C97D8D)',color:'#fff',border:'none',padding:18,borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:12,letterSpacing:'0.18em',textTransform:'uppercase',cursor:'pointer',boxShadow:'0 8px 24px rgba(183,104,121,0.35)'}}>
          Login to Dashboard
        </button>
      </div>
    </div>
  );

  const tabs = [
    {id:'dashboard',label:'Dashboard',icon:'📊'},
    {id:'orders',label:'Orders',icon:'📦'},
    {id:'products',label:'Products',icon:'💎'},
    {id:'pixels',label:'Pixels',icon:'📡'},
    {id:'settings',label:'Settings',icon:'⚙️'},
  ];

  return (
    <div style={{minHeight:'100vh',background:'#F5F0EB',fontFamily:'Jost,sans-serif',display:'flex'}}>
      {/* SIDEBAR */}
      <div style={{width:240,background:'#1C1009',display:'flex',flexDirection:'column',position:'fixed',top:0,left:0,height:'100vh',zIndex:100}}>
        <div style={{padding:'28px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <img src="https://www.thealabanza.com/cdn/shop/files/ALABANZA_Logo_2ed50e44-3f22-4238-bf4d-073a2189b824.png?height=120&v=1781839650" alt="The Alabanza" style={{height:36,filter:'brightness(0) invert(1)',marginBottom:8}}/>
          <p style={{fontSize:10,letterSpacing:'0.2em',color:'rgba(255,255,255,0.3)',textTransform:'uppercase'}}>Admin Panel</p>
        </div>
        <nav style={{padding:'16px 12px',flex:1}}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:12,border:'none',background:tab===t.id?'rgba(183,104,121,0.2)':'transparent',color:tab===t.id?'#D4939F':'rgba(255,255,255,0.5)',fontFamily:'Jost,sans-serif',fontSize:13,letterSpacing:'0.08em',cursor:'pointer',marginBottom:4,textAlign:'left',transition:'all 0.2s'}}>
              <span style={{fontSize:16}}>{t.icon}</span>
              {t.label}
              {t.id==='orders' && pendingCount > 0 && <span style={{marginLeft:'auto',background:'#f59e0b',color:'#fff',borderRadius:40,padding:'2px 8px',fontSize:10}}>{pendingCount}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:'16px 12px',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          <a href="/" target="_blank" style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',color:'rgba(255,255,255,0.4)',fontSize:12,textDecoration:'none',borderRadius:10,transition:'all 0.2s'}}>
            🌐 View Store
          </a>
          <button onClick={()=>setAuthed(false)} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'10px 16px',color:'rgba(255,255,255,0.4)',fontSize:12,background:'none',border:'none',cursor:'pointer',borderRadius:10,fontFamily:'Jost,sans-serif',textAlign:'left'}}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{marginLeft:240,flex:1,padding:32}}>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:28}}>
              <div>
                <h1 style={{fontFamily:'Playfair Display,serif',fontSize:32,color:'#241208',marginBottom:4}}>Dashboard</h1>
                <p style={{fontSize:13,color:'#7A5C50'}}>Welcome back — The Alabanza Store</p>
              </div>
              <div style={{display:'flex',gap:8}}>
                {['today','week','month','all'].map(d => (
                  <button key={d} onClick={() => setDateFilter(d)} style={{background:dateFilter===d?'#B76879':'#fff',color:dateFilter===d?'#fff':'#7A5C50',border:'1.5px solid rgba(183,104,121,0.2)',padding:'8px 18px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',cursor:'pointer'}}>
                    {d==='all'?'All Time':d.charAt(0).toUpperCase()+d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* STATS */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:28}}>
              {[
                {icon:'💰',label:'Revenue',value:`Rs. ${Math.round(totalRevenue).toLocaleString()}`,color:'#22c55e',bg:'#f0fdf4'},
                {icon:'📦',label:'Orders',value:filteredByDate.length,color:'#3b82f6',bg:'#eff6ff'},
                {icon:'⏳',label:'Pending',value:pendingCount,color:'#f59e0b',bg:'#fffbeb'},
                {icon:'✅',label:'Delivered',value:deliveredCount,color:'#B76879',bg:'#fdf2f4'},
              ].map(s => (
                <div key={s.label} style={{background:'#fff',borderRadius:20,padding:24,border:'1px solid rgba(0,0,0,0.06)',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                  <div style={{width:44,height:44,background:s.bg,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,marginBottom:16}}>{s.icon}</div>
                  <p style={{fontSize:11,letterSpacing:'0.18em',textTransform:'uppercase',color:'#7A5C50',marginBottom:8}}>{s.label}</p>
                  <p style={{fontFamily:'Playfair Display,serif',fontSize:28,color:s.color}}>{s.value}</p>
                </div>
              ))}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:20,marginBottom:28}}>
              {/* REVENUE CHART */}
              <div style={{background:'#fff',borderRadius:20,padding:28,border:'1px solid rgba(0,0,0,0.06)'}}>
                <h3 style={{fontFamily:'Playfair Display,serif',fontSize:18,color:'#241208',marginBottom:20}}>Revenue — Last 7 Days</h3>
                <div style={{display:'flex',alignItems:'flex-end',gap:12,height:160}}>
                  {last7Days.map((d,i) => (
                    <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                      <span style={{fontSize:10,color:'#7A5C50'}}>Rs.{Math.round(d.revenue/1000)}k</span>
                      <div style={{width:'100%',background:d.revenue>0?'linear-gradient(to top,#B76879,#D4939F)':'#F3EEE7',borderRadius:'6px 6px 0 0',height:`${Math.max((d.revenue/maxRevenue)*120,4)}px`,transition:'height 0.5s'}}/>
                      <span style={{fontSize:10,color:'#7A5C50'}}>{d.day}</span>
                      <span style={{fontSize:10,color:'#B76879',fontWeight:500}}>{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* TOP CITIES */}
              <div style={{background:'#fff',borderRadius:20,padding:28,border:'1px solid rgba(0,0,0,0.06)'}}>
                <h3 style={{fontFamily:'Playfair Display,serif',fontSize:18,color:'#241208',marginBottom:20}}>Orders by City</h3>
                {topCities.length === 0 ? (
                  <p style={{color:'#7A5C50',fontSize:13}}>No data yet</p>
                ) : topCities.map(([city, count]) => (
                  <div key={city} style={{marginBottom:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:13,color:'#241208'}}>{city}</span>
                      <span style={{fontSize:13,color:'#B76879',fontWeight:500}}>{count}</span>
                    </div>
                    <div style={{background:'#F3EEE7',borderRadius:40,height:6,overflow:'hidden'}}>
                      <div style={{background:'linear-gradient(to right,#B76879,#D4939F)',height:'100%',width:`${(count/orders.length)*100}%`,borderRadius:40,transition:'width 0.5s'}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RECENT ORDERS */}
            <div style={{background:'#fff',borderRadius:20,padding:28,border:'1px solid rgba(0,0,0,0.06)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <h3 style={{fontFamily:'Playfair Display,serif',fontSize:18,color:'#241208'}}>Recent Orders</h3>
                <button onClick={() => setTab('orders')} style={{background:'#B76879',color:'#fff',border:'none',padding:'8px 20px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.12em',cursor:'pointer'}}>View All</button>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'2px solid #F3EEE7'}}>
                    {['Order #','Customer','City','Total','Status','Action'].map(h => (
                      <th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0,8).map(o => (
                    <tr key={o.id} style={{borderBottom:'1px solid #F3EEE7',cursor:'pointer'}} onClick={() => setSelectedOrder(o)}>
                      <td style={{padding:'12px',fontSize:13,color:'#B76879',fontWeight:500}}>{o.order_number}</td>
                      <td style={{padding:'12px',fontSize:13,color:'#241208'}}>{o.name}</td>
                      <td style={{padding:'12px',fontSize:13,color:'#7A5C50'}}>{o.city}</td>
                      <td style={{padding:'12px',fontFamily:'Playfair Display,serif',fontSize:14,color:'#B76879'}}>Rs. {Math.round(o.total||0).toLocaleString()}</td>
                      <td style={{padding:'12px'}}>
                        <span style={{background:(STATUS_COLORS[o.status]||'#gray')+'20',color:STATUS_COLORS[o.status]||'#888',padding:'4px 12px',borderRadius:40,fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase'}}>{o.status}</span>
                      </td>
                      <td style={{padding:'12px'}} onClick={e=>e.stopPropagation()}>
                        <select value={o.status} onChange={e=>updateStatus(o.id,e.target.value)} style={{background:'#FAF8F4',border:'1px solid rgba(183,104,121,0.2)',borderRadius:8,padding:'4px 8px',fontFamily:'Jost,sans-serif',fontSize:11,cursor:'pointer',outline:'none'}}>
                          {['pending','confirmed','shipped','delivered','cancelled'].map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ORDERS */}
        {tab === 'orders' && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <h1 style={{fontFamily:'Playfair Display,serif',fontSize:32,color:'#241208'}}>Orders</h1>
              <button onClick={fetchOrders} style={{background:'#B76879',color:'#fff',border:'none',padding:'10px 24px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.12em',cursor:'pointer'}}>🔄 Refresh</button>
            </div>
            <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap',alignItems:'center'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, order #, phone..." style={{background:'#fff',border:'1.5px solid rgba(183,104,121,0.18)',borderRadius:40,padding:'10px 20px',fontFamily:'Jost,sans-serif',fontSize:13,outline:'none',minWidth:280}}/>
              {['all','pending','confirmed','shipped','delivered','cancelled'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} style={{background:statusFilter===s?STATUS_COLORS[s]||'#B76879':'#fff',color:statusFilter===s?'#fff':STATUS_COLORS[s]||'#7A5C50',border:`1.5px solid ${STATUS_COLORS[s]||'rgba(183,104,121,0.2)'}`,padding:'8px 18px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',cursor:'pointer'}}>
                  {s==='all'?'All':s} {s!=='all'&&`(${orders.filter(o=>o.status===s).length})`}
                </button>
              ))}
            </div>
            <div style={{background:'#fff',borderRadius:20,border:'1px solid rgba(0,0,0,0.06)',overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#FAF8F4',borderBottom:'2px solid #F3EEE7'}}>
                    {['Order #','Customer','Phone','City','Items','Total','Status','Time','Action'].map(h => (
                      <th key={h} style={{textAlign:'left',padding:'14px 16px',fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(o => (
                    <tr key={o.id} style={{borderBottom:'1px solid #F3EEE7',cursor:'pointer'}} onClick={() => setSelectedOrder(o)} onMouseEnter={e=>(e.currentTarget.style.background='#FAF8F4')} onMouseLeave={e=>(e.currentTarget.style.background='#fff')}>
                      <td style={{padding:'14px 16px',fontSize:13,color:'#B76879',fontWeight:500}}>{o.order_number}</td>
                      <td style={{padding:'14px 16px',fontSize:13,color:'#241208'}}>{o.name}</td>
                      <td style={{padding:'14px 16px',fontSize:13,color:'#7A5C50'}}>{o.phone}</td>
                      <td style={{padding:'14px 16px',fontSize:13,color:'#7A5C50'}}>{o.city}</td>
                      <td style={{padding:'14px 16px',fontSize:12,color:'#7A5C50'}}>{Array.isArray(o.items)?o.items.length:0} items</td>
                      <td style={{padding:'14px 16px',fontFamily:'Playfair Display,serif',fontSize:14,color:'#B76879'}}>Rs. {Math.round(o.total||0).toLocaleString()}</td>
                      <td style={{padding:'14px 16px'}}>
                        <span style={{background:(STATUS_COLORS[o.status]||'#888')+'20',color:STATUS_COLORS[o.status]||'#888',padding:'4px 12px',borderRadius:40,fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase'}}>{o.status}</span>
                      </td>
                      <td style={{padding:'14px 16px',fontSize:11,color:'#7A5C50'}}>{new Date(o.created_at).toLocaleDateString('en-PK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                      <td style={{padding:'14px 16px'}} onClick={e=>e.stopPropagation()}>
                        <select value={o.status} onChange={e=>updateStatus(o.id,e.target.value)} style={{background:'#FAF8F4',border:'1px solid rgba(183,104,121,0.2)',borderRadius:8,padding:'6px 10px',fontFamily:'Jost,sans-serif',fontSize:11,cursor:'pointer',outline:'none'}}>
                          {['pending','confirmed','shipped','delivered','cancelled'].map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length === 0 && (
                <div style={{textAlign:'center',padding:60,color:'#7A5C50'}}>
                  <div style={{fontSize:48,marginBottom:16}}>📦</div>
                  <p style={{fontFamily:'Playfair Display,serif',fontSize:20}}>No orders found</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* PRODUCTS */}
        {tab === 'products' && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <h1 style={{fontFamily:'Playfair Display,serif',fontSize:32,color:'#241208'}}>Products</h1>
              <div style={{display:'flex',gap:12}}>
                <button onClick={fetchProducts} style={{background:'#fff',color:'#B76879',border:'1.5px solid #B76879',padding:'10px 24px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.12em',cursor:'pointer'}}>🔄 Refresh</button>
                <a href={`https://admin.shopify.com/store/thealabanza/products/new`} target="_blank" style={{background:'#B76879',color:'#fff',border:'none',padding:'10px 24px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.12em',cursor:'pointer',textDecoration:'none',display:'flex',alignItems:'center'}}>+ Add Product</a>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
              {products.map(p => (
                <div key={p.id} style={{background:'#fff',borderRadius:20,overflow:'hidden',border:'1px solid rgba(0,0,0,0.06)',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                  <div style={{aspectRatio:'1',background:'#F3EEE7',overflow:'hidden'}}>
                    {p.images.edges[0] && <img src={p.images.edges[0].node.url} alt={p.title} style={{width:'100%',height:'100%',objectFit:'contain',padding:16}}/>}
                  </div>
                  <div style={{padding:16}}>
                    <p style={{fontSize:9,letterSpacing:'0.2em',textTransform:'uppercase',color:'#B76879',marginBottom:4}}>{p.productType||'Jewelry'}</p>
                    <p style={{fontFamily:'Playfair Display,serif',fontSize:14,color:'#241208',marginBottom:8,lineHeight:1.3}}>{p.title}</p>
                    <p style={{fontFamily:'Playfair Display,serif',fontSize:16,color:'#B76879',marginBottom:12}}>Rs. {Math.round(parseFloat(p.priceRange.minVariantPrice.amount)).toLocaleString()}</p>
                    <a href={`https://admin.shopify.com/store/thealabanza/products/${p.id.split('/').pop()}`} target="_blank" style={{display:'block',background:'#FAF8F4',color:'#7A5C50',border:'1px solid rgba(183,104,121,0.2)',padding:'8px',borderRadius:10,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',textDecoration:'none',textAlign:'center',transition:'all 0.2s'}}>
                      Edit on Shopify →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PIXELS */}
        {tab === 'pixels' && (
          <>
            <h1 style={{fontFamily:'Playfair Display,serif',fontSize:32,color:'#241208',marginBottom:8}}>Pixel Management</h1>
            <p style={{fontSize:13,color:'#7A5C50',marginBottom:28}}>Track and verify your advertising pixels</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:28}}>
              {[
                {name:'Facebook Pixel',id:process.env.NEXT_PUBLIC_FB_PIXEL||'1762983321739181',color:'#1877f2',icon:'f',events:['PageView','ViewContent','AddToCart','Purchase'],link:'https://business.facebook.com/events_manager'},
                {name:'TikTok Pixel',id:process.env.NEXT_PUBLIC_TIKTOK_PIXEL||'D8O88KBC77U8UFHCLI80',color:'#000',icon:'T',events:['page','ViewContent','AddToCart','CompletePayment'],link:'https://ads.tiktok.com/i18n/events_manager'},
              ].map(px => (
                <div key={px.name} style={{background:'#fff',borderRadius:20,padding:28,border:'1px solid rgba(0,0,0,0.06)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
                    <div style={{width:48,height:48,background:px.color,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:20,fontWeight:'bold'}}>{px.icon}</div>
                    <div>
                      <h3 style={{fontFamily:'Playfair Display,serif',fontSize:18,color:'#241208'}}>{px.name}</h3>
                      <p style={{fontSize:11,color:'#7A5C50',fontFamily:'monospace'}}>{px.id}</p>
                    </div>
                    <div style={{marginLeft:'auto',background:'#f0fdf4',color:'#22c55e',padding:'6px 14px',borderRadius:40,fontSize:11,letterSpacing:'0.1em'}}>✓ Active</div>
                  </div>
                  <p style={{fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',color:'#7A5C50',marginBottom:12}}>Tracking Events</p>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
                    {px.events.map(e => (
                      <span key={e} style={{background:'#F3EEE7',color:'#B76879',padding:'4px 12px',borderRadius:40,fontSize:11}}>{e}</span>
                    ))}
                  </div>
                  <a href={px.link} target="_blank" style={{display:'block',background:'#FAF8F4',color:'#241208',border:'1px solid rgba(183,104,121,0.2)',padding:'10px',borderRadius:12,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',textDecoration:'none',textAlign:'center'}}>
                    Open Events Manager →
                  </a>
                </div>
              ))}
            </div>
            <div style={{background:'#fff',borderRadius:20,padding:28,border:'1px solid rgba(0,0,0,0.06)'}}>
              <h3 style={{fontFamily:'Playfair Display,serif',fontSize:20,color:'#241208',marginBottom:16}}>Event Tracking Status</h3>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'2px solid #F3EEE7'}}>
                    {['Event','Trigger','Facebook','TikTok'].map(h => (
                      <th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {event:'PageView',trigger:'Every page visit',fb:'✅',tt:'✅'},
                    {event:'ViewContent',trigger:'Product page open',fb:'✅',tt:'✅'},
                    {event:'AddToCart',trigger:'Add to cart button',fb:'✅',tt:'✅'},
                    {event:'Purchase',trigger:'COD form submit',fb:'✅',tt:'✅'},
                  ].map(r => (
                    <tr key={r.event} style={{borderBottom:'1px solid #F3EEE7'}}>
                      <td style={{padding:'12px',fontFamily:'monospace',fontSize:13,color:'#241208'}}>{r.event}</td>
                      <td style={{padding:'12px',fontSize:13,color:'#7A5C50'}}>{r.trigger}</td>
                      <td style={{padding:'12px',fontSize:16}}>{r.fb}</td>
                      <td style={{padding:'12px',fontSize:16}}>{r.tt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* SETTINGS */}
        {tab === 'settings' && (
          <>
            <h1 style={{fontFamily:'Playfair Display,serif',fontSize:32,color:'#241208',marginBottom:28}}>Settings</h1>
            <div style={{display:'grid',gap:20}}>
              {[
                {title:'Store Info',items:[{label:'Store Name',value:'The Alabanza'},{label:'WhatsApp',value:'923172571079'},{label:'Email',value:'thealabanzaofficial@gmail.com'}]},
                {title:'Pixels',items:[{label:'Facebook Pixel ID',value:'1762983321739181'},{label:'TikTok Pixel ID',value:'D8O88KBC77U8UFHCLI80'}]},
                {title:'Shopify',items:[{label:'Store',value:'thealabanza.myshopify.com'},{label:'API Token',value:'5cdca5f12d...'}]},
              ].map(s => (
                <div key={s.title} style={{background:'#fff',borderRadius:20,padding:28,border:'1px solid rgba(0,0,0,0.06)'}}>
                  <h3 style={{fontFamily:'Playfair Display,serif',fontSize:18,color:'#241208',marginBottom:16}}>{s.title}</h3>
                  {s.items.map(i => (
                    <div key={i.label} style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid #F3EEE7'}}>
                      <span style={{fontSize:13,color:'#7A5C50'}}>{i.label}</span>
                      <span style={{fontSize:13,color:'#241208',fontFamily:'monospace'}}>{i.value}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{background:'#fff',borderRadius:20,padding:28,border:'1px solid rgba(0,0,0,0.06)'}}>
                <h3 style={{fontFamily:'Playfair Display,serif',fontSize:18,color:'#241208',marginBottom:16}}>Quick Links</h3>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[
                    {label:'Shopify Admin',url:'https://admin.shopify.com/store/thealabanza'},
                    {label:'Supabase Dashboard',url:'https://supabase.com/dashboard/project/qfqoxiyucdejsunsphey'},
                    {label:'Facebook Events Manager',url:'https://business.facebook.com/events_manager'},
                    {label:'TikTok Events Manager',url:'https://ads.tiktok.com/i18n/events_manager'},
                    {label:'Netlify Dashboard',url:'https://app.netlify.com'},
                    {label:'Vercel Dashboard',url:'https://vercel.com/dashboard'},
                  ].map(l => (
                    <a key={l.label} href={l.url} target="_blank" style={{display:'block',background:'#FAF8F4',color:'#241208',border:'1px solid rgba(183,104,121,0.15)',padding:'14px 18px',borderRadius:14,fontFamily:'Jost,sans-serif',fontSize:12,letterSpacing:'0.08em',textDecoration:'none',transition:'all 0.2s'}}>
                      {l.label} →
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <>
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200}} onClick={() => setSelectedOrder(null)}/>
          <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',borderRadius:28,padding:44,width:'90vw',maxWidth:640,maxHeight:'90vh',overflowY:'auto',zIndex:201,boxShadow:'0 60px 120px rgba(0,0,0,0.4)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:28}}>
              <div>
                <h3 style={{fontFamily:'Playfair Display,serif',fontSize:24,color:'#241208'}}>{selectedOrder.order_number}</h3>
                <p style={{fontSize:12,color:'#7A5C50'}}>{new Date(selectedOrder.created_at).toLocaleDateString('en-PK',{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{background:'#FAF8F4',border:'none',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',color:'#7A5C50',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
              {[
                {l:'Customer',v:selectedOrder.name},
                {l:'Phone',v:selectedOrder.phone},
                {l:'City',v:selectedOrder.city},
                {l:'Email',v:selectedOrder.email||'—'},
              ].map(i => (
                <div key={i.l} style={{background:'#FAF8F4',borderRadius:14,padding:16}}>
                  <p style={{fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50',marginBottom:4}}>{i.l}</p>
                  <p style={{fontSize:14,color:'#241208'}}>{i.v}</p>
                </div>
              ))}
            </div>
            <div style={{background:'#FAF8F4',borderRadius:14,padding:16,marginBottom:20}}>
              <p style={{fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50',marginBottom:4}}>Address</p>
              <p style={{fontSize:14,color:'#241208'}}>{selectedOrder.address}</p>
            </div>
            {selectedOrder.notes && (
              <div style={{background:'#fffbeb',borderRadius:14,padding:16,marginBottom:20,border:'1px solid #fde68a'}}>
                <p style={{fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#92400e',marginBottom:4}}>Notes</p>
                <p style={{fontSize:13,color:'#78350f'}}>{selectedOrder.notes}</p>
              </div>
            )}
            <div style={{marginBottom:24}}>
              <p style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50',marginBottom:12}}>Items Ordered</p>
              {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #F3EEE7'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    {item.image && <img src={item.image} alt={item.title} style={{width:44,height:44,objectFit:'contain',background:'#F3EEE7',borderRadius:8,padding:4}}/>}
                    <div>
                      <p style={{fontSize:13,color:'#241208'}}>{item.title}</p>
                      <p style={{fontSize:11,color:'#7A5C50'}}>Qty: {item.qty}</p>
                    </div>
                  </div>
                  <span style={{fontFamily:'Playfair Display,serif',fontSize:15,color:'#B76879'}}>Rs. {Math.round(parseFloat(item.price||0)*item.qty).toLocaleString()}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',padding:'16px 0',borderBottom:'1px solid #F3EEE7'}}>
                <span style={{fontSize:13,color:'#7A5C50'}}>Delivery</span>
                <span style={{fontSize:13,color:selectedOrder.delivery===0?'#22c55e':'#241208'}}>{selectedOrder.delivery===0?'FREE':'Rs. '+selectedOrder.delivery}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'16px 0'}}>
                <span style={{fontFamily:'Playfair Display,serif',fontSize:18,color:'#241208'}}>Total</span>
                <span style={{fontFamily:'Playfair Display,serif',fontSize:20,color:'#B76879'}}>Rs. {Math.round(selectedOrder.total||0).toLocaleString()}</span>
              </div>
            </div>
            <div>
              <p style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50',marginBottom:12}}>Update Status</p>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
                {['pending','confirmed','shipped','delivered','cancelled'].map(s => (
                  <button key={s} onClick={() => updateStatus(selectedOrder.id, s)} style={{background:selectedOrder.status===s?STATUS_COLORS[s]:'#FAF8F4',color:selectedOrder.status===s?'#fff':STATUS_COLORS[s],border:`1.5px solid ${STATUS_COLORS[s]}`,padding:'8px 18px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',cursor:'pointer',transition:'all 0.2s'}}>
                    {s}
                  </button>
                ))}
              </div>
              <a href={`https://wa.me/${selectedOrder.phone}?text=Assalam%20o%20Alaikum%20${selectedOrder.name}!%20Aapka%20order%20${selectedOrder.order_number}%20confirm%20ho%20gaya%20hai.%20The%20Alabanza`} target="_blank" style={{display:'block',background:'#25D366',color:'#fff',border:'none',padding:'14px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:12,letterSpacing:'0.12em',textTransform:'uppercase',textDecoration:'none',textAlign:'center'}}>
                💬 WhatsApp Customer
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}