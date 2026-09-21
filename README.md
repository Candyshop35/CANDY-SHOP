# Candy Shop Boumerdès — Production-style Node.js + SQLite

This version keeps the existing Candy Shop Boumerdès website UI/features but replaces the insecure browser-only account/order persistence with a real server-side SQLite database.

## What is now stored centrally

- Customer, employee and owner accounts
- Password hashes (never plaintext passwords)
- Server-side login sessions
- Products
- Categories
- Business information
- Theme settings
- Role invitation keys
- Customer orders
- Order status changes

Customers no longer share accounts, orders or carts through browser storage. Each browser keeps its own cart, while submitted orders are saved centrally for the shop.

## Requirements

- **Node.js 22 or newer**
- npm

Node 22 is required because this build uses Node's built-in SQLite support. There are **no npm dependencies**, so `npm install` is intentionally fast and does not require Python, node-gyp, Visual Studio Build Tools, or native npm modules.

## Run it

1. Extract the ZIP.
2. Open Command Prompt/PowerShell in the extracted folder.
3. Run:

```text
npm install
npm start
```

4. Open:

```text
http://localhost:3000
```

Do **not** double-click `site/index.html`. The website must run through `server.js`.

## Default owner login

The first startup creates the protected owner account:

- Username: `INVYX`
- Password: `2705`

For a real deployment, set a different password **before the first startup** with the environment variable:

```text
CANDY_OWNER_PASSWORD=your-long-random-password
```

If the SQLite database has already been created, changing the environment variable does not change the existing password. Change the account through a proper password-management feature before production use.

## Database

The database is automatically created at:

```text
data/candy-shop.sqlite
```

It is a real SQLite database, not localStorage and not a JSON file.

The database survives:

- browser refreshes
- different devices
- different users
- server restarts
- computer restarts

## Security changes

The public website can read only public shop data. It cannot download all accounts, passwords, role keys or orders.

Owner-only server endpoints protect:

- user management
- role-key generation/revocation
- business/theme/product/category changes

Employee sessions can access orders but cannot perform owner-only account/key management.

Passwords are hashed with Node's built-in `crypto.scryptSync` and salted. Authentication uses an HttpOnly server-side session cookie.

## Legacy migration

If you place this new server beside an older version containing:

```text
data/candy-shop-state.json
```

the first startup automatically attempts a one-time migration into SQLite. Legacy plaintext passwords are immediately converted to password hashes. The old JSON file is renamed to:

```text
data/candy-shop-state.json.migrated
```

## Backups

Back up the entire `data/` folder, especially:

```text
data/candy-shop.sqlite
```

For a live production site, make regular backups rather than relying on the server's disk alone.

## Internet / 24-7 hosting

This server is ready to be deployed to a machine or hosting provider that runs Node.js continuously.

GitHub Pages cannot run this backend. Customers should access the Node server through your production domain.

For a real ordering website, use HTTPS. When deployed behind an HTTPS reverse proxy, set:

```text
NODE_ENV=production
```

The session cookie will then also receive the `Secure` flag.

## Health check

Open:

```text
http://localhost:3000/api/health
```

It should return JSON containing:

```json
{"ok":true,"database":"sqlite"}
```


## Production permission and cart fixes (2026-09-21)

- Employees are restricted to the Orders dashboard only.
- Employees cannot manage accounts, roles, role keys, products, site content, theme, or data tools.
- Employee order view is read-only; only the owner can change order status or delete orders.
- Server-side authorization enforces the same restrictions even if someone tries to call the API directly.
- Add-to-cart handling now uses a capture-phase controller so product buttons reliably add items to the cart even with the site's legacy modal/navigation handlers.
- SQLite remains the persistent server-side database; cart contents remain per-browser until checkout, while submitted orders are saved centrally.
