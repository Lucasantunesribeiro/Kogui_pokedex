"""Rotas principais da aplicação."""
from __future__ import annotations

from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.views import (
    CurrentUserView,
    PasswordChangeView,
    RegisterView,
    UserListView,
)
from kogui_pokedex.views import health_check

urlpatterns = [
    path("", health_check, name="root"),
    path("admin/", admin.site.urls),
    path("authregister", RegisterView.as_view(), name="auth-register"),
    path("authme", CurrentUserView.as_view(), name="auth-me"),
    path("authpasswordchange", PasswordChangeView.as_view(), name="auth-password-change"),
    path("authusers", UserListView.as_view(), name="auth-user-list"),
    path("authtoken", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("authtokenrefresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/", include("accounts.urls")),
    path("api/", include("api.urls")),
    path("health/", health_check, name="health"),
]
