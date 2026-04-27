const express = require('express');
const router = express.Router();
const db = require('../db/database');
const LIABILITY_TYPES = ['credit', 'loan'];

function isLiability(account) {
  return account.kind === 'liability' || (!account.kind && LIABILITY_TYPES.includes(account.type));
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dueDateForMonth(year, month, dueDay, isLastDay) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = isLastDay ? lastDay : Math.min(Number(dueDay) || 1, lastDay);
  return new Date(year, month, day);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function calcNextDue(dueDay, isLastDay) {
  const today = startOfToday();
  let next = dueDateForMonth(today.getFullYear(), today.getMonth(), dueDay, isLastDay);
  if (next < today) {
    next = dueDateForMonth(today.getFullYear(), today.getMonth() + 1, dueDay, isLastDay);
  }
  return formatLocalDate(next);
}

function currentCycleDueDate(bill) {
  const today = startOfToday();
  return dueDateForMonth(today.getFullYear(), today.getMonth(), bill.due_day, bill.is_last_day);
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
    const dueDate = currentCycleDueDate(bill);
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

// GET upcoming bills (next 30 days)
router.get('/', (req, res) => {
  autoPayDueBills();
  const bills = db.prepare('SELECT * FROM bills ORDER BY due_day').all();
  const today = startOfToday();
  const result = bills.map(b => ({
    ...b,
    next_due: calcNextDue(b.due_day, b.is_last_day),
    days_until: Math.ceil((new Date(calcNextDue(b.due_day, b.is_last_day)) - today) / (1000 * 60 * 60 * 24)),
  }));
  result.sort((a, b) => a.days_until - b.days_until);
  res.json(result);
});

// POST create bill
router.post('/', (req, res) => {
  const { name, amount, due_day, category, is_recurring, is_last_day, account_id } = req.body;
  if (!name || !amount || (!due_day && !is_last_day)) return res.status(400).json({ error: 'name, amount, due_day required' });
  const result = db.prepare(
    'INSERT INTO bills (name, amount, due_day, category, is_recurring, is_last_day, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(name, amount, is_last_day ? 31 : due_day, category || 'Bills', is_recurring !== false ? 1 : 0, is_last_day ? 1 : 0, account_id || null);
  res.json({ id: result.lastInsertRowid });
});

// PUT update bill
router.put('/:id', (req, res) => {
  const { name, amount, due_day, category, is_paid, is_recurring, is_last_day, account_id } = req.body;
  db.prepare('UPDATE bills SET name = ?, amount = ?, due_day = ?, category = ?, is_paid = ?, is_recurring = ?, is_last_day = ?, account_id = ? WHERE id = ?')
    .run(name, amount, is_last_day ? 31 : due_day, category, is_paid ? 1 : 0, is_recurring !== false ? 1 : 0, is_last_day ? 1 : 0, account_id || null, req.params.id);
  res.json({ success: true });
});

// DELETE bill
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM bills WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
