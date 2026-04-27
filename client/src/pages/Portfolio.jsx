import { useEffect, useMemo, useState } from 'react';
import {
  Car, Check, CreditCard, Landmark, PiggyBank, RefreshCw, ShieldCheck, WalletCards
} from 'lucide-react';
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';

const LIABILITY_TYPES = ['credit', 'loan'];

function isLiability(account) {
  return account.kind === 'liability' || (!account.kind && LIABILITY_TYPES.includes(account.type));
}

const ACCOUNT_META = {
  checking: { label: 'Checking', icon: WalletCards, color: '#0ea5e9', textClass: 'text-sky-400' },
  savings: { label: 'Savings', icon: PiggyBank, color: '#10b981', textClass: 'text-emerald-400' },
  '401k': { label: '401k', icon: ShieldCheck, color: '#8b5cf6', textClass: 'text-violet-400' },
  roth_ira: { label: 'Roth IRA', icon: Landmark, color: '#f59e0b', textClass: 'text-amber-400' },
  credit: { label: 'Credit Card', icon: CreditCard, color: '#ef4444', textClass: 'text-red-400' },
  loan: { label: 'Loan', icon: Car, color: '#f97316', textClass: 'text-orange-400' },
};

function parseBalance(value) {
  return parseFloat(String(value ?? '').replace(/[$,]/g, '')) || 0;
}

function formatBalanceInput(value) {
  return parseBalance(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function accountMeta(account) {
  return ACCOUNT_META[account.type] || {
    label: account.type || 'Account',
    icon: Landmark,
    color: '#64748b',
    textClass: 'text-slate-400',
  };
}

function accountDraft(account) {
  return {
    name: account?.name || '',
    institution: account?.institution || '',
    balance: account?.balance === undefined || account?.balance === null ? '' : formatBalanceInput(account.balance),
  };
}

function BalanceCard({ account, onSave }) {
  const meta = accountMeta(account);
  const Icon = meta.icon;
  const liability = isLiability(account);
  const [form, setForm] = useState(accountDraft(account));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(accountDraft(account));
  }, [account?.id, account?.balance, account?.name, account?.institution]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(account, {
        name: form.name,
        kind: account.kind || (isLiability(account) ? 'liability' : 'asset'),
        institution: form.institution,
        balance: parseBalance(form.balance),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`p-2 rounded-lg bg-slate-800 ${meta.textClass}`}>
            <Icon size={18} />
          </span>
          <div>
            <p className="font-semibold">{account.name}</p>
            <p className="text-xs text-slate-500">{meta.label}{account.institution ? ` - ${account.institution}` : ''}</p>
          </div>
        </div>
        <p className={`font-bold ${liability ? 'text-red-400' : meta.textClass}`}>
          {liability ? '-' : ''}{formatCurrency(parseBalance(form.balance))}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="stat-label mb-1 block">Account Name</label>
          <input
            className="input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="stat-label mb-1 block">Institution</label>
          <input
            className="input"
            value={form.institution}
            onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
            placeholder="Bank, brokerage, employer"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="stat-label mb-1 block">Balance</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
            <input
              className="input pl-7"
              inputMode="decimal"
              value={form.balance}
              onChange={e => setForm(f => ({
                ...f,
                balance: e.target.value.replace(/[^0-9.,-]/g, ''),
              }))}
              onBlur={() => setForm(f => ({ ...f, balance: formatBalanceInput(f.balance) }))}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      <button type="submit" className="btn-primary flex items-center gap-2 mt-4" disabled={saving}>
        <Check size={14} /> Update Balance
      </button>
    </form>
  );
}

export default function Portfolio() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setAccounts(await api.get('/accounts'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveAccount(account, data) {
    await api.put(`/accounts/${account.id}`, data);
    load();
  }

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const aLiability = isLiability(a);
      const bLiability = isLiability(b);
      if (aLiability !== bLiability) return aLiability ? 1 : -1;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [accounts]);

  const cash = accounts
    .filter(account => ['checking', 'savings'].includes(account.type))
    .reduce((sum, account) => sum + account.balance, 0);
  const retirement = accounts
    .filter(account => ['401k', 'roth_ira'].includes(account.type))
    .reduce((sum, account) => sum + account.balance, 0);
  const liabilities = accounts
    .filter(account => isLiability(account))
    .reduce((sum, account) => sum + Math.abs(account.balance), 0);
  const total = accounts
    .filter(account => !isLiability(account))
    .reduce((sum, account) => sum + account.balance, 0);
  const netWorth = total - liabilities;
  const chartData = sortedAccounts.map(account => ({
    name: account.name,
    value: Math.abs(account.balance),
    color: accountMeta(account).color,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-slate-400 text-sm mt-0.5">All account balances, assets, and liabilities</p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="stat-label">Total Balance</p>
          <p className="stat-value">{formatCurrency(netWorth)}</p>
        </div>
        <div className="card">
          <p className="stat-label">Assets</p>
          <p className="stat-value text-emerald-400">{formatCurrency(total)}</p>
        </div>
        <div className="card">
          <p className="stat-label">Liabilities</p>
          <p className="stat-value text-red-400">{formatCurrency(liabilities)}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Balance Allocation</h2>
          <span className="text-xs text-slate-500">Cash {formatCurrency(cash)} - Retirement {formatCurrency(retirement)}</span>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={55} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(value) => [formatCurrency(value), 'Balance']}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
            Add accounts to see the allocation.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {sortedAccounts.map(account => (
          <BalanceCard
            key={account.id}
            account={account}
            onSave={saveAccount}
          />
        ))}
      </div>
    </div>
  );
}
