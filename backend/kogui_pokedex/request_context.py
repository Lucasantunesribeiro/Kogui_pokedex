"""Utilities for sharing request scoped data with log formatters."""
from __future__ import annotations

from contextvars import ContextVar

_request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)


def set_request_id(request_id: str) -> None:
    """Store the request id in the current context."""
    _request_id_var.set(request_id)


def get_request_id() -> str | None:
    """Return the current request id if available."""
    return _request_id_var.get()


def clear_request_id() -> None:
    """Remove the request id from the current context."""
    _request_id_var.set(None)
