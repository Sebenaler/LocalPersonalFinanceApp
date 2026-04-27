# Personal Wealth App

A local-first personal finance dashboard for tracking account balances, bills, transactions, budgets, and net worth. The app uses CSV files as its local database, so your financial data stays on your machine by default.

## Features

- Dashboard with net worth, monthly spending, income, account balances, and upcoming bills
- Portfolio view for all account balances, assets, liabilities, and net worth
- Account tracking for assets and liabilities, including credit cards and loans
- Transactions page for purchases, deposits/income, and debt payments
- Bills page with recurring due dates, last-day-of-month support, and optional auto-subtract from an account
- Budgets by spending category
- CSV-backed local storage in `server/data`

## Tech Stack

- React + Vite
- Express
- pnpm workspaces
- CSV files for local persistence

## Requirements

Install these first:

- Node.js 18 or newer
- pnpm

If you do not have pnpm installed:

```bash
npm install -g pnpm
```

## Getting Started

Clone the repo:

```bash
git clone https://github.com/YOUR_USERNAME/personal-wealth-app.git
cd personal-wealth-app
```

Install dependencies:

```bash
pnpm install
```

Start the app:

```bash
pnpm dev
```

Open:

- App: http://localhost:5173
- API: http://localhost:3001

## Local Data Storage

The app stores data in CSV files under:

```text
server/data/
```

The server creates these files automatically when it starts:

- `accounts.csv`
- `transactions.csv`
- `budgets.csv`
- `bills.csv`
- `net_worth_snapshots.csv`

These files are intentionally ignored by Git because they can contain private financial data.

## Important Privacy Note

Do not commit your personal financial data.

The `.gitignore` should include:

```gitignore
server/data/*.csv
```

Before pushing to GitHub, check what will be committed:

```bash
git status
git diff --cached --name-only
```

Make sure files inside `server/data` are not included.

## How Account Balances Work

Accounts have a `kind` of either `asset` or `liability`.

Asset account examples:

- checking
- savings
- 401k
- Roth IRA

Liability account examples:

- credit card
- loan

The account type is a label, while kind controls balance math. This means custom types such as `hsa`, `cash`, `mortgage`, or `line_of_credit` can still behave correctly as long as their kind is set correctly.

Transactions update balances automatically:

- Purchase from checking/savings: balance goes down
- Deposit to checking/savings: balance goes up
- Charge on a liability account: balance owed goes up
- Payment to a liability account: balance owed goes down

## Bills

Bills can be recurring and can optionally be linked to an account.

If a bill is due and has a pay-from account selected, the app will:

- subtract or apply the bill amount to the selected account
- create a bill transaction
- mark the bill as paid for that due date so it does not double-charge on refresh

The auto-pay check runs when the API is accessed, such as when opening the Dashboard or Bills page. It is not a background job while the app is fully closed.

## Available Scripts

Run the full app in development:

```bash
pnpm dev
```

Install all workspace dependencies:

```bash
pnpm install
```

Build the client:

```bash
pnpm --filter client build
```

Run only the server:

```bash
pnpm --filter server dev
```

Run only the client:

```bash
pnpm --filter client dev
```

## Project Structure

```text
client/              React app
server/              Express API
server/db/           CSV database adapter
server/routes/       API routes
server/data/         Local CSV data, gitignored
```

## Disclaimer

This is a personal finance tracking project, not financial advice. It is intended for local use and personal learning. Review the code and data handling before using it with sensitive information.
