from __future__ import annotations

from django.urls import path

from .views import CurrentUserView, PasswordChangeView, RegisterView, UserListView

app_name = "accounts"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", CurrentUserView.as_view(), name="me"),
    path("password/change/", PasswordChangeView.as_view(), name="password_change"),
    path("users/", UserListView.as_view(), name="user_list"),
]
