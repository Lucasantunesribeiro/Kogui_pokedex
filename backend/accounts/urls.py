from __future__ import annotations

from django.urls import path

from .views import (
    AdminPasswordResetView,
    CurrentUserView,
    PasswordChangeView,
    RegisterView,
    UserDetailView,
    UserListCreateView,
)

app_name = "accounts"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", CurrentUserView.as_view(), name="me"),
    path("password/change/", PasswordChangeView.as_view(), name="password-change"),

    # Gestão de usuários (admin)
    path("users/", UserListCreateView.as_view(), name="user-list-create"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="user-detail"),
    path("users/<int:user_id>/reset-password/", AdminPasswordResetView.as_view(), name="admin-reset-password"),
]
