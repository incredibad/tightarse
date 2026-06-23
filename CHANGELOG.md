# Changelog

All notable changes to this project will be documented here.

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
