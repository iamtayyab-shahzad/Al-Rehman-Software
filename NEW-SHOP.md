# Clone this system for another shop

This monorepo is **reusable**, but it is **not** multi-tenant SaaS.  
Each shop needs its **own database**, **own API**, and **own website/admin (and POS) deploys**.

You **do not** only change the menu and shop name inside one live Al-rehman deployment — that would mix orders and customers.

---

## What you change for branding + menu

| File | Purpose |
|------|---------|
| `shared/shop.json` | Shop name, phones, WhatsApp, order prefix, logo path, thank-you note, **`storageKeyPrefix`**, **`posDbName`**, payments info |
| `shared/menu.json` | Categories, products, sizes, images |

Then sync copies into the frontends:

```bash
node scripts/sync-shop-config.mjs
```

That copies `shared/shop.json` → `website`, `pos`, `admin` under `src/data/`,  
and `shared/menu.json` → `website` + `pos` under `src/data/`.

### Critical shop.json fields for a second shop

```json
{
  "name": "Your Shop Name",
  "shortName": "YourShop",
  "orderPrefix": "YS",
  "storageKeyPrefix": "yourshop",
  "posDbName": "yourshop-pos",
  "logo": "/logo.svg"
}
```

- **`orderPrefix`** — printed on order numbers (must differ per shop).  
- **`storageKeyPrefix` / `posDbName`** — POS browser storage. If two shops share a PC with the same values, tills will clash.

Replace `website/public/logo.svg` (and any brand icons) for the new shop.

---

## Checklist (new shop from this codebase)

### 1. Code / branding

- [ ] Copy or fork the repo (recommended: separate GitHub repo per shop).
- [ ] Edit `shared/shop.json` (name, phones, prefixes, logo, thank-you note).
- [ ] Replace `shared/menu.json` with that shop’s menu.
- [ ] Run `node scripts/sync-shop-config.mjs`.
- [ ] Commit (do **not** commit `.env` / secrets).

### 2. New cloud database

- [ ] Create a **new** Neon (or Supabase) project — **never** reuse Al-rehman’s `DATABASE_URL`.
- [ ] Copy the connection string for the new shop only.

### 3. New API (Render)

- [ ] New Render web service (Root Directory `backend`, Docker).
- [ ] Env: `APP_ENV=production`, new `DATABASE_URL`, new `JWT_SECRET`.
- [ ] Optional: Cloudinary / WhatsApp vars for this shop.
- [ ] Confirm `/health` returns ok.

### 4. Seed this shop’s data

From your PC against the **new** DB:

```bash
cd backend
# PowerShell
$env:DATABASE_URL="postgres://...new-shop..."
$env:JWT_SECRET="same-as-render"
go run ./cmd/seed
go run ./cmd/importmenu
go run ./cmd/seedinventory
```

- [ ] Change default `admin` / `staff` passwords immediately.

### 5. New frontends (Vercel)

Create **separate** Vercel projects for this shop:

| App | Root Directory | Key env |
|-----|----------------|---------|
| Website | `website` | `NEXT_PUBLIC_API_URL=https://THIS-SHOP-API/.../api/v1` |
| Admin | `admin` | same API URL (+ optional `NEXT_PUBLIC_POS_URL`) |
| POS (optional cloud fallback) | `pos` | same API URL |

`NEXT_PUBLIC_API_URL` **must** include `/api/v1` and point at **this shop’s** API only.

### 6. Shop till (local POS)

On the cashier PC:

- [ ] Run `pos\scripts\Setup-Local-POS.bat` with this shop’s API URL.
- [ ] Confirm `posDbName` in shop.json is unique if another shop’s POS ever ran on the same browser profile.

### 7. Smoke test

- [ ] Staff login on POS + Admin.
- [ ] Place a walk-in order offline/online; sync completes.
- [ ] Website guest order appears in Admin / Pending.
- [ ] Receipt shows the **new** shop name / thank-you note.
- [ ] Analytics / P&L only show **this** shop’s sales (separate DB).

---

## What “just change menu + name” does *not* cover

| Still required | Why |
|----------------|-----|
| New Postgres | Orders/customers must not mix |
| New API + JWT | Isolation + auth |
| New Vercel projects / domains | Frontends bake API URL at build time |
| Import menu into DB | JSON alone is not the live catalog |
| Unique `posDbName` | Local till IndexedDB isolation |

Admin can still edit products/settings later; the files above are the **starting** identity for a new install.

---

## Related docs

- Full first-time deploy: [`DEPLOYMENT.md`](./DEPLOYMENT.md)
- Local POS production notes: [`pos/docs/PRODUCTION.md`](./pos/docs/PRODUCTION.md)
