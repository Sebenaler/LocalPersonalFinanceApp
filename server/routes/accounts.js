const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET all accounts
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM accounts ORDER BY name').all());
});

// POST create manual account
router.post('/', (req, res) => {
  const { name, type, kind, institution, balance, currency } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type required' });
  const stmt = db.prepare(
    'INSERT INTO accounts (name, type, kind, institution, balance, currency, is_manual) VALUES (?, ?, ?, ?, ?, ?, 1)'
  );
  const result = stmt.run(name, type, kind || 'asset', institution || null, balance || 0, currency || 'USD');
  res.json({ id: result.lastInsertRowid, name, type, kind: kind || 'asset', institution, balance, currency });
});

// PUT update account balance
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'account not found' });

  const { balance, name, type, kind, institution } = req.body;
  db.prepare('UPDATE accounts SET balance = ?, name = ?, type = ?, kind = ?, institution = ?, last_synced = datetime("now") WHERE id = ?')
    .run(
      balance ?? existing.balance,
      name ?? existing.name,
      type ?? existing.type,
      kind ?? existing.kind ?? 'asset',
      institution ?? existing.institution,
      req.params.id
    );
  res.json({ success: true });
});

// DELETE account
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
