const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET all budgets with current month spending
router.get('/', (req, res) => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());

  const budgets = db.prepare('SELECT * FROM budgets ORDER BY category').all();

  const spent = db.prepare(`
    SELECT category, SUM(ABS(amount)) as spent
    FROM transactions
    WHERE amount < 0
      AND strftime('%m', date) = ?
      AND strftime('%Y', date) = ?
    GROUP BY category
  `).all(month, year);

  const spentMap = Object.fromEntries(spent.map(s => [s.category, s.spent]));

  const result = budgets.map(b => ({
    ...b,
    spent: spentMap[b.category] || 0,
    remaining: b.monthly_limit - (spentMap[b.category] || 0),
    percent: Math.min(100, Math.round(((spentMap[b.category] || 0) / b.monthly_limit) * 100)),
  }));

  res.json(result);
});

// POST create budget
router.post('/', (req, res) => {
  const { category, monthly_limit } = req.body;
  if (!category || !monthly_limit) return res.status(400).json({ error: 'category and monthly_limit required' });
  try {
    const result = db.prepare('INSERT INTO budgets (category, monthly_limit) VALUES (?, ?)').run(category, monthly_limit);
    res.json({ id: result.lastInsertRowid, category, monthly_limit });
  } catch {
    res.status(409).json({ error: 'Budget for this category already exists' });
  }
});

// PUT update budget
router.put('/:id', (req, res) => {
  const { monthly_limit } = req.body;
  db.prepare('UPDATE budgets SET monthly_limit = ? WHERE id = ?').run(monthly_limit, req.params.id);
  res.json({ success: true });
});

// DELETE budget
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
