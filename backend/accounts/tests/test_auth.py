from __future__ import annotations

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class RegisterTests(APITestCase):
    def test_register_accepts_optional_password_confirm(self) -> None:
        url = reverse("accounts:register")
        payload_with_confirm = {
            "username": "misty",
            "email": "misty@example.com",
            "password": "S@nh4Segura!",
            "password_confirm": "S@nh4Segura!",
        }
        response = self.client.post(url, payload_with_confirm, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", response.data)

        payload_without_confirm = {
            "username": "brock",
            "email": "brock@example.com",
            "password": "S3nhaFort3!",
        }
        response = self.client.post(url, payload_without_confirm, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "brock")


class TokenTests(APITestCase):
    def setUp(self) -> None:
        self.password = "S3nh@Ultra!"
        self.user = User.objects.create_user(
            username="ash",
            email="ash@example.com",
            password=self.password,
        )

    def test_token_login_with_username(self) -> None:
        url = reverse("token_obtain_pair")
        response = self.client.post(
            url,
            {"username": self.user.username, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_token_login_invalid_credentials(self) -> None:
        url = reverse("token_obtain_pair")
        response = self.client.post(
            url,
            {"username": self.user.username, "password": "errado"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("detail", response.data)
