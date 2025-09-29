from __future__ import annotations

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class AdminUserManagementTests(APITestCase):
    def setUp(self) -> None:
        # Criar usuário administrador
        self.admin_user = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="AdminPass123!",
            is_staff=True
        )

        # Criar usuário normal
        self.normal_user = User.objects.create_user(
            username="user",
            email="user@example.com",
            password="UserPass123!"
        )

    def test_list_users_requires_admin(self) -> None:
        """Testa que listagem de usuários requer privilégios admin"""
        # Usuário normal não pode listar usuários
        self.client.force_authenticate(user=self.normal_user)
        url = reverse("accounts:admin_user_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Admin pode listar usuários
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 2)  # admin + normal user

    def test_create_user_success(self) -> None:
        """Testa criação de usuário por admin"""
        self.client.force_authenticate(user=self.admin_user)

        url = reverse("accounts:admin_user_create")
        payload = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "NewPass123!",
            "password_confirm": "NewPass123!",
            "is_staff": False
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "newuser")
        self.assertEqual(response.data["email"], "newuser@example.com")
        self.assertFalse(response.data["is_staff"])

        # Verificar se usuário foi criado no banco
        new_user = User.objects.get(username="newuser")
        self.assertTrue(new_user.check_password("NewPass123!"))

    def test_create_user_admin_privilege(self) -> None:
        """Testa criação de usuário admin"""
        self.client.force_authenticate(user=self.admin_user)

        url = reverse("accounts:admin_user_create")
        payload = {
            "username": "newadmin",
            "email": "newadmin@example.com",
            "password": "AdminPass123!",
            "password_confirm": "AdminPass123!",
            "is_staff": True
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["is_staff"])

        # Verificar se usuário tem privilégios admin
        new_admin = User.objects.get(username="newadmin")
        self.assertTrue(new_admin.is_staff)

    def test_create_user_password_mismatch(self) -> None:
        """Testa criação com senhas não coincidentes"""
        self.client.force_authenticate(user=self.admin_user)

        url = reverse("accounts:admin_user_create")
        payload = {
            "username": "testuser",
            "password": "Pass123!",
            "password_confirm": "DifferentPass123!",
            "is_staff": False
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_user_success(self) -> None:
        """Testa atualização de usuário"""
        self.client.force_authenticate(user=self.admin_user)

        url = reverse("accounts:admin_user_detail", kwargs={"pk": self.normal_user.pk})
        payload = {
            "username": "updated_user",
            "email": "updated@example.com",
            "is_staff": True
        }

        response = self.client.put(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "updated_user")
        self.assertEqual(response.data["email"], "updated@example.com")
        self.assertTrue(response.data["is_staff"])

        # Verificar se foi atualizado no banco
        self.normal_user.refresh_from_db()
        self.assertEqual(self.normal_user.username, "updated_user")
        self.assertTrue(self.normal_user.is_staff)

    def test_delete_user_success(self) -> None:
        """Testa exclusão de usuário"""
        self.client.force_authenticate(user=self.admin_user)

        url = reverse("accounts:admin_user_detail", kwargs={"pk": self.normal_user.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verificar se usuário foi removido
        self.assertFalse(User.objects.filter(pk=self.normal_user.pk).exists())

    def test_delete_self_prevention(self) -> None:
        """Testa prevenção de auto-exclusão"""
        self.client.force_authenticate(user=self.admin_user)

        url = reverse("accounts:admin_user_detail", kwargs={"pk": self.admin_user.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("próprio", response.data["detail"])

        # Verificar se admin ainda existe
        self.assertTrue(User.objects.filter(pk=self.admin_user.pk).exists())

    def test_non_admin_cannot_manage_users(self) -> None:
        """Testa que usuário normal não pode gerenciar outros usuários"""
        self.client.force_authenticate(user=self.normal_user)

        # Não pode criar usuário
        create_url = reverse("accounts:admin_user_create")
        response = self.client.post(create_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Não pode atualizar usuário
        update_url = reverse("accounts:admin_user_detail", kwargs={"pk": self.admin_user.pk})
        response = self.client.put(update_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Não pode deletar usuário
        response = self.client.delete(update_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_access(self) -> None:
        """Testa que usuário não autenticado não pode acessar"""
        # Sem autenticação
        urls = [
            reverse("accounts:admin_user_list"),
            reverse("accounts:admin_user_create"),
            reverse("accounts:admin_user_detail", kwargs={"pk": self.normal_user.pk})
        ]

        for url in urls:
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)