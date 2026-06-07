from .woolworths import WoolworthsScraper
from .coles import ColesScraper
from .aldi import ALDIScraper
from .iga import IGAScraper
from .base import BaseScraper, ScrapeResult

SCRAPERS: dict[str, type[BaseScraper]] = {
    "woolworths": WoolworthsScraper,
    "coles": ColesScraper,
    "aldi": ALDIScraper,
    "iga": IGAScraper,
}


def get_scraper(module_name: str) -> BaseScraper:
    cls = SCRAPERS.get(module_name)
    if cls is None:
        raise ValueError(f"Unknown scraper module: {module_name}")
    return cls()
