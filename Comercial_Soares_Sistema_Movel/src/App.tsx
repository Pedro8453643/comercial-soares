import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Archive, Check, ChevronRight, CircleHelp, ClipboardList, FileDown,
  LogOut, Menu, Plus, Search, ShieldCheck, ShoppingBag, Trash2, X
} from 'lucide-react';
import { isSupabaseConfigured, supabase, OrderItem, OrderRecord } from './lib/supabase';

type View = 'novo' | 'pedidos';

const money = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL'
});

function parsePrice(value: string) {
  const normalized = value.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!normalized) return Number.NaN;
  const parsed = Number(normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [view, setView] = useState<View>('novo');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [client, setClient] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [search, setSearch] = useState('');
  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.price, 0), [items]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) void loadOrders();
  }, [session?.user?.id]);

  async function loadOrders() {
    if (!supabase || !session?.user?.id) return;
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) setNotice('Não foi possível carregar os pedidos: ' + error.message);
    else setOrders((data || []) as OrderRecord[]);
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setLoginError('');
    if (!supabase) {
      setLoginError('A conexão com o banco ainda não foi configurada. Siga o README para configurar o Supabase.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('Não foi possível entrar. Confira o e-mail e a senha.');
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setOrders([]);
  }

  function addItem(event: FormEvent) {
    event.preventDefault();
    const name = productName.trim();
    const qty = Number(quantity);
    const unitPrice = parsePrice(price);
    if (!name || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !price.trim()) {
      setNotice('Informe produto, quantidade e preço válidos.');
      return;
    }
    setItems(prev => [...prev, { id: crypto.randomUUID(), name, quantity: qty, price: unitPrice }]);
    setProductName(''); setQuantity('1'); setPrice(''); setNotice('');
  }

  function parseBulk() {
    // Mantém o motor antigo: quantidade, nome e token vPREÇO, com vários itens em sequência.
    const tokens = importText.trim().split(/\s+/).filter(Boolean);
    const parsed: OrderItem[] = [];
    let errors = 0;
    let i = 0;

    while (i < tokens.length) {
      const qtyToken = tokens[i];
      if (!/^\d+(?:[.,]\d+)?$/.test(qtyToken)) { errors++; i++; continue; }
      const qty = Number(qtyToken.replace(',', '.'));
      if (!Number.isFinite(qty) || qty <= 0) { errors++; i++; continue; }

      let priceIndex = -1;
      let unitPrice = Number.NaN;
      for (let j = i + 1; j < tokens.length; j++) {
        const marker = tokens[j].match(/^v([\d.,]+)$/i);
        if (!marker) continue;
        const candidate = parsePrice(marker[1]);
        if (Number.isFinite(candidate) && candidate >= 0) {
          priceIndex = j;
          unitPrice = candidate;
          break;
        }
      }

      if (priceIndex < 0) { errors++; break; }
      const name = tokens.slice(i + 1, priceIndex).join(' ').trim();
      if (!name) { errors++; i = priceIndex + 1; continue; }
      parsed.push({ id: crypto.randomUUID(), name, quantity: qty, price: unitPrice });
      i = priceIndex + 1;
    }

    if (!parsed.length) {
      setNotice('Não foi possível reconhecer a lista. Confira a quantidade, o nome do produto e o preço iniciado por “v”.');
      return;
    }
    setItems(prev => [...prev, ...parsed]);
    setImportText(''); setImportOpen(false);
    setNotice(`${parsed.length} produto(s) importado(s).${errors ? ` ${errors} trecho(s) não reconhecido(s); confira a lista.` : ''}`);
  }

  async function saveOrder(finalize: boolean) {
    if (!client.trim()) { setNotice('Informe o nome do cliente.'); return; }
    if (!items.length) { setNotice('Adicione pelo menos um produto.'); return; }
    if (!supabase || !session?.user?.id) {
      setNotice('O sistema ainda não está conectado ao banco de dados online.');
      return;
    }
    setSaving(true); setNotice('');
    const now = new Date().toISOString();
    const record = {
      user_id: session.user.id,
      client: client.trim(),
      items,
      total,
      status: (finalize ? 'finalizado' : 'aberto') as 'finalizado' | 'aberto',
      updated_at: now
    };
    const result = editingOrderId
      ? await supabase.from('orders').update(record).eq('id', editingOrderId).select().single()
      : await supabase.from('orders').insert(record).select().single();
    setSaving(false);
    if (result.error) { setNotice('Erro ao salvar o pedido. Verifique sua conexão e tente novamente.'); return; }
    const saved = result.data as OrderRecord;
    setOrders(prev => editingOrderId
      ? prev.map(order => order.id === saved.id ? saved : order)
      : [saved, ...prev]);
    setClient(''); setItems([]); setEditingOrderId(null); setView('pedidos');
    setNotice(finalize ? 'Pedido finalizado e salvo!' : 'Pedido salvo!');
  }

  function reopenOrder(order: OrderRecord) {
    if ((items.length || client.trim()) && !window.confirm('Substituir o formulário atual pelo pedido selecionado?')) return;
    setEditingOrderId(order.id);
    setClient(order.client);
    setItems(order.items.map(item => ({ ...item })));
    setOrders(prev => prev.map(item => item.id === order.id ? { ...item, status: 'aberto' } : item));
    if (supabase) void supabase.from('orders').update({ status: 'aberto', updated_at: new Date().toISOString() }).eq('id', order.id);
    setView('novo');
    setNotice('Pedido reaberto. Edite os itens e salve para atualizar o mesmo pedido.');
  }

  async function deleteOrder(id: string) {
    if (!supabase || !window.confirm('Deseja excluir este pedido? Esta ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) setNotice('Não foi possível excluir o pedido.');
    else { setOrders(prev => prev.filter(order => order.id !== id)); setNotice('Pedido excluído.'); }
  }

  function printOrder(order: OrderRecord) {
    const rows = order.items.map(item =>
      `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money(item.price)}</td><td>${money(item.quantity * item.price)}</td></tr>`
    ).join('');
    const popup = window.open('', '_blank', 'width=850,height=900');
    if (!popup) { setNotice('Permita pop-ups para imprimir o pedido.'); return; }
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido Comercial Soares</title>
    <style>body{font:14px Arial,sans-serif;padding:32px;color:#17283b}h1{margin-bottom:4px;color:#153754}small{color:#667789}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:12px;text-align:left;border-bottom:1px solid #dce3ea}th{background:#edf3f8}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:24px}@media print{button{display:none}}</style>
    </head><body><h1>COMERCIAL SOARES</h1><small>Pedido de venda</small><hr><p><b>Cliente:</b> ${escapeHtml(order.client)}<br><b>Data:</b> ${new Date(order.created_at).toLocaleString('pt-BR')}<br><b>Status:</b> ${order.status}</p>
    <table><thead><tr><th>Produto</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="total">Total: ${money(order.total)}</div><p><button onclick="window.print()">Imprimir / Salvar em PDF</button></p></body></html>`);
    popup.document.close();
  }

  function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] || ch));
  }

  const filteredOrders = orders.filter(order =>
    order.client.toLowerCase().includes(search.toLowerCase()) ||
    order.status.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading-screen">Carregando sistema…</div>;

  if (!session) return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark"><ShoppingBag size={26} /></div>
        <p className="eyebrow">GESTÃO COMERCIAL</p>
        <h1>Comercial Soares</h1>
        <p className="muted">Entre para gerenciar seus pedidos de qualquer dispositivo.</p>
        <form onSubmit={signIn} className="login-form">
          <label>E-mail<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" /></label>
          <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Sua senha" /></label>
          {loginError && <div className="error-message">{loginError}</div>}
          <button className="primary-button full-width" type="submit">Entrar <ChevronRight size={17} /></button>
        </form>
        <div className="secure-note"><ShieldCheck size={16} /> Acesso protegido por autenticação</div>
        {!isSupabaseConfigured && <p className="setup-hint">Configuração inicial necessária: conecte o banco online seguindo o arquivo README.</p>}
      </section>
      <footer className="login-footer">COMERCIAL SOARES · SISTEMA DE PEDIDOS</footer>
    </main>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark small"><ShoppingBag size={20} /></div><div><strong>COMERCIAL</strong><span>SOARES</span></div></div>
        <div className="nav-label">MENU PRINCIPAL</div>
        <button className={`nav-item ${view === 'novo' ? 'active' : ''}`} onClick={() => setView('novo')}><Plus size={18} /> Novo pedido</button>
        <button className={`nav-item ${view === 'pedidos' ? 'active' : ''}`} onClick={() => setView('pedidos')}><ClipboardList size={18} /> Pedidos</button>
        <div className="sidebar-bottom"><div className="user-pill"><div className="avatar">CS</div><div className="user-info"><strong>Administrador</strong><span>Conta principal</span></div></div><button className="nav-item logout" onClick={signOut}><LogOut size={17} /> Sair</button></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="mobile-brand"><Menu size={20} /><strong>COMERCIAL SOARES</strong></div><div className="topbar-right"><span className="online-dot"></span><span>Sistema online</span><div className="avatar">CS</div></div></header>
        <div className="page-content">
          <div className="welcome-row"><div><p className="eyebrow">PAINEL DE CONTROLE</p><h1>{view === 'novo' ? 'Criar novo pedido' : 'Pedidos registrados'}</h1><p className="muted">{view === 'novo' ? 'Registre os itens e confira o total antes de salvar.' : 'Consulte, reabra, imprima ou exclua pedidos salvos.'}</p></div><div className="date-chip">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</div></div>
          {notice && <div className="notice"><CircleHelp size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={16} /></button></div>}
          {view === 'novo' ? (
            <div className="order-layout">
              <section className="panel order-panel">
                <div className="panel-heading"><div className="step-number">01</div><div><h2>Informações do pedido</h2><p>Informe o cliente e os produtos.</p></div></div>
                <label className="field-label">Nome do cliente<input value={client} onChange={e => setClient(e.target.value)} placeholder="Digite o nome do cliente" /></label>
                <div className="section-divider"></div>
                <div className="panel-heading product-heading"><div className="step-number">02</div><div><h2>Produtos do pedido</h2><p>Adicione um item por vez ou importe uma lista.</p></div><button className="subtle-button" onClick={() => setImportOpen(!importOpen)}><Archive size={16} /> Importar lista</button></div>
                {importOpen && <div className="import-box"><label className="field-label">Importação rápida<textarea rows={4} aria-label="Lista de produtos para importação" value={importText} onChange={e => setImportText(e.target.value)} placeholder="Cole sua lista de produtos aqui…" /></label><div className="import-help">Importação de produtos no formato habitual da empresa.</div><button className="primary-button compact" onClick={parseBulk}>Adicionar produtos</button></div>}
                <form className="product-form" onSubmit={addItem}>
                  <label className="field-label product-name">Produto<input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Nome do produto" /></label>
                  <label className="field-label quantity-field">Qtd.<input type="number" min="0.01" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
                  <label className="field-label price-field">Preço unitário<input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" /></label>
                  <button className="primary-button add-button" type="submit"><Plus size={17} /> Adicionar</button>
                </form>
                <div className="items-table-wrap">
                  {items.length ? <table className="items-table"><thead><tr><th>Produto</th><th>Qtd.</th><th>Preço</th><th>Subtotal</th><th></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.price)}</td><td>{money(item.quantity * item.price)}</td><td><button className="icon-button danger" onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} aria-label="Remover item"><Trash2 size={16} /></button></td></tr>)}</tbody></table> : <div className="empty-items"><div className="empty-icon"><ShoppingBag size={23} /></div><strong>Nenhum produto adicionado</strong><span>Os itens do pedido aparecerão aqui.</span></div>}
                </div>
                <div className="section-divider"></div>
                <div className="order-actions"><button className="outline-button" onClick={() => { if ((items.length || client.trim()) && !window.confirm('Limpar o pedido atual?')) return; setClient(''); setItems([]); setEditingOrderId(null); setNotice('Formulário limpo.'); }}>Limpar formulário</button><div><button className="outline-button" disabled={saving} onClick={() => void saveOrder(false)}>{editingOrderId ? 'Salvar alterações' : 'Salvar pedido'}</button><button className="primary-button" disabled={saving} onClick={() => void saveOrder(true)}><Check size={17} /> {saving ? 'Salvando…' : editingOrderId ? 'Finalizar alterações' : 'Finalizar pedido'}</button></div></div>
              </section>
              <aside className="summary-panel"><div className="summary-top"><span>RESUMO DO PEDIDO</span><ShoppingBag size={19} /></div><div className="summary-count">{items.length}<span> {items.length === 1 ? 'produto' : 'produtos'}</span></div><div className="summary-line"><span>Cliente</span><strong>{client.trim() || 'Não informado'}</strong></div><div className="summary-line"><span>Quantidade de itens</span><strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong></div><div className="summary-total"><span>Valor total</span><strong>{money(total)}</strong></div><div className="summary-foot"><ShieldCheck size={16} /><span>Confira os valores antes de finalizar.</span></div></aside>
            </div>
          ) : (
            <section className="panel orders-panel"><div className="orders-toolbar"><div><h2>Histórico de pedidos</h2><p>{orders.length} pedido(s) registrado(s)</p></div><div className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente ou status" /></div></div>
              {filteredOrders.length ? <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>Cliente</th><th>Data</th><th>Produtos</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filteredOrders.map(order => <tr key={order.id}><td><strong>{order.client}</strong></td><td>{new Date(order.created_at).toLocaleDateString('pt-BR')}</td><td>{order.items.length} item(ns)</td><td><strong>{money(order.total)}</strong></td><td><span className={`status-badge ${order.status}`}>{order.status === 'finalizado' ? 'Finalizado' : 'Aberto'}</span></td><td><div className="row-actions"><button className="outline-button compact" onClick={() => reopenOrder(order)}><Archive size={15} /> Reabrir</button><button className="outline-button compact" onClick={() => printOrder(order)}><FileDown size={15} /> PDF / Imprimir</button><button className="icon-button danger" onClick={() => void deleteOrder(order.id)} aria-label="Excluir pedido"><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div> : <div className="empty-orders"><div className="empty-icon"><ClipboardList size={25} /></div><h3>Nenhum pedido encontrado</h3><p>Crie seu primeiro pedido ou ajuste a busca.</p><button className="primary-button" onClick={() => setView('novo')}><Plus size={17} /> Criar pedido</button></div>}
            </section>
          )}
          <footer className="app-footer"><span>© {new Date().getFullYear()} Comercial Soares</span><span><ShieldCheck size={14} /> Área administrativa</span></footer>
        </div>
      </main>
    </div>
  );
}