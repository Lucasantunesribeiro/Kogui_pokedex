"""Rotas principais da aplicação."""
from __future__ import annotations

from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from kogui_pokedex.views import health_check

urlpatterns = [
    path("", health_check, name="root"),
    path("admin/", admin.site.urls),
    # SimpleJWT endpoints canônicos
    path("authtoken", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("authtokenrefresh", TokenRefreshView.as_view(), name="token_refresh"),
    # Apps
    path("auth/", include("accounts.urls")),
    path("api/", include("api.urls")),
    path("health/", health_check, name="health"),
]
