"""Custom middleware for observability features."""
from __future__ import annotations

import logging
import uuid
from typing import Callable

from django.http import HttpRequest, HttpResponse

from .request_context import clear_request_id, set_request_id

logger = logging.getLogger(__name__)


class RequestIDMiddleware:
    """Attach a request id to every request and response."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        request.request_id = request_id
        set_request_id(request_id)

        logger.info("request.received", extra={"method": request.method, "path": request.path})

        response: HttpResponse | None = None
        try:
            response = self.get_response(request)
            return response
        finally:
            logger.info(
                "request.completed",
                extra={
                    "method": request.method,
                    "path": request.path,
                    "status_code": getattr(response, "status_code", None),
                },
            )
            if response is not None:
                response.headers["X-Request-ID"] = request_id
            clear_request_id()
