from .woolworths import WoolworthsScraper
from .coles import ColesScraper
from .aldi import ALDIScraper
from .drakes import DrakesScraper
from .amazon import AmazonScraper
from .base import BaseScraper, ScrapeResult

SCRAPERS: dict[str, type[BaseScraper]] = {
    "woolworths": WoolworthsScraper,
    "coles": ColesScraper,
    "aldi": ALDIScraper,
    "drakes": DrakesScraper,
    "amazon": AmazonScraper,
}

SEARCH_SUPPORTED: set[str] = {"woolworths", "coles", "aldi", "drakes"}


def get_scraper(module_name: str, **kwargs) -> BaseScraper:
    cls = SCRAPERS.get(module_name)
    if cls is None:
        raise ValueError(f"Unknown scraper module: {module_name}")
    return cls(**kwargs)


def supports_search(module_name: str) -> bool:
    return module_name in SEARCH_SUPPORTED
