"""WSGI config for Kogui Pokédex."""
from __future__ import annotations

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kogui_pokedex.settings")

application = get_wsgi_application()
