const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const tables = {
  accounts: {
    columns: ['id', 'name', 'type', 'kind', 'institution', 'balance', 'currency', 'is_manual', 'last_synced', 'created_at'],
    numeric: ['id', 'balance', 'is_manual'],
  },
  transactions: {
    columns: ['id', 'account_id', 'date', 'description', 'amount', 'category', 'source', 'external_id', 'created_at'],
    numeric: ['id', 'account_id', 'amount'],
  },
  budgets: {
    columns: ['id', 'category', 'monthly_limit', 'created_at'],
    numeric: ['id', 'monthly_limit'],
  },
  bills: {
    columns: ['id', 'name', 'amount', 'due_day', 'category', 'is_recurring', 'is_paid', 'next_due', 'created_at', 'is_last_day', 'account_id', 'last_paid_date'],
    numeric: ['id', 'amount', 'due_day', 'is_recurring', 'is_paid', 'is_last_day', 'account_id'],
  },
  net_worth_snapshots: {
    columns: ['id', 'date', 'assets', 'liabilities', 'net_worth'],
    numeric: ['id', 'assets', 'liabilities', 'net_worth'],
  },
};

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function money(value) {
  const number = Number(value) || 0;
  const sign = number < 0 ? -1 : 1;
  return sign * (Math.round(Math.abs(number) * 100 + Number.EPSILON) / 100);
}

function defaultAccountKind(type) {
  return ['credit', 'loan'].includes(type) ? 'liability' : 'asset';
}

function csvPath(table) {
  return path.join(DATA_DIR, `${table}.csv`);
}

function escapeCell(value) {
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const [table, config] of Object.entries(tables)) {
    const file = csvPath(table);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, `${config.columns.join(',')}\n`);
    }
  }
}

function readTable(table) {
  const config = tables[table];
  const file = csvPath(table);
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const header = rows[0] || config.columns;
  const dataRows = rows.slice(1);

  return dataRows
    .filter(row => row.some(value => value !== ''))
    .map(row => Object.fromEntries(config.columns.map((column, index) => {
      const headerIndex = header.indexOf(column);
      let value = headerIndex >= 0 ? (row[headerIndex] ?? '') : '';
      if (table === 'accounts' && column === 'kind' && value === '') {
        const typeIndex = header.indexOf('type');
        value = defaultAccountKind(typeIndex >= 0 ? row[typeIndex] : '');
      }
      if (value === '') return [column, null];
      if (config.numeric.includes(column)) return [column, Number(value)];
      return [column, value];
    })));
}

function writeTable(table, rows) {
  const config = tables[table];
  const lines = [
    config.columns.join(','),
    ...rows.map(row => config.columns.map(column => escapeCell(row[column])).join(',')),
  ];
  fs.writeFileSync(csvPath(table), `${lines.join('\n')}\n`);
}

function insert(table, values) {
  const rows = readTable(table);
  const id = rows.reduce((max, row) => Math.max(max, row.id || 0), 0) + 1;
  rows.push({ id, ...values });
  writeTable(table, rows);
  return { lastInsertRowid: id, changes: 1 };
}

function updateById(table, id, patch) {
  const numericId = Number(id);
  const rows = readTable(table);
  let changes = 0;
  const next = rows.map(row => {
    if (row.id !== numericId) return row;
    changes += 1;
    return { ...row, ...patch };
  });
  writeTable(table, next);
  return { changes };
}

function deleteById(table, id) {
  const numericId = Number(id);
  const rows = readTable(table);
  const next = rows.filter(row => row.id !== numericId);
  writeTable(table, next);
  return { changes: rows.length - next.length };
}

function monthAndYear(date) {
  const value = String(date || '');
  return { month: value.slice(5, 7), year: value.slice(0, 4) };
}

function currentMonthExpenses(month, year) {
  return readTable('transactions').filter(transaction => {
    const parts = monthAndYear(transaction.date);
    return transaction.amount < 0 && parts.month === month && parts.year === year;
  });
}

function groupExpensesByCategory(month, year) {
  const groups = new Map();
  for (const transaction of currentMonthExpenses(month, year)) {
    const category = transaction.category || 'Uncategorized';
    const current = groups.get(category) || { category, total: 0, count: 0, spent: 0 };
    current.total += Math.abs(transaction.amount || 0);
    current.spent = current.total;
    current.count += 1;
    groups.set(category, current);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

function getTransactions(sql, params) {
  let index = 0;
  const monthYear = sql.includes('strftime("%m", t.date)') ? {
    month: params[index++],
    year: params[index++],
  } : null;
  const category = sql.includes('t.category = ?') ? params[index++] : null;
  const accountId = sql.includes('t.account_id = ?') ? Number(params[index++]) : null;
  const limit = Number(params[index++]) || 100;
  const accounts = new Map(readTable('accounts').map(account => [account.id, account.name]));

  return readTable('transactions')
    .filter(transaction => {
      if (monthYear) {
        const parts = monthAndYear(transaction.date);
        if (parts.month !== monthYear.month || parts.year !== monthYear.year) return false;
      }
      if (category && transaction.category !== category) return false;
      if (accountId && transaction.account_id !== accountId) return false;
      return true;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, limit)
    .map(transaction => ({ ...transaction, account_name: accounts.get(transaction.account_id) || null }));
}

function prepare(sql) {
  const normalized = sql.replace(/\s+/g, ' ').trim();

  return {
    all(...params) {
      if (normalized === 'SELECT * FROM accounts ORDER BY name') {
        return readTable('accounts').sort((a, b) => String(a.name).localeCompare(String(b.name)));
      }
      if (normalized === 'SELECT * FROM accounts WHERE id = ?') {
        return readTable('accounts').filter(account => account.id === Number(params[0]));
      }
      if (normalized === 'SELECT type, balance FROM accounts') {
        return readTable('accounts').map(({ type, kind, balance }) => ({ type, kind, balance }));
      }
      if (normalized === 'SELECT * FROM budgets ORDER BY category') {
        return readTable('budgets').sort((a, b) => String(a.category).localeCompare(String(b.category)));
      }
      if (normalized.startsWith('SELECT category, SUM(ABS(amount)) as spent FROM transactions')) {
        return groupExpensesByCategory(params[0], params[1]).map(({ category, spent }) => ({ category, spent }));
      }
      if (normalized.startsWith('SELECT category, SUM(ABS(amount)) as total, COUNT(*) as count FROM transactions')) {
        return groupExpensesByCategory(params[0], params[1]).map(({ category, total, count }) => ({ category, total, count }));
      }
      if (normalized.startsWith('SELECT category, SUM(ABS(amount)) as total FROM transactions')) {
        return groupExpensesByCategory(params[0], params[1]).slice(0, 5).map(({ category, total }) => ({ category, total }));
      }
      if (normalized === 'SELECT * FROM bills ORDER BY due_day') {
        const accounts = new Map(readTable('accounts').map(account => [account.id, account.name]));
        return readTable('bills')
          .sort((a, b) => (a.due_day || 0) - (b.due_day || 0))
          .map(bill => ({ ...bill, account_name: accounts.get(bill.account_id) || null }));
      }
      if (normalized === 'SELECT * FROM bills WHERE is_recurring = 1') {
        return readTable('bills').filter(bill => bill.is_recurring === 1);
      }
      if (normalized === 'SELECT * FROM bills WHERE id = ?') {
        return readTable('bills').filter(bill => bill.id === Number(params[0]));
      }
      if (normalized === 'SELECT date, net_worth FROM net_worth_snapshots ORDER BY date DESC LIMIT 6') {
        return readTable('net_worth_snapshots')
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .slice(0, 6)
          .map(({ date, net_worth }) => ({ date, net_worth }));
      }
      if (normalized.startsWith('SELECT t.*, a.name as account_name FROM transactions')) {
        return getTransactions(normalized, params);
      }
      if (normalized === 'SELECT * FROM transactions WHERE id = ?') {
        return readTable('transactions').filter(transaction => transaction.id === Number(params[0]));
      }
      throw new Error(`Unsupported CSV query: ${normalized}`);
    },

    get(...params) {
      if (normalized.startsWith('SELECT SUM(ABS(amount)) as total FROM transactions')) {
        const total = currentMonthExpenses(params[0], params[1]).reduce((sum, transaction) => {
          return sum + Math.abs(transaction.amount || 0);
        }, 0);
        return { total };
      }
      if (normalized.startsWith('SELECT SUM(amount) as total FROM transactions')) {
        const [month, year] = params;
        const total = readTable('transactions')
          .filter(transaction => {
            const parts = monthAndYear(transaction.date);
            return transaction.amount > 0 && parts.month === month && parts.year === year;
          })
          .reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
        return { total };
      }
      return this.all(...params)[0];
    },

    run(...params) {
      if (normalized.startsWith('INSERT INTO accounts')) {
        return insert('accounts', {
          name: params[0],
          type: params[1],
          kind: params[2] || defaultAccountKind(params[1]),
          institution: params[3],
          balance: money(params[4]),
          currency: params[5] || 'USD',
          is_manual: 1,
          last_synced: null,
          created_at: nowSql(),
        });
      }
      if (normalized.startsWith('UPDATE accounts SET balance = ?, name = ?')) {
        let index = 2;
        const hasKind = normalized.includes('kind = ?');
        const hasType = normalized.includes('type = ?');
        const patch = {
          balance: money(params[0]),
          name: params[1],
          last_synced: nowSql(),
        };
        if (hasType) patch.type = params[index++];
        if (hasKind) patch.kind = params[index++] || 'asset';
        patch.institution = params[index++];
        return updateById('accounts', params[index], patch);
      }
      if (normalized === 'UPDATE accounts SET balance = ?, last_synced = datetime("now") WHERE id = ?') {
        return updateById('accounts', params[1], {
          balance: money(params[0]),
          last_synced: nowSql(),
        });
      }
      if (normalized === 'DELETE FROM accounts WHERE id = ?') return deleteById('accounts', params[0]);
      if (normalized.startsWith('INSERT INTO transactions')) {
        return insert('transactions', {
          account_id: params[0] === null || params[0] === undefined ? null : Number(params[0]),
          date: params[1],
          description: params[2] || '',
          amount: money(params[3]),
          category: params[4] || 'Uncategorized',
          source: normalized.includes('"bill"') ? 'bill' : 'manual',
          external_id: null,
          created_at: nowSql(),
        });
      }
      if (normalized === 'DELETE FROM transactions WHERE id = ?') return deleteById('transactions', params[0]);
      if (normalized.startsWith('INSERT INTO budgets')) {
        const category = params[0];
        if (readTable('budgets').some(budget => budget.category === category)) {
          throw new Error('Budget for this category already exists');
        }
        return insert('budgets', {
          category,
          monthly_limit: Number(params[1]) || 0,
          created_at: nowSql(),
        });
      }
      if (normalized === 'UPDATE budgets SET monthly_limit = ? WHERE id = ?') {
        return updateById('budgets', params[1], { monthly_limit: Number(params[0]) || 0 });
      }
      if (normalized === 'DELETE FROM budgets WHERE id = ?') return deleteById('budgets', params[0]);
      if (normalized.startsWith('INSERT INTO bills')) {
        return insert('bills', {
          name: params[0],
          amount: money(params[1]),
          due_day: Number(params[2]) || 1,
          category: params[3] || 'Bills',
          is_recurring: params[4] ? 1 : 0,
          is_paid: 0,
          next_due: null,
          created_at: nowSql(),
          is_last_day: params[5] ? 1 : 0,
          account_id: params[6] === null || params[6] === undefined ? null : Number(params[6]),
          last_paid_date: null,
        });
      }
      if (normalized.startsWith('UPDATE bills SET name = ?, amount = ?, due_day = ?, category = ?, is_paid = ?')) {
        const hasRecurring = normalized.includes('is_recurring = ?');
        const hasAccount = normalized.includes('account_id = ?');
        const idIndex = hasAccount ? 8 : hasRecurring ? 7 : 5;
        const patch = {
          name: params[0],
          amount: money(params[1]),
          due_day: Number(params[2]) || 1,
          category: params[3],
          is_paid: params[4] ? 1 : 0,
        };
        if (hasRecurring) {
          patch.is_recurring = params[5] ? 1 : 0;
          patch.is_last_day = params[6] ? 1 : 0;
        }
        if (hasAccount) {
          patch.account_id = params[7] === null || params[7] === undefined ? null : Number(params[7]);
        }
        return updateById('bills', params[idIndex], patch);
      }
      if (normalized === 'UPDATE bills SET is_paid = ?, last_paid_date = ? WHERE id = ?') {
        return updateById('bills', params[2], {
          is_paid: params[0] ? 1 : 0,
          last_paid_date: params[1],
        });
      }
      if (normalized === 'DELETE FROM bills WHERE id = ?') return deleteById('bills', params[0]);
      if (normalized.startsWith('INSERT INTO net_worth_snapshots')) {
        return insert('net_worth_snapshots', {
          date: params[0],
          assets: money(params[1]),
          liabilities: money(params[2]),
          net_worth: money(params[3]),
        });
      }
      throw new Error(`Unsupported CSV statement: ${normalized}`);
    },
  };
}

init();

module.exports = {
  prepare,
  exec() {},
  pragma() {},
};
