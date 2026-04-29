const express = require('express');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 3001;

function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json());

  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/accounts', require('./routes/accounts'));
  app.use('/api/transactions', require('./routes/transactions'));
  app.use('/api/budgets', require('./routes/budgets'));
  app.use('/api/bills', require('./routes/bills'));
  app.use('/api/backup', require('./routes/backup'));

  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  if (process.env.CLIENT_DIST_DIR) {
    app.use(express.static(process.env.CLIENT_DIST_DIR));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.env.CLIENT_DIST_DIR, 'index.html'));
    });
  }

  return app;
}

function start(port = PORT, callback) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`Personal Wealth API running on http://localhost:${port}`);
    if (callback) callback(port);
  });
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start };
