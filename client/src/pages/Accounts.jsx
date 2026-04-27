import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, RotateCw, X, Check } from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';

const TYPES = ['checking', 'savings', '401k', 'roth_ira', 'credit', 'investment', 'crypto', 'loan'];
const TYPE_LABELS = {
  checking: 'Checking',
  savings: 'Savings',
  '401k': '401k',
  roth_ira: 'Roth IRA',
  credit: 'Credit',
  investment: 'Investment',
  crypto: 'Crypto',
  loan: 'Loan',
};
const TYPE_COLORS = {
  checking: 'text-sky-400', savings: 'text-emerald-400', credit: 'text-red-400',
  '401k': 'text-violet-400', roth_ira: 'text-amber-400',
  investment: 'text-violet-400', crypto: 'text-amber-400', loan: 'text-red-400',
};

const LIABILITY_TYPES = ['credit', 'loan'];

function defaultKind(type) {
  return LIABILITY_TYPES.includes(type) ? 'liability' : 'asset';
}

function normalizeCustomType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function typeLabel(type) {
  return TYPE_LABELS[type] || String(type || 'Other')
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function AccountForm({ onSave, onCancel, initial = {} }) {
  const initialIsKnownType = !initial.type || TYPES.includes(initial.type);
  const [form, setForm] = useState({
    name: initial.name || '', type: initialIsKnownType ? (initial.type || 'checking') : '__other__',
    customType: initialIsKnownType ? '' : typeLabel(initial.type),
    kind: initial.kind || defaultKind(initial.type || 'checking'),
    institution: initial.institution || '', balance: initial.balance ?? '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function submit(e) {
    e.preventDefault();
    const type = form.type === '__other__' ? normalizeCustomType(form.customType) : form.type;
    onSave({ name: form.name, type, kind: form.kind, institution: form.institution, balance: parseFloat(form.balance) || 0 });
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="stat-label mb-1 block">Account Name</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Chase Checking" />
        </div>
        <div>
          <label className="stat-label mb-1 block">Type</label>
          <select
            className="select w-full"
            value={form.type}
            onChange={e => {
              const nextType = e.target.value;
              setForm(f => ({
                ...f,
                type: nextType,
                kind: nextType === '__other__' ? f.kind : defaultKind(nextType),
              }));
            }}
          >
            {TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
            <option value="__other__">Other</option>
          </select>
          {form.type === '__other__' && (
            <input
              className="input mt-2"
              value={form.customType}
              onChange={e => set('customType', e.target.value)}
              required
              placeholder="e.g. HSA, brokerage, cash"
            />
          )}
        </div>
        <div>
          <label className="stat-label mb-1 block">Kind</label>
          <select className="select w-full" value={form.kind} onChange={e => set('kind', e.target.value)}>
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
          </select>
        </div>
        <div>
          <label className="stat-label mb-1 block">Institution</label>
          <input className="input" value={form.institution} onChange={e => set('institution', e.target.value)} placeholder="e.g. Chase Bank" />
        </div>
        <div>
          <label className="stat-label mb-1 block">Balance</label>
          <input className="input" type="number" step="0.01" value={form.balance} onChange={e => set('balance', e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex items-center gap-2"><Check size={14} /> Save</button>
        <button type="button" className="btn-ghost" onClick={onCancel}><X size={14} /></button>
      </div>
    </form>
  );
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try { setAccounts(await api.get('/accounts')); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data) {
    await api.post('/accounts', data);
    setShowForm(false);
    load();
  }

  async function handleUpdate(id, data) {
    await api.put(`/accounts/${id}`, data);
    setEditing(null);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this account?')) return;
    await api.delete(`/accounts/${id}`);
    load();
  }

  const groupOrder = [
    ...TYPES,
    ...accounts
      .map(account => account.type)
      .filter(type => type && !TYPES.includes(type))
      .sort((a, b) => typeLabel(a).localeCompare(typeLabel(b))),
  ];

  const grouped = groupOrder.reduce((acc, t) => {
    acc[t] = accounts.filter(a => a.type === t);
    return acc;
  }, {});

  const totalAssets = accounts.filter(a => a.kind !== 'liability').reduce((s, a) => s + (a.balance || 0), 0);
  const totalLiabilities = accounts.filter(a => a.kind === 'liability').reduce((s, a) => s + Math.abs(a.balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Assets: <span className="text-emerald-400">{formatCurrency(totalAssets)}</span> &nbsp;·&nbsp;
            Debts: <span className="text-red-400">{formatCurrency(totalLiabilities)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost flex items-center gap-2"><RotateCw size={14} /></button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={14} /> Add Account</button>
        </div>
      </div>

      {showForm && <AccountForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}

      {loading ? (
        <div className="flex justify-center py-12"><RotateCw size={20} className="animate-spin text-brand-500" /></div>
      ) : (
        groupOrder.filter(t => grouped[t].length > 0 || t === 'checking').map(t => (
          grouped[t].length > 0 && (
            <div key={t} className="space-y-2">
              <h2 className={`text-xs font-semibold uppercase tracking-wider ${TYPE_COLORS[t] || 'text-slate-400'}`}>
                {typeLabel(t)}
              </h2>
              {grouped[t].map(a => (
                editing?.id === a.id ? (
                  <AccountForm key={a.id} initial={a} onSave={d => handleUpdate(a.id, d)} onCancel={() => setEditing(null)} />
                ) : (
                  <div key={a.id} className="card flex items-center justify-between hover:border-slate-700 transition-colors">
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-slate-500">{a.institution || '—'} · {a.kind === 'liability' ? 'Liability' : 'Asset'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-semibold ${a.kind === 'liability' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {formatCurrency(a.balance)}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => setEditing(a)} className="btn-ghost p-1.5"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(a.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )
        ))
      )}

      {!loading && accounts.length === 0 && !showForm && (
        <div className="card text-center py-12 text-slate-600">
          <p>No accounts yet. Add your first account to get started.</p>
        </div>
      )}
    </div>
  );
}
