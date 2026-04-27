const express = require('express');
const router = express.Router();
const db = require('../db/database');

const LIABILITY_TYPES = ['credit', 'loan'];

function isLiability(account) {
  return account.kind === 'liability' || (!account.kind && LIABILITY_TYPES.includes(account.type));
}

function applyTransactionToAccount(accountId, amount) {
  if (!accountId) return;
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) return;
  const transactionAmount = Number(amount) || 0;
  const balanceDelta = isLiability(account) ? -transactionAmount : transactionAmount;
  const nextBalance = (Number(account.balance) || 0) + balanceDelta;
  db.prepare('UPDATE accounts SET balance = ?, last_synced = datetime("now") WHERE id = ?')
    .run(nextBalance, accountId);
}

// GET transactions with optional filters
router.get('/', (req, res) => {
  const { month, year, category, account_id, limit = 100 } = req.query;
  let query = 'SELECT t.*, a.name as account_name FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id WHERE 1=1';
  const params = [];

  if (month && year) {
    query += ' AND strftime("%m", t.date) = ? AND strftime("%Y", t.date) = ?';
    params.push(month.padStart(2, '0'), year);
  }
  if (category) { query += ' AND t.category = ?'; params.push(category); }
  if (account_id) { query += ' AND t.account_id = ?'; params.push(account_id); }

  query += ' ORDER BY t.date DESC LIMIT ?';
  params.push(parseInt(limit));

  res.json(db.prepare(query).all(...params));
});

// GET monthly spending summary grouped by category
router.get('/summary', (req, res) => {
  const now = new Date();
  const month = req.query.month || String(now.getMonth() + 1).padStart(2, '0');
  const year = req.query.year || String(now.getFullYear());

  const rows = db.prepare(`
    SELECT category, SUM(ABS(amount)) as total, COUNT(*) as count
    FROM transactions
    WHERE amount < 0
      AND strftime('%m', date) = ?
      AND strftime('%Y', date) = ?
    GROUP BY category
    ORDER BY total DESC
  `).all(month, year);

  const totalSpending = rows.reduce((sum, r) => sum + r.total, 0);
  res.json({ month, year, totalSpending, byCategory: rows });
});

// POST create manual transaction
router.post('/', (req, res) => {
  const { account_id, date, description, amount, category } = req.body;
  if (amount === undefined || !date) return res.status(400).json({ error: 'amount and date required' });
  const stmt = db.prepare(
    'INSERT INTO transactions (account_id, date, description, amount, category, source) VALUES (?, ?, ?, ?, ?, "manual")'
  );
  const normalizedAccountId = account_id || null;
  const normalizedAmount = Number(amount) || 0;
  const result = stmt.run(normalizedAccountId, date, description || '', normalizedAmount, category || 'Uncategorized');
  applyTransactionToAccount(normalizedAccountId, normalizedAmount);
  res.json({ id: result.lastInsertRowid });
});

// DELETE transaction
router.delete('/:id', (req, res) => {
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (transaction) {
    applyTransactionToAccount(transaction.account_id, -(Number(transaction.amount) || 0));
  }
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
