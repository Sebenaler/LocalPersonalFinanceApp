# Personal Wealth App - Setup

## First-time setup

```bash
cd personal-wealth-app
pnpm install
```

## Run the app

```bash
pnpm dev
```

- **App:** http://localhost:5173
- **API:** http://localhost:3001

## Local CSV data

The API stores app data in `server/data/*.csv` files:

- `accounts.csv`
- `transactions.csv`
- `budgets.csv`
- `bills.csv`
- `net_worth_snapshots.csv`

These files are created automatically the first time the server starts. You can back them up or edit them directly when the server is stopped.
