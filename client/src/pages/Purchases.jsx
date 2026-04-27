import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, ReceiptText, RefreshCw, Trash2, X } from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';

const CATEGORIES = [
  'Income',
  'Transfer',
  'Groceries',
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Healthcare',
  'Utilities',
  'Subscriptions',
  'Travel',
  'Other',
];

const TYPE_META = {
  purchase: {
    label: 'Purchase / Charge',
    category: null,
    fallback: 'Purchase',
    placeholder: 'Store, vendor, or note',
    button: 'Save Purchase',
  },
  deposit: {
    label: 'Deposit / Income',
    category: 'Income',
    fallback: 'Deposit',
    placeholder: 'Paycheck, transfer, or income note',
    button: 'Save Deposit',
  },
  debt_payment: {
    label: 'Debt Payment',
    category: 'Debt Payment',
    fallback: 'Debt Payment',
    placeholder: 'Card or loan payment note',
    button: 'Save Payment',
  },
};

function today() {
  return new Date().toISOString().split('T')[0];
}

function TransactionForm({ accounts, onSave, onCancel }) {
  const [form, setForm] = useState({
    kind: 'purchase',
    date: today(),
    description: '',
    amount: '',
    category: CATEGORIES[0],
    account_id: '',
  });
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  function submit(e) {
    e.preventDefault();
    const amount = Math.abs(parseFloat(form.amount) || 0);
    const meta = TYPE_META[form.kind];
    onSave({
      account_id: form.account_id || null,
      date: form.date,
      description: form.description,
      amount: form.kind === 'purchase' ? -amount : amount,
      category: meta.category || form.category,
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div>
          <label className="stat-label mb-1 block">Type</label>
          <select className="select w-full" value={form.kind} onChange={e => set('kind', e.target.value)}>
            {Object.entries(TYPE_META).map(([value, meta]) => (
              <option key={value} value={value}>{meta.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="stat-label mb-1 block">Date</label>
          <input className="input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>
        <div>
          <label className="stat-label mb-1 block">Amount</label>
          <input className="input" type="number" step="0.01" min="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="42.50" />
        </div>
        <div>
          <label className="stat-label mb-1 block">Category</label>
          <select className="select w-full" value={form.category} onChange={e => set('category', e.target.value)} disabled={form.kind !== 'purchase'}>
            {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div>
          <label className="stat-label mb-1 block">Account</label>
          <select className="select w-full" value={form.account_id} onChange={e => set('account_id', e.target.value)}>
            <option value="">No account</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 xl:col-span-4">
          <label className="stat-label mb-1 block">Description</label>
          <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder={TYPE_META[form.kind].placeholder} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex items-center gap-2">
          <Check size={14} /> {TYPE_META[form.kind].button}
        </button>
        <button type="button" className="btn-ghost flex items-center gap-2" onClick={onCancel}><X size={14} /> Cancel</button>
      </div>
    </form>
  );
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [transactions, accountRows] = await Promise.all([
        api.get('/transactions?limit=200'),
        api.get('/accounts'),
      ]);
      setTransactions(transactions.filter(transaction => transaction.amount !== 0));
      setAccounts(accountRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createTransaction(data) {
    await api.post('/transactions', data);
    setShowForm(false);
    load();
  }

  async function deleteTransaction(id) {
    if (!confirm('Delete this entry?')) return;
    await api.delete(`/transactions/${id}`);
    load();
  }

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYear = String(now.getFullYear());

  const monthlyPurchases = useMemo(() => {
    return transactions.filter(purchase => {
      const date = String(purchase.date || '');
      return purchase.amount < 0 && date.slice(0, 4) === currentYear && date.slice(5, 7) === currentMonth;
    });
  }, [transactions, currentMonth, currentYear]);

  const monthlyIncome = useMemo(() => {
    return transactions.filter(transaction => {
      const date = String(transaction.date || '');
      return transaction.amount > 0 && date.slice(0, 4) === currentYear && date.slice(5, 7) === currentMonth;
    });
  }, [transactions, currentMonth, currentYear]);

  const monthlyTotal = monthlyPurchases.reduce((sum, purchase) => sum + Math.abs(purchase.amount || 0), 0);
  const monthlyIncomeTotal = monthlyIncome.reduce((sum, transaction) => sum + Math.abs(transaction.amount || 0), 0);
  const allTotal = transactions
    .filter(purchase => purchase.amount < 0)
    .reduce((sum, purchase) => sum + Math.abs(purchase.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-slate-400 text-sm mt-0.5">Add purchases, deposits, income, and debt payments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost flex items-center gap-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Add Transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="stat-label">This Month</p>
          <p className="stat-value text-red-400">{formatCurrency(monthlyTotal)}</p>
        </div>
        <div className="card">
          <p className="stat-label">Income This Month</p>
          <p className="stat-value text-emerald-400">{formatCurrency(monthlyIncomeTotal)}</p>
        </div>
        <div className="card">
          <p className="stat-label">All Spending</p>
          <p className="stat-value">{formatCurrency(allTotal)}</p>
        </div>
      </div>

      {showForm && <TransactionForm accounts={accounts} onSave={createTransaction} onCancel={() => setShowForm(false)} />}

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <ReceiptText size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold text-slate-300">Recent Entries</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin text-brand-500" /></div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-600">No entries yet. Add one to start tracking spending and payments.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase border-b border-slate-800">
                  <th className="text-left pb-2">Date</th>
                  <th className="text-left pb-2">Description</th>
                  <th className="text-left pb-2">Category</th>
                  <th className="text-left pb-2">Account</th>
                  <th className="text-right pb-2">Amount</th>
                  <th className="w-10 pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(transaction => (
                  <tr key={transaction.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="py-3 text-slate-400 whitespace-nowrap">{formatDate(transaction.date)}</td>
                    <td className="py-3 font-medium min-w-48">{transaction.description || (transaction.amount > 0 ? 'Deposit / Payment' : 'Purchase')}</td>
                    <td className="py-3">
                      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{transaction.category || 'Uncategorized'}</span>
                    </td>
                    <td className="py-3 text-slate-400">{transaction.account_name || 'No account'}</td>
                    <td className={`py-3 text-right font-semibold ${transaction.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => deleteTransaction(transaction.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
