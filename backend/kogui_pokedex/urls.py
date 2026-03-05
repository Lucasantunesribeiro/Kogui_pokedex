"""Rotas principais da aplicação."""
from __future__ import annotations

from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from kogui_pokedex.views import health_check


class LoginView(TokenObtainPairView):
    """TokenObtainPairView com throttle específico para login (10/min)."""
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


urlpatterns = [
    path("", health_check, name="root"),
    path("admin/", admin.site.urls),
    # SimpleJWT endpoints canônicos
    path("api/token/", LoginView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Apps
    path("auth/", include("accounts.urls")),
    path("api/", include("api.urls")),
    path("health/", health_check, name="health"),
]

# OpenAPI Schema & Docs — apenas em DEBUG para não expor a API em produção
if settings.DEBUG:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
        path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    ]
