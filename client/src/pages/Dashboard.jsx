import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, CalendarClock, ArrowUpRight, RotateCw
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { api } from '../utils/api';
import { formatCurrency, formatDate, daysUntilLabel } from '../utils/format';

const COLORS = ['#0ea5e9', '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

const ACCOUNT_TYPE_LABELS = {
  checking: 'Checking', savings: 'Savings', credit: 'Credit Card',
  '401k': '401k', roth_ira: 'Roth IRA',
  investment: 'Investment', crypto: 'Crypto', loan: 'Loan',
};

function isLiability(account) {
  return account.kind === 'liability' || (!account.kind && ['credit', 'loan'].includes(account.type));
}

function StatCard({ label, value, sub, icon: Icon, trend, color = 'brand' }) {
  const colorMap = {
    brand: 'text-brand-500 bg-brand-500/10',
    green: 'text-emerald-400 bg-emerald-400/10',
    red: 'text-red-400 bg-red-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
  };
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        <span className={`p-2 rounded-lg ${colorMap[color]}`}><Icon size={16} /></span>
      </div>
      <div>
        <div className="stat-value">{value}</div>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend >= 0 ? '+' : ''}{formatCurrency(trend)} vs last month
        </div>
      )}
    </div>
  );
}

function BillBadge({ days }) {
  if (days <= 3) return <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{daysUntilLabel(days)}</span>;
  if (days <= 7) return <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{daysUntilLabel(days)}</span>;
  return <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{daysUntilLabel(days)}</span>;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await api.get('/dashboard');
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RotateCw size={24} className="animate-spin text-brand-500" />
    </div>
  );

  if (error) return (
    <div className="card text-red-400 text-sm">{error}</div>
  );

  const { netWorth, assets, liabilities, monthlySpending, monthlyIncome, topCategories, upcomingBills, netWorthHistory, accounts } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2">
          <RotateCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Net Worth" value={formatCurrency(netWorth)} sub={`Assets ${formatCurrency(assets)} · Debts ${formatCurrency(liabilities)}`} icon={Wallet} color="brand" />
        <StatCard label="Monthly Spending" value={formatCurrency(monthlySpending)} sub="This calendar month" icon={TrendingDown} color="red" />
        <StatCard label="Monthly Income" value={formatCurrency(monthlyIncome)} sub="This calendar month" icon={TrendingUp} color="green" />
        <StatCard label="Upcoming Bills" value={upcomingBills.length} sub="Due in the next 14 days" icon={CalendarClock} color="amber" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Net worth chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Net Worth History</h2>
          {netWorthHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={netWorthHistory}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={55} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v) => [formatCurrency(v), 'Net Worth']}
                />
                <Area type="monotone" dataKey="net_worth" stroke="#0ea5e9" strokeWidth={2} fill="url(#nwGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
              No history yet - click Refresh after adding accounts to take a snapshot.
            </div>
          )}
        </div>

        {/* Spending by category */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Spending by Category</h2>
          {topCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={topCategories} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                  {topCategories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v) => [formatCurrency(v)]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">No spending data this month</div>
          )}
        </div>
      </div>

      {/* Accounts + Bills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Account balances */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Account Balances</h2>
            <a href="/accounts" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">Manage <ArrowUpRight size={12} /></a>
          </div>
          <div className="space-y-2">
            {accounts.length === 0 && (
              <p className="text-slate-600 text-sm">No accounts yet - go to Accounts to add one.</p>
            )}
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-slate-500">{a.institution || ACCOUNT_TYPE_LABELS[a.type] || a.type}</p>
                </div>
                <span className={`text-sm font-semibold ${isLiability(a) ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isLiability(a) ? '-' : ''}{formatCurrency(a.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming bills */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Upcoming Bills</h2>
            <a href="/bills" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">Manage <ArrowUpRight size={12} /></a>
          </div>
          <div className="space-y-2">
            {upcomingBills.length === 0 && (
              <p className="text-slate-600 text-sm">No bills due in the next 14 days.</p>
            )}
            {upcomingBills.map(b => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-slate-500">{formatDate(b.next_due)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <BillBadge days={b.days_until} />
                  <span className="text-sm font-semibold text-white">{formatCurrency(b.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
