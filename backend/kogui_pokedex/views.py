from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods


@require_http_methods(["GET"])
def health_check(_request):
    """Simple health probe used by Docker and observability checks."""
    return JsonResponse({"status": "ok"})
