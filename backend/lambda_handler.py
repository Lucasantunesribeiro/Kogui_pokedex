"""AWS Lambda handler usando Mangum para adaptar Django ASGI ao API Gateway."""
from __future__ import annotations

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kogui_pokedex.settings")

from django.core.asgi import get_asgi_application  # noqa: E402
from mangum import Mangum  # noqa: E402

application = get_asgi_application()

# Mangum 0.19+ é ASGI-only; Django suporta ASGI nativamente desde 3.0
handler = Mangum(application, lifespan="off")
