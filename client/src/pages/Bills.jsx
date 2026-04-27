import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, RotateCw, X, Check, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency, formatDate, daysUntilLabel } from '../utils/format';

const CATEGORIES = ['Bills', 'Subscriptions', 'Rent/Mortgage', 'Insurance', 'Utilities', 'Loan', 'Other'];

function BillForm({ accounts, onSave, onCancel, initial = {} }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    amount: initial.amount || '',
    due_day: initial.due_day || '',
    category: initial.category || 'Bills',
    account_id: initial.account_id || '',
    is_recurring: initial.is_recurring !== false,
    is_last_day: Boolean(initial.is_last_day),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function submit(e) {
    e.preventDefault();
    onSave({
      ...form,
      amount: parseFloat(form.amount),
      due_day: form.is_last_day ? 31 : parseInt(form.due_day),
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="stat-label mb-1 block">Bill Name</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Netflix" />
        </div>
        <div>
          <label className="stat-label mb-1 block">Amount ($)</label>
          <input className="input" type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="15.99" />
        </div>
        <div>
          <label className="stat-label mb-1 block">Due Day of Month</label>
          <input
            className="input"
            type="number"
            min="1"
            max="31"
            value={form.is_last_day ? '' : form.due_day}
            onChange={e => set('due_day', e.target.value)}
            required={!form.is_last_day}
            disabled={form.is_last_day}
            placeholder={form.is_last_day ? 'Last day' : '15'}
          />
        </div>
        <div>
          <label className="stat-label mb-1 block">Category</label>
          <select className="select w-full" value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="stat-label mb-1 block">Pay From Account</label>
          <select className="select w-full" value={form.account_id} onChange={e => set('account_id', e.target.value)}>
            <option value="">Do not auto subtract</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
        <input type="checkbox" className="rounded" checked={form.is_recurring} onChange={e => set('is_recurring', e.target.checked)} />
        Recurring monthly bill
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          className="rounded"
          checked={form.is_last_day}
          onChange={e => set('is_last_day', e.target.checked)}
        />
        Due on the last day of the month
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex items-center gap-2"><Check size={14} /> Save</button>
        <button type="button" className="btn-ghost" onClick={onCancel}><X size={14} /></button>
      </div>
    </form>
  );
}

function UrgencyBadge({ days }) {
  if (days < 0) return <span className="text-xs bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">Past due</span>;
  if (days === 0) return <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">Today</span>;
  if (days <= 3) return <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{daysUntilLabel(days)}</span>;
  if (days <= 7) return <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{daysUntilLabel(days)}</span>;
  return <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{daysUntilLabel(days)}</span>;
}

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [billRows, accountRows] = await Promise.all([
        api.get('/bills'),
        api.get('/accounts'),
      ]);
      setBills(billRows);
      setAccounts(accountRows);
    }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data) {
    await api.post('/bills', data);
    setShowForm(false);
    load();
  }

  async function handleUpdate(id, data) {
    await api.put(`/bills/${id}`, data);
    setEditing(null);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this bill?')) return;
    await api.delete(`/bills/${id}`);
    load();
  }

  async function togglePaid(bill) {
    await api.put(`/bills/${bill.id}`, { ...bill, is_paid: !bill.is_paid });
    load();
  }

  const totalMonthly = bills.filter(b => b.is_recurring).reduce((s, b) => s + b.amount, 0);
  const dueNext7 = bills.filter(b => b.days_until !== undefined && b.days_until <= 7 && b.days_until >= 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bills</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {formatCurrency(totalMonthly)}/mo recurring · {dueNext7.length} due within 7 days
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost"><RotateCw size={14} /></button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={14} /> Add Bill</button>
        </div>
      </div>

      {showForm && <BillForm accounts={accounts} onSave={handleCreate} onCancel={() => setShowForm(false)} />}

      {loading ? (
        <div className="flex justify-center py-12"><RotateCw size={20} className="animate-spin text-brand-500" /></div>
      ) : bills.length === 0 && !showForm ? (
        <div className="card text-center py-12 text-slate-600">No bills added yet. Add recurring bills to track due dates.</div>
      ) : (
        <div className="space-y-2">
          {bills.map(b => (
            editing?.id === b.id ? (
              <BillForm key={b.id} accounts={accounts} initial={b} onSave={d => handleUpdate(b.id, d)} onCancel={() => setEditing(null)} />
            ) : (
              <div key={b.id} className={`card flex items-center gap-4 hover:border-slate-700 transition-colors ${b.is_paid ? 'opacity-50' : ''}`}>
                <button onClick={() => togglePaid(b)} className={`flex-shrink-0 ${b.is_paid ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400'} transition-colors`}>
                  {b.is_paid ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-medium ${b.is_paid ? 'line-through text-slate-500' : ''}`}>{b.name}</p>
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{b.category}</span>
                    {b.is_recurring && <span className="text-xs text-slate-600">Monthly</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Due: {formatDate(b.next_due)} ({b.is_last_day ? 'last day' : `day ${b.due_day}`})
                    {b.account_name ? ` from ${b.account_name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {b.days_until !== undefined && <UrgencyBadge days={b.days_until} />}
                  <span className="font-semibold text-white">{formatCurrency(b.amount)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(b)} className="btn-ghost p-1.5"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(b.id)} className="btn-ghost p-1.5 text-red-400"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
