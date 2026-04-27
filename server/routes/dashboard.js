const express = require('express');
const router = express.Router();
const db = require('../db/database');
const LIABILITY_TYPES = ['credit', 'loan'];

function isLiability(account) {
  return account.kind === 'liability' || (!account.kind && LIABILITY_TYPES.includes(account.type));
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const monthValue = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${monthValue}-${day}`;
}

function dueDateForMonth(year, monthValue, dueDay, isLastDay) {
  const lastDay = new Date(year, monthValue + 1, 0).getDate();
  const day = isLastDay ? lastDay : Math.min(Number(dueDay) || 1, lastDay);
  return new Date(year, monthValue, day);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function applyAmountToAccount(accountId, amount) {
  if (!accountId) return false;
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) return false;
  const transactionAmount = Number(amount) || 0;
  const balanceDelta = isLiability(account) ? -transactionAmount : transactionAmount;
  const nextBalance = (Number(account.balance) || 0) + balanceDelta;
  db.prepare('UPDATE accounts SET balance = ?, last_synced = datetime("now") WHERE id = ?')
    .run(nextBalance, accountId);
  return true;
}

function autoPayDueBills() {
  const today = startOfToday();
  const bills = db.prepare('SELECT * FROM bills WHERE is_recurring = 1').all();

  bills.forEach(bill => {
    if (!bill.account_id) return;
    const dueDate = dueDateForMonth(today.getFullYear(), today.getMonth(), bill.due_day, bill.is_last_day);
    if (dueDate > today) return;

    const dueDateString = formatLocalDate(dueDate);
    if (bill.last_paid_date === dueDateString) return;

    const amount = -Math.abs(Number(bill.amount) || 0);
    if (!applyAmountToAccount(bill.account_id, amount)) return;

    db.prepare(
      'INSERT INTO transactions (account_id, date, description, amount, category, source) VALUES (?, ?, ?, ?, ?, "bill")'
    ).run(bill.account_id, dueDateString, `${bill.name} bill`, amount, bill.category || 'Bills');
    db.prepare('UPDATE bills SET is_paid = ?, last_paid_date = ? WHERE id = ?')
      .run(1, dueDateString, bill.id);
  });
}

// GET dashboard summary - net worth, spending, balances, bills
router.get('/', (req, res) => {
  autoPayDueBills();
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());

  // Net worth
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY name').all();
  const assets = accounts
    .filter(a => !isLiability(a))
    .reduce((sum, a) => sum + (a.balance || 0), 0);
  const liabilities = accounts
    .filter(a => isLiability(a))
    .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);
  const netWorth = assets - liabilities;

  // Monthly spending
  const spendingRow = db.prepare(`
    SELECT SUM(ABS(amount)) as total FROM transactions
    WHERE amount < 0
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
  `).get(month, year);
  const monthlySpending = spendingRow?.total || 0;

  // Monthly income
  const incomeRow = db.prepare(`
    SELECT SUM(amount) as total FROM transactions
    WHERE amount > 0
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
  `).get(month, year);
  const monthlyIncome = incomeRow?.total || 0;

  // Top spending categories this month
  const topCategories = db.prepare(`
    SELECT category, SUM(ABS(amount)) as total FROM transactions
    WHERE amount < 0
      AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
    GROUP BY category ORDER BY total DESC LIMIT 5
  `).all(month, year);

  // Upcoming bills (next 14 days)
  const allBills = db.prepare('SELECT * FROM bills WHERE is_recurring = 1').all();
  function calcNextDue(dueDay, isLastDay) {
    const d = startOfToday();
    let next = dueDateForMonth(d.getFullYear(), d.getMonth(), dueDay, isLastDay);
    if (next < d) next = dueDateForMonth(d.getFullYear(), d.getMonth() + 1, dueDay, isLastDay);
    return formatLocalDate(next);
  }
  const upcomingBills = allBills
    .map(b => ({
      ...b,
      next_due: calcNextDue(b.due_day, b.is_last_day),
      days_until: Math.ceil((new Date(calcNextDue(b.due_day, b.is_last_day)) - now) / 86400000),
    }))
    .filter(b => b.days_until <= 14)
    .sort((a, b) => a.days_until - b.days_until);

  // Net worth history (last 6 snapshots)
  const netWorthHistory = db.prepare(
    'SELECT date, net_worth FROM net_worth_snapshots ORDER BY date DESC LIMIT 6'
  ).all().reverse();

  res.json({
    netWorth,
    assets,
    liabilities,
    monthlySpending,
    monthlyIncome,
    topCategories,
    upcomingBills,
    netWorthHistory,
    accounts: accounts.slice(0, 8),
  });
});

// POST snapshot current net worth
router.post('/snapshot', (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY name').all();
  const assets = accounts.filter(a => !isLiability(a)).reduce((s, a) => s + (a.balance || 0), 0);
  const liabilities = accounts.filter(a => isLiability(a)).reduce((s, a) => s + Math.abs(a.balance || 0), 0);
  const netWorth = assets - liabilities;
  const date = new Date().toISOString().split('T')[0];
  db.prepare('INSERT INTO net_worth_snapshots (date, assets, liabilities, net_worth) VALUES (?, ?, ?, ?)')
    .run(date, assets, liabilities, netWorth);
  res.json({ date, assets, liabilities, netWorth });
});

module.exports = router;
