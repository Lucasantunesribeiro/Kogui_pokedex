from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class PasswordResetTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="ash",
            email="ash@example.com",
            password="S3nh@Ultra!",
        )

    def test_password_reset_request_valid_email(self) -> None:
        """Testa solicitação de reset com email válido"""
        url = reverse("accounts:password_reset")
        payload = {"email": self.user.email}

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.data)
        self.assertIn("enviado", response.data["detail"])

    def test_password_reset_request_invalid_email(self) -> None:
        """Testa solicitação de reset com email inexistente"""
        url = reverse("accounts:password_reset")
        payload = {"email": "inexistente@example.com"}

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_password_reset_confirm_valid_token(self) -> None:
        """Testa confirmação de reset com token válido"""
        # Gerar token válido
        token_generator = PasswordResetTokenGenerator()
        token = token_generator.make_token(self.user)
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        url = reverse("accounts:password_reset_confirm")
        payload = {
            "uid": uid,
            "token": token,
            "new_password": "NovaSenha123!",
            "new_password_confirm": "NovaSenha123!"
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.data)
        self.assertIn("redefinida", response.data["detail"])

        # Verificar se a senha foi alterada
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NovaSenha123!"))

    def test_password_reset_confirm_invalid_token(self) -> None:
        """Testa confirmação de reset com token inválido"""
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        url = reverse("accounts:password_reset_confirm")
        payload = {
            "uid": uid,
            "token": "token-invalido",
            "new_password": "NovaSenha123!",
            "new_password_confirm": "NovaSenha123!"
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("token", response.data)

    def test_password_reset_confirm_mismatched_passwords(self) -> None:
        """Testa confirmação com senhas não coincidentes"""
        token_generator = PasswordResetTokenGenerator()
        token = token_generator.make_token(self.user)
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        url = reverse("accounts:password_reset_confirm")
        payload = {
            "uid": uid,
            "token": token,
            "new_password": "NovaSenha123!",
            "new_password_confirm": "SenhaDiferente123!"
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PasswordChangeTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="ash",
            email="ash@example.com",
            password="S3nh@Ultra!",
        )
        self.client.force_authenticate(user=self.user)

    def test_password_change_success(self) -> None:
        """Testa alteração de senha com sucesso"""
        url = reverse("accounts:password_change")
        payload = {
            "current_password": "S3nh@Ultra!",
            "new_password": "NovaSenha123!",
            "new_password_confirm": "NovaSenha123!"
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar se a senha foi alterada
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NovaSenha123!"))

    def test_password_change_wrong_current_password(self) -> None:
        """Testa alteração com senha atual incorreta"""
        url = reverse("accounts:password_change")
        payload = {
            "current_password": "SenhaErrada!",
            "new_password": "NovaSenha123!",
            "new_password_confirm": "NovaSenha123!"
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)

    def test_password_change_requires_authentication(self) -> None:
        """Testa que alteração de senha requer autenticação"""
        self.client.force_authenticate(user=None)

        url = reverse("accounts:password_change")
        payload = {
            "current_password": "S3nh@Ultra!",
            "new_password": "NovaSenha123!",
            "new_password_confirm": "NovaSenha123!"
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)