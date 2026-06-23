# Changelog

All notable changes to this project will be documented here.

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
