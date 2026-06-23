import logging
import threading

_lock = threading.Lock()
_lines: list[str] = []
_MAX = 500


def _append(line: str):
    with _lock:
        _lines.append(line)
        if len(_lines) > _MAX:
            del _lines[:-_MAX]


def snapshot() -> tuple[list[str], int]:
    with _lock:
        return list(_lines), len(_lines)


def lines_from(pos: int) -> tuple[list[str], int]:
    with _lock:
        return list(_lines[pos:]), len(_lines)


class LogBufferHandler(logging.Handler):
    def emit(self, record):
        try:
            _append(self.format(record))
        except Exception:
            pass
