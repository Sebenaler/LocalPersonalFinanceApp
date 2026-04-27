import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, CreditCard, PiggyBank, Receipt, Menu, DollarSign, ListChecks
} from 'lucide-react';
import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import Accounts from './pages/Accounts';
import Budgets from './pages/Budgets';
import Bills from './pages/Bills';
import Transactions from './pages/Purchases';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/portfolio', label: 'Portfolio', icon: TrendingUp },
  { to: '/accounts', label: 'Accounts', icon: CreditCard },
  { to: '/purchases', label: 'Transactions', icon: ListChecks },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/bills', label: 'Bills', icon: Receipt },
];

function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 h-full w-60 bg-slate-900 border-r border-slate-800 z-30 flex flex-col transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-800">
          <DollarSign size={22} className="text-brand-500" />
          <span className="font-bold text-lg tracking-tight">WealthApp</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-600 text-center">
          Personal Wealth Dashboard
        </div>
      </aside>
    </>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
          <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3 md:hidden">
            <button onClick={() => setSidebarOpen(true)} className="p-1 text-slate-400 hover:text-white">
              <Menu size={22} />
            </button>
            <span className="font-semibold">WealthApp</span>
          </header>
          <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/purchases" element={<Transactions />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/bills" element={<Bills />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
