"""Structured logging helpers for the project."""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict

from .request_context import get_request_id


class JsonFormatter(logging.Formatter):
    """Emit log records as structured JSON lines."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: D401
        payload: Dict[str, Any] = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = getattr(record, "request_id", None) or get_request_id()
        if request_id:
            payload["request_id"] = request_id

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        for key in ("method", "path", "event", "status_code", "extra_data"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value

        return json.dumps(payload, ensure_ascii=False)


class RequestIdFilter(logging.Filter):
    """Inject the current request id into log records."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: D401
        if not getattr(record, "request_id", None):
            record.request_id = get_request_id()
        return True
