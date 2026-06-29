'use client';
import { useState, useEffect } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

export default function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'dashboard'|'orders'>('dashboard');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order|null>(null);

  async function login() {
    if(email === 'thealabanzaofficial@gmail.com' && password === 'Alabanza@2026') {
      setAuthed(true);
      fetchOrders();
    } else {
      alert('Wrong email or password!');
    }
  }

  async function fetchOrders() {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const data = await res.json();
      setOrders(data);
    } catch(e) { console.log(e); }
    setLoading(false);
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchOrders();
    if(selectedOrder?.id === id) setSelectedOrder({...selectedOrder, status});
  }

  const filteredOrders = orders.filter(o => {
    const matchSearch = o.name?.toLowerCase().includes(search.toLowerCase()) || 
                       o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
                       o.phone?.includes(search);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = orders.reduce((s,o) => s + (o.total||0), 0);
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const pendingOrders = orders.filter(o => o.status === 'pending');

  const statusColors: Record<string,string> = {
    pending: '#f59e0b',
    confirmed: '#3b82f6',
    shipped: '#8b5cf6',
    delivered: '#22c55e',
    cancelled: '#ef4444'
  };

  if(!authed) return (
    <div style={{minHeight:'100vh',background:'#1C1009',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'#fff',borderRadius:24,padding:48,width:400,boxShadow:'0 40px 100px rgba(0,0,0,0.4)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <img src="https://www.thealabanza.com/cdn/shop/files/ALABANZA_Logo_2ed50e44-3f22-4238-bf4d-073a2189b824.png?height=120&v=1781839650" alt="The Alabanza" style={{height:48,marginBottom:16}}/>
          <h1 style={{fontFamily:'Playfair Display,serif',fontSize:24,color:'#241208',marginBottom:8}}>Admin Panel</h1>
          <p style={{fontSize:13,color:'#7A5C50'}}>The Alabanza Dashboard</p>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',color:'#7A5C50',display:'block',marginBottom:6}}>Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@thealabanza.com" style={{width:'100%',background:'#FAF8F4',border:'1.5px solid rgba(183,104,121,0.18)',borderRadius:12,padding:'12px 16px',fontFamily:'Jost,sans-serif',fontSize:14,outline:'none',boxSizing:'border-box'}}/>
        </div>
        <div style={{marginBottom:24}}>
          <label style={{fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',color:'#7A5C50',display:'block',marginBottom:6}}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••" style={{width:'100%',background:'#FAF8F4',border:'1.5px solid rgba(183,104,121,0.18)',borderRadius:12,padding:'12px 16px',fontFamily:'Jost,sans-serif',fontSize:14,outline:'none',boxSizing:'border-box'}}/>
        </div>
        <button onClick={login} style={{width:'100%',background:'#B76879',color:'#fff',border:'none',padding:16,borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:12,letterSpacing:'0.16em',textTransform:'uppercase',cursor:'pointer'}}>Login to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#FAF8F4',fontFamily:'Jost,sans-serif'}}>
      {/* HEADER */}
      <div style={{background:'#1C1009',padding:'16px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <img src="https://www.thealabanza.com/cdn/shop/files/ALABANZA_Logo_2ed50e44-3f22-4238-bf4d-073a2189b824.png?height=120&v=1781839650" alt="The Alabanza" style={{height:32,filter:'brightness(0) invert(1)'}}/>
          <span style={{color:'rgba(255,255,255,0.4)',fontSize:12,letterSpacing:'0.2em',textTransform:'uppercase'}}>Admin Panel</span>
        </div>
        <div style={{display:'flex',gap:8}}>
          {(['dashboard','orders'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{background:tab===t?'#B76879':'transparent',color:tab===t?'#fff':'rgba(255,255,255,0.5)',border:'1px solid rgba(255,255,255,0.1)',padding:'8px 20px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.12em',textTransform:'uppercase',cursor:'pointer'}}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
          <button onClick={()=>setAuthed(false)} style={{background:'transparent',color:'rgba(255,255,255,0.4)',border:'1px solid rgba(255,255,255,0.1)',padding:'8px 16px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,cursor:'pointer'}}>Logout</button>
        </div>
      </div>

      <div style={{padding:32}}>
        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <>
            <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#241208',marginBottom:24}}>Dashboard</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:32}}>
              {[
                {label:'Total Orders',value:orders.length,color:'#B76879',icon:'📦'},
                {label:'Today Orders',value:todayOrders.length,color:'#3b82f6',icon:'🛍'},
                {label:'Pending',value:pendingOrders.length,color:'#f59e0b',icon:'⏳'},
                {label:'Total Revenue',value:`Rs. ${Math.round(totalRevenue).toLocaleString()}`,color:'#22c55e',icon:'💰'},
              ].map(s => (
                <div key={s.label} style={{background:'#fff',borderRadius:20,padding:28,border:'1px solid rgba(183,104,121,0.1)',boxShadow:'0 4px 16px rgba(183,104,121,0.06)'}}>
                  <div style={{fontSize:32,marginBottom:12}}>{s.icon}</div>
                  <p style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50',marginBottom:8}}>{s.label}</p>
                  <p style={{fontFamily:'Playfair Display,serif',fontSize:28,color:s.color,fontWeight:400}}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* RECENT ORDERS */}
            <div style={{background:'#fff',borderRadius:20,padding:28,border:'1px solid rgba(183,104,121,0.1)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <h3 style={{fontFamily:'Playfair Display,serif',fontSize:20,color:'#241208'}}>Recent Orders</h3>
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
                  {orders.slice(0,5).map(o => (
                    <tr key={o.id} style={{borderBottom:'1px solid #F3EEE7',cursor:'pointer'}} onClick={() => setSelectedOrder(o)}>
                      <td style={{padding:'12px',fontSize:13,color:'#B76879',fontWeight:500}}>{o.order_number}</td>
                      <td style={{padding:'12px',fontSize:13,color:'#241208'}}>{o.name}</td>
                      <td style={{padding:'12px',fontSize:13,color:'#7A5C50'}}>{o.city}</td>
                      <td style={{padding:'12px',fontSize:13,fontFamily:'Playfair Display,serif',color:'#B76879'}}>Rs. {Math.round(o.total).toLocaleString()}</td>
                      <td style={{padding:'12px'}}>
                        <span style={{background:statusColors[o.status]+'20',color:statusColors[o.status],padding:'4px 12px',borderRadius:40,fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase'}}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{padding:'12px'}}>
                        <select value={o.status} onChange={e=>{e.stopPropagation();updateStatus(o.id,e.target.value)}} style={{background:'#FAF8F4',border:'1px solid rgba(183,104,121,0.2)',borderRadius:8,padding:'4px 8px',fontFamily:'Jost,sans-serif',fontSize:11,cursor:'pointer'}}>
                          {['pending','confirmed','shipped','delivered','cancelled'].map(s => <option key={s}>{s}</option>)}
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
              <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#241208'}}>Orders</h2>
              <button onClick={fetchOrders} style={{background:'#B76879',color:'#fff',border:'none',padding:'10px 24px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.12em',cursor:'pointer'}}>🔄 Refresh</button>
            </div>

            {/* FILTERS */}
            <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap',alignItems:'center'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, order #, phone..." style={{background:'#fff',border:'1.5px solid rgba(183,104,121,0.18)',borderRadius:40,padding:'10px 20px',fontFamily:'Jost,sans-serif',fontSize:13,outline:'none',minWidth:280}}/>
              {['all','pending','confirmed','shipped','delivered','cancelled'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} style={{background:statusFilter===s?'#B76879':'#fff',color:statusFilter===s?'#fff':'#7A5C50',border:'1.5px solid rgba(183,104,121,0.2)',padding:'8px 18px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',cursor:'pointer'}}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{textAlign:'center',padding:60,color:'#7A5C50'}}>Loading orders...</div>
            ) : (
              <div style={{background:'#fff',borderRadius:20,border:'1px solid rgba(183,104,121,0.1)',overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#FAF8F4',borderBottom:'2px solid #F3EEE7'}}>
                      {['Order #','Customer','Phone','City','Items','Total','Status','Action'].map(h => (
                        <th key={h} style={{textAlign:'left',padding:'14px 16px',fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(o => (
                      <tr key={o.id} style={{borderBottom:'1px solid #F3EEE7',cursor:'pointer',transition:'background 0.2s'}} onClick={() => setSelectedOrder(o)} onMouseEnter={e=>(e.currentTarget.style.background='#FAF8F4')} onMouseLeave={e=>(e.currentTarget.style.background='#fff')}>
                        <td style={{padding:'14px 16px',fontSize:13,color:'#B76879',fontWeight:500}}>{o.order_number}</td>
                        <td style={{padding:'14px 16px',fontSize:13,color:'#241208'}}>{o.name}</td>
                        <td style={{padding:'14px 16px',fontSize:13,color:'#7A5C50'}}>{o.phone}</td>
                        <td style={{padding:'14px 16px',fontSize:13,color:'#7A5C50'}}>{o.city}</td>
                        <td style={{padding:'14px 16px',fontSize:12,color:'#7A5C50'}}>{Array.isArray(o.items) ? o.items.length : 0} items</td>
                        <td style={{padding:'14px 16px',fontFamily:'Playfair Display,serif',fontSize:14,color:'#B76879'}}>Rs. {Math.round(o.total).toLocaleString()}</td>
                        <td style={{padding:'14px 16px'}}>
                          <span style={{background:(statusColors[o.status]||'#gray')+'20',color:statusColors[o.status]||'#gray',padding:'4px 12px',borderRadius:40,fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase'}}>
                            {o.status}
                          </span>
                        </td>
                        <td style={{padding:'14px 16px'}} onClick={e=>e.stopPropagation()}>
                          <select value={o.status} onChange={e=>updateStatus(o.id,e.target.value)} style={{background:'#FAF8F4',border:'1px solid rgba(183,104,121,0.2)',borderRadius:8,padding:'6px 10px',fontFamily:'Jost,sans-serif',fontSize:11,cursor:'pointer',outline:'none'}}>
                            {['pending','confirmed','shipped','delivered','cancelled'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredOrders.length === 0 && (
                  <div style={{textAlign:'center',padding:60,color:'#7A5C50'}}>
                    <div style={{fontSize:48,marginBottom:16}}>📦</div>
                    <p style={{fontFamily:'Playfair Display,serif',fontSize:20}}>No orders yet</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <>
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:100}} onClick={() => setSelectedOrder(null)}/>
          <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#fff',borderRadius:24,padding:40,width:'90vw',maxWidth:600,maxHeight:'90vh',overflowY:'auto',zIndex:101,boxShadow:'0 40px 100px rgba(0,0,0,0.3)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <h3 style={{fontFamily:'Playfair Display,serif',fontSize:22,color:'#241208'}}>Order {selectedOrder.order_number}</h3>
              <button onClick={() => setSelectedOrder(null)} style={{background:'none',border:'none',fontSize:28,cursor:'pointer',color:'#7A5C50'}}>×</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
              {[
                {l:'Customer',v:selectedOrder.name},
                {l:'Phone',v:selectedOrder.phone},
                {l:'City',v:selectedOrder.city},
                {l:'Date',v:new Date(selectedOrder.created_at).toLocaleDateString('en-PK')},
              ].map(i => (
                <div key={i.l} style={{background:'#FAF8F4',borderRadius:12,padding:16}}>
                  <p style={{fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50',marginBottom:4}}>{i.l}</p>
                  <p style={{fontSize:14,color:'#241208'}}>{i.v}</p>
                </div>
              ))}
            </div>
            <div style={{background:'#FAF8F4',borderRadius:12,padding:16,marginBottom:16}}>
              <p style={{fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50',marginBottom:4}}>Address</p>
              <p style={{fontSize:14,color:'#241208'}}>{selectedOrder.address}</p>
            </div>
            <div style={{marginBottom:24}}>
              <p style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50',marginBottom:12}}>Items</p>
              {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #F3EEE7',fontSize:14}}>
                  <span style={{color:'#241208'}}>{item.title} × {item.qty}</span>
                  <span style={{color:'#B76879',fontFamily:'Playfair Display,serif'}}>Rs. {Math.round(parseFloat(item.price)*item.qty).toLocaleString()}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',padding:'16px 0',fontSize:18,fontFamily:'Playfair Display,serif'}}>
                <span style={{color:'#241208'}}>Total</span>
                <span style={{color:'#B76879'}}>Rs. {Math.round(selectedOrder.total).toLocaleString()}</span>
              </div>
            </div>
            <div>
              <p style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7A5C50',marginBottom:12}}>Update Status</p>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {['pending','confirmed','shipped','delivered','cancelled'].map(s => (
                  <button key={s} onClick={() => updateStatus(selectedOrder.id, s)} style={{background:selectedOrder.status===s?statusColors[s]:'#FAF8F4',color:selectedOrder.status===s?'#fff':statusColors[s],border:`1.5px solid ${statusColors[s]}`,padding:'8px 18px',borderRadius:40,fontFamily:'Jost,sans-serif',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase',cursor:'pointer'}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}