# Personal Wealth App - Setup

## For normal users

Download the desktop installer for your operating system, install it, and open **Personal Wealth App**.

No terminal commands are needed. The desktop app runs the API on your computer and stores CSV data in your user app data folder.

## For developers

### First-time setup

```bash
cd personal-wealth-app
pnpm install
```

### Run the browser development app

```bash
pnpm dev
```

- **App:** http://localhost:5173
- **API:** http://localhost:3001

### Run the desktop development app

```bash
pnpm desktop:dev
```

### Build a desktop installer

```bash
pnpm desktop:dist
```

Installers are written to `dist-desktop/`.

## Local CSV data

In browser development, the API stores app data in `server/data/*.csv` files.

In the packaged desktop app, data is stored in the operating system's per-user app data folder:

- Windows: `%APPDATA%/Personal Wealth App/data`
- macOS: `~/Library/Application Support/Personal Wealth App/data`
- Linux: `~/.config/Personal Wealth App/data`

The CSV files are:

- `accounts.csv`
- `transactions.csv`
- `budgets.csv`
- `bills.csv`
- `net_worth_snapshots.csv`

These files are created automatically the first time the server starts. You can back them up or edit them directly when the server is stopped.
