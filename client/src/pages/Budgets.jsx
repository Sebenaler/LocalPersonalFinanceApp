import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, RotateCw, X, Check } from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';

const DEFAULT_CATEGORIES = [
  'Housing', 'Transportation', 'Food & Dining', 'Groceries', 'Entertainment',
  'Healthcare', 'Utilities', 'Insurance', 'Subscriptions', 'Shopping', 'Travel', 'Other',
];

function BudgetBar({ percent }) {
  const color = percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

function BudgetForm({ onSave, onCancel, initial = {} }) {
  const [category, setCategory] = useState(initial.category || DEFAULT_CATEGORIES[0]);
  const [customCat, setCustomCat] = useState('');
  const [limit, setLimit] = useState(initial.monthly_limit || '');
  const isCustom = category === '__custom__';

  function submit(e) {
    e.preventDefault();
    onSave({ category: isCustom ? customCat : category, monthly_limit: parseFloat(limit) });
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="stat-label mb-1 block">Category</label>
          {initial.category ? (
            <input className="input" value={category} readOnly />
          ) : (
            <select className="select w-full" value={category} onChange={e => setCategory(e.target.value)}>
              {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
          )}
          {isCustom && <input className="input mt-2" placeholder="Category name" value={customCat} onChange={e => setCustomCat(e.target.value)} required />}
        </div>
        <div>
          <label className="stat-label mb-1 block">Monthly Limit ($)</label>
          <input className="input" type="number" step="0.01" min="1" value={limit} onChange={e => setLimit(e.target.value)} required placeholder="500.00" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex items-center gap-2"><Check size={14} /> Save</button>
        <button type="button" className="btn-ghost" onClick={onCancel}><X size={14} /></button>
      </div>
    </form>
  );
}

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try { setBudgets(await api.get('/budgets')); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data) {
    await api.post('/budgets', data);
    setShowForm(false);
    load();
  }

  async function handleUpdate(id, data) {
    await api.put(`/budgets/${id}`, data);
    setEditing(null);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this budget?')) return;
    await api.delete(`/budgets/${id}`);
    load();
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {formatCurrency(totalSpent)} spent of {formatCurrency(totalBudgeted)} budgeted this month
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost"><RotateCw size={14} /></button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={14} /> Add Budget</button>
        </div>
      </div>

      {showForm && <BudgetForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}

      {loading ? (
        <div className="flex justify-center py-12"><RotateCw size={20} className="animate-spin text-brand-500" /></div>
      ) : budgets.length === 0 && !showForm ? (
        <div className="card text-center py-12 text-slate-600">No budgets yet. Add one to start tracking.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {budgets.map(b => (
            editing?.id === b.id ? (
              <div key={b.id} className="sm:col-span-2 xl:col-span-3">
                <BudgetForm initial={b} onSave={d => handleUpdate(b.id, d)} onCancel={() => setEditing(null)} />
              </div>
            ) : (
              <div key={b.id} className="card hover:border-slate-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{b.category}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatCurrency(b.spent)} / {formatCurrency(b.monthly_limit)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(b)} className="btn-ghost p-1.5"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(b.id)} className="btn-ghost p-1.5 text-red-400"><Trash2 size={13} /></button>
                  </div>
                </div>
                <BudgetBar percent={b.percent} />
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-xs font-medium ${b.percent >= 100 ? 'text-red-400' : b.percent >= 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {b.percent}%
                  </span>
                  <span className={`text-xs ${b.remaining < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                    {b.remaining < 0 ? `${formatCurrency(Math.abs(b.remaining))} over` : `${formatCurrency(b.remaining)} left`}
                  </span>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
