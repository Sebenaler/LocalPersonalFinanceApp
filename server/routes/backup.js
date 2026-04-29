const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const backup = db.exportData();
  const date = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="personal-wealth-backup-${date}.json"`);
  res.json(backup);
});

router.post('/restore', (req, res) => {
  try {
    db.importData(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
