<p align="center">
  <img src=".github/logo.png" width="320" alt="Tightarse" />
</p>

> [!WARNING]
> This project was built with AI assistance. Code may not meet production safety standards — review carefully before deploying in sensitive environments.
>
> **Note from the author:** This was made as a personal tool, and I'd like to share it with the community. Keep the app on your local network only, and/or behind a third-party auth layer if you're security conscious.

A self-hosted grocery price tracker and shopping assistant. Add items to your list, track prices across multiple Australian supermarkets, and let Tightarse tell you which store to shop at and in what order. Includes a simple checklist for your shopping trip and optional Amazon AU support via VPN proxy.

## Screenshots

<table>
  <tr>
    <td><img src="https://img.timhedley.com/image/d031c68f-764b-4fe3-975f-36f726889ff8.png" alt="Shopping list" /></td>
    <td><img src="https://img.timhedley.com/image/909affd1-8969-4144-b1f2-fbb2c7227b3c.png" alt="Journey view" /></td>
    <td><img src="https://img.timhedley.com/image/0c775778-2702-48d3-9822-e5512ae17bfe.png" alt="Checklist" /></td>
  </tr>
</table>

---

## Features

### Shopping List
- **Multi-store price tracking** — Track the same item across Woolworths, Coles, ALDI, Drakes, and Amazon AU
- **Paste a URL to add a product** — Supports direct product URLs or in-store search for supported stores
- **Price history** — Tracks price over time per product
- **Special / sale detection** — Highlights on-special prices and shows the previous was-price
- **Cup price (unit price)** — Shows price per 100g, per litre, etc. for easy comparison
- **Out of stock tracking** — Products are marked out of stock when no longer available; the item's cheapest in-stock alternative is used instead
- **Scheduled scraping** — Prices are automatically refreshed on a configurable interval (1h to weekly)
- **Per-user lists** — Each user has their own independent shopping list

### Journey
- **Optimised shopping route** — Groups your list by store, sorted by your preferred store order, with subtotals and an estimated trip total
- **Cheapest store per item** — Automatically picks the best-priced in-stock product for each item
- **Alternatives** — Expand any item to see what it costs at other stores
- **Collapsible store sections** — Tap a store heading to collapse it once you're done shopping there

### Checklist
- **Temporary scratch pad** — A simple checklist for your shopping trip; completely separate from the tracked list
- **Check off items** — Checked items sink to a strikethrough section at the bottom
- **Clear checked** — Remove all ticked items in one tap
- **Promote to Shopping List** — Tap the cart icon on any item to create a Shopping List entry and jump straight to the add-product search for it

### Stores
- **Supported stores** — Woolworths, Coles, ALDI, Drakes, Amazon AU (via VPN proxy)
- **Enable / disable stores** — Turn off stores you don't shop at
- **Reorder stores** — Drag to set your preferred store priority for the Journey view
- **Drakes store selector** — Pick which Drakes location to use

### Notifications
- **Price drop alerts** — Get notified when a tracked product drops below a threshold
- **Back-in-stock alerts** — Get notified when an out-of-stock product comes back
- **Channels** — Gotify, Discord webhook, or email (SMTP)

### System
- **Multi-user** — Invite additional users; the first account created becomes admin
- **Admin controls** — Manage users, stores, scrape interval, notification settings, and VPN proxy from Settings
- **VPN proxy support** — Route Amazon (or all) scraping through a gluetun HTTP proxy to protect your home IP
- **Dark mode** — Follows system preference
- **Mobile-first** — Designed for use on your phone while you're in the supermarket

---

## Installation

### Docker Compose (recommended)

```yaml
services:
  backend:
    image: incredibad/tightarse:latest
    restart: unless-stopped
    volumes:
      - tightarse_data:/data
    environment:
      - TZ=Australia/Brisbane   # set your local timezone

  frontend:
    image: incredibad/tightarse-frontend:latest
    restart: unless-stopped
    ports:
      - "7382:80"
    depends_on:
      - backend

volumes:
  tightarse_data:
```

Then run:

```bash
docker compose up -d
```

Open **http://your-server:7382** — you'll be prompted to create an admin account.

### Updating

```bash
docker compose pull && docker compose up -d
```

---

## Optional: Amazon AU via VPN Proxy

Amazon scraping requires an HTTP proxy to protect your home IP from bans. Tightarse uses [gluetun](https://github.com/qdm12/gluetun) for this.

Add gluetun to your `docker-compose.yml`:

```yaml
services:
  gluetun:
    image: qmcgaw/gluetun
    cap_add:
      - NET_ADMIN
    environment:
      - VPN_SERVICE_PROVIDER=privado   # or any gluetun-supported provider
      - OPENVPN_USER=${OPENVPN_USER}
      - OPENVPN_PASSWORD=${OPENVPN_PASSWORD}
      - SERVER_COUNTRIES=Australia
      - HTTPPROXY=on
    ports:
      - "8888:8888"
    restart: unless-stopped
```

Then in Tightarse Settings → Admin → VPN, set the **Proxy URL** to `http://your-server:8888` and optionally enable **Route all scraping through VPN**.

Amazon products will be hidden everywhere in the app until a proxy URL is configured.

---

## Environment Variables

No environment variables are required for basic operation. The JWT secret is auto-generated on first run and stored in the database.

| Variable | Required | Description |
|---|---|---|
| `TZ` | No | Timezone for scheduled scraping, e.g. `Australia/Brisbane`, `Europe/London` |
| `OPENVPN_USER` | No | VPN username (only needed if using gluetun for Amazon) |
| `OPENVPN_PASSWORD` | No | VPN password (only needed if using gluetun for Amazon) |

---

## First-Run Setup

1. Open the app and create your admin account
2. Go to **Settings → Stores** and enable the stores you shop at
3. Go to **Settings → Notifications** to configure price drop and back-in-stock alerts (optional)
4. Tap **+** on the Shopping List to add your first item — paste a product URL or search by name

---

## Data Persistence

| Path in volume | Contents |
|---|---|
| `tightarse.db` | SQLite database (items, products, prices, settings, users) |

All data lives inside the `tightarse_data` volume and survives updates.

---

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite, httpx, BeautifulSoup, APScheduler
- **Frontend**: React 18, React Router, Vite, Tailwind CSS, Lucide icons
- **Scraping**: Woolworths API, Coles API, ALDI web, Drakes web, Amazon AU (via proxy)

## License

MIT — see [LICENSE](LICENSE)
