from __future__ import annotations

from django.urls import path

from .views import (
    AdminUserCreateView,
    AdminUserDeleteView,
    AdminUserDetailView,
    CurrentUserView,
    PasswordChangeView,
    PasswordResetView,
    PasswordResetConfirmView,
    RegisterView,
    UserListView,
)

app_name = "accounts"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", CurrentUserView.as_view(), name="me"),
    path("password/change/", PasswordChangeView.as_view(), name="password_change"),
    path("password/reset/", PasswordResetView.as_view(), name="password_reset"),
    path("password/reset/confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("users/", UserListView.as_view(), name="user_list"),
    path("users/create/", AdminUserCreateView.as_view(), name="admin_user_create"),
    path("users/<int:pk>/", AdminUserDetailView.as_view(), name="admin_user_detail"),
    path("users/<int:pk>/delete/", AdminUserDeleteView.as_view(), name="admin_user_delete"),
]
