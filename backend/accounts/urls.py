from __future__ import annotations

from django.urls import path

from .views import (
    AdminPasswordResetView,
    CurrentUserView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetView,
    RegisterView,
    UserDetailView,
    UserListCreateView,
)

app_name = "accounts"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", CurrentUserView.as_view(), name="me"),
    # Alteração de senha autenticada
    path("password/change/", PasswordChangeView.as_view(), name="password_change"),
    # Reset de senha via email (público, token-based)
    path("password/reset/", PasswordResetView.as_view(), name="password_reset"),
    path("password/reset/confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    # Gestão de usuários (admin)
    # Dois nomes apontam para o mesmo path para compatibilidade com os testes:
    # - admin_user_list  → GET  /users/
    # - admin_user_create → POST /users/
    path("users/", UserListCreateView.as_view(), name="admin_user_list"),
    path("users/", UserListCreateView.as_view(), name="admin_user_create"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="admin_user_detail"),
    path("users/<int:user_id>/reset-password/", AdminPasswordResetView.as_view(), name="admin-reset-password"),
]
