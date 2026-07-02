# Changelog

All notable changes to this project will be documented here.

## [0.5.38] - 2026-07-02
### Changed
- Replaced the dollar-sign logo with a piggy-bank-and-coin logo across the nav bar, login screen, setup screen, favicon, and PWA icons
- Brand accent colour changed from green to gold, matching the coin in the new logo
- All headers now use the Fredoka font; introduced semantic `.logo-wordmark`, `.page-header`, `.section-header`, and `.modal-header` CSS classes instead of repeating utility class combos everywhere
- Page titles (Shopping List, Checklist, Journey, Settings) moved out of each page body and into the nav bar, right-aligned in a subtly shaded half, in a smaller uppercase style — saves vertical space on every screen. Child screens (item detail, add product, product history) show "Shopping List" as their nav title
- Journey's Estimated total, Reset, and Checklist toggle now share a single compact row instead of stacking across two
- Shopping List's filter input and refresh/add-item buttons are now inline on one row
- Swapped the shopping-cart icon for a list-plus icon on "track to Shopping List" buttons — clearer that it adds to a list rather than a checkout
### Added
- Add Product search box auto-fills with the new item's name when arriving from the Shopping List "Add item" form or a checklist "track" action
- Bottom nav's List tab now stays highlighted while viewing any item detail/add-product/product-history screen
- Store accordion headers on the Journey page align with the item rows below them (matching chevron column + vertical divider)

## [0.5.23] - 2026-07-01
### Added
- Admin Users tab shows last login time and an online/"seen X ago" indicator per user
- Explanatory text on the Notifications tab describing how price drop alerts work
- Inline rename for shopping list items via a pencil icon in the item header
### Fixed
- ALDI scraper impersonates Chrome's TLS fingerprint (via curl_cffi) to bypass 403 blocks
- Log timestamps now include the date, not just the time
- Checklist "show checklist" button uses an Eye/EyeOff icon reflecting the action rather than the current state
- Suppressed noisy httpx request logging so scheduled scrape logs aren't buried

## [0.5.13] - 2026-06-30
### Added
- Coles store picker — search by postcode and pick your local store inline in Settings → Stores, replacing manual store ID entry
- Drakes store picker — same inline postcode search + tooltip UX as Coles
- Checklist fully replicated on the Journey page as a collapsible accordion, with tap-to-check, persisted checked state, and a "track to Shopping List" action with a confirmation modal
### Fixed
- Coles scrape requests now pass the `fulfillmentStoreId` cookie so results match the configured store
- Coles store search uses the ColesScraper's own client for the GraphQL call
- Store-picker layout/styling fixes — inline postcode input+button, dropdown results, button contrast

## [0.5.0] - 2026-06-23
### Added
- Scrape run history persisted to DB — survives container restarts; shown in a "Show all" modal with per-run ok/failed counts
- Persistent log file at `/data/tightarse.log` with 7-day rotation — logs survive restarts and rebuilds
- Log level filter buttons (ALL / INFO / WARN / ERROR) in the Logs section
- Shopping list filter input — type to narrow items in real time
- OOS and inactive products now sink to the bottom of the item product list (sorted: cheapest in-stock → OOS → disabled)
- 404 responses mark the product out of stock immediately rather than leaving its last-known state

### Changed
- Scrape stats (last run time, ok/failed counts) now read from DB instead of in-memory — no more "No scrape run yet" after a restart
- Failed scrapes log at WARN; application errors (DB, notifications) log at ERROR
- Product names included in all scrape log messages so failures can be identified without looking up the ID
- Reduced padding across ShoppingList, ItemDetail, and Journey views for better density
- Logs section matches the card styling of other settings sections

## [0.4.0] - 2026-06-23
### Changed
- Scrape schedule is now configured as a type rather than a raw hour count:
  Every 6h, Every 12h, Daily at HH:MM, Every 2 days at HH:MM, Weekly on day at HH:MM
- APScheduler uses CronTrigger for time-based schedules, IntervalTrigger for interval ones

## [0.3.8] - 2026-06-23
### Added
- VPN status panel in Admin → Network showing exit IP, ISP/org, and location for the most recent connectivity check
- VPN check history table (last 50 checks) so you can see when the VPN server changed or rotated
- Connectivity check now uses ipinfo.io to return richer data (ISP name, city, country) instead of just the IP
- History is auto-loaded when the Network tab opens; "Check now" refreshes it immediately

## [0.3.7] - 2026-06-23
### Fixed
- `test_email` ran blocking `smtplib` calls on the async event loop, freezing all requests for up to 10 seconds — moved to a thread executor
- DB sessions were held open during HTTP scrape calls in `preview_url` and `search_store` — now closed before the network call
- `rescrape_item` and `rescrape_all` double-closed the FastAPI-managed DB session — now manage their own sessions

## [0.3.6] - 2026-06-23
### Fixed
- Scheduled scrape now runs up to 6 URLs concurrently (semaphore-limited) instead of sequentially — hundreds of products no longer take hours per cycle
- Scheduler job has `max_instances=1` + `coalesce=True` — a slow run can no longer overlap with the next scheduled trigger
- Single shared semaphore across scheduler and manual rescrape triggers prevents total concurrency exceeding 6

## [0.3.5] - 2026-06-23
### Fixed
- DB connection pool exhaustion causing app-wide unresponsiveness during scraping
  - Switched SQLite engine to `NullPool` (SQLite doesn't benefit from pooling)
  - DB sessions are now closed before HTTP scrape requests and reopened only to write results
  - Manual rescrape endpoints capped at 4 concurrent scrapes via semaphore (was unbounded)

## [0.3.4] - 2026-06-23
### Added
- Admin settings now has sub-tabs (General, Network, Email, Users, Logs) to reduce clutter
- Logs tab streams real-time backend logs with timestamps and colour-coded severity; supports pause and clear

## [0.3.3] - 2026-06-23
### Fixed
- "Route all scraping through VPN" toggle now persists across page refreshes — stale per-user setting rows were shadowing the global value in the API response

## [0.3.2] - 2026-06-23
### Fixed
- Woolworths Everyday Market (third-party seller) products are now excluded from search results and raise a clear error when added by URL

## [0.3.1] - 2026-06-23
### Added
- Cup price inference from product name — when a store doesn't provide a unit price, it is calculated from the size in the product name (e.g. "950ml", "500g") across all scrapers
- Count-based unit pricing — products like toilet paper, tablets, and wipes now display per 100 sheets / per 100 units rather than per 100ml

### Changed
- Frontend and backend combined into a single Docker container (no more separate nginx container)

### Fixed
- Favicon, manifest, and PWA icons now load correctly after the container consolidation
- "Per ea" items (tablets, capsules, etc.) correctly display as "per unit" not "per sheet"

## [0.3.0] - 2026-06-23
### Added
- **Checklist** — per-user scratch pad tab; check off items (strikethrough + sink), inline editing, clear all checked, promote to Shopping List
- **Price history** — full SVG line chart, low/high/current stats, and price table per product; accessible from the ⋮ menu
- **Amazon AU** — manual URL scraping via gluetun VPN proxy to protect your home IP
- Version link in Settings header linking to the GitHub repo
- GitHub Actions CI — builds and pushes to Docker Hub on `main` (`:latest`), `dev` (`:dev`), and version tags

## [0.2.0] - 2026-06-23
### Added
- User authentication (JWT) with multi-user support and admin controls
- Multi-store tracking — Woolworths, Coles, ALDI, Drakes
- Out-of-stock tracking — OOS products are flagged; Journey uses cheapest in-stock alternative
- Scheduled scraping with configurable interval
- Price drop and back-in-stock notifications (Gotify, Discord, email)
- VPN proxy setting to optionally route all scraping through gluetun
- Dark mode toggle

## [0.1.0] - 2026-06-07
### Added
- Initial scaffold — shopping list, product URL scraping, Journey view, Settings
