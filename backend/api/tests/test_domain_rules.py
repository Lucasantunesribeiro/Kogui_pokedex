from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Favorite, TeamSlot

User = get_user_model()

# Resposta padrão de get_pokemon usada em todos os testes desta suite.
# Evita chamadas reais à PokéAPI durante os testes unitários.
_MOCK_POKEMON = {
    "id": 25,
    "name": "pikachu",
    "types": ["electric"],
    "sprite": "https://example.com/pikachu.png",
    "stats": {"hp": 35, "attack": 55, "defense": 40},
}


def _make_mock_pokemon(pokemon_id: int) -> dict:
    """Retorna um pokemon mockado com o id fornecido."""
    return {**_MOCK_POKEMON, "id": pokemon_id, "name": f"pokemon-{pokemon_id}"}


@patch("api.serializers.get_pokemon", side_effect=_make_mock_pokemon)
class FavoriteDomainTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="misty",
            email="misty@example.com",
            password="S3nhaFort3!",
        )
        self.client.force_authenticate(self.user)
        self.url = reverse("api:favorite-list")

    def test_prevents_duplicate_favorites(self, _mock_pokemon) -> None:
        payload = {"pokemon_id": 25}
        first_response = self.client.post(self.url, payload, format="json")
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Favorite.objects.filter(user=self.user).count(), 1)

        second_response = self.client.post(self.url, payload, format="json")
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pokemon_id", second_response.data)
        self.assertEqual(Favorite.objects.filter(user=self.user).count(), 1)


@patch("api.serializers.get_pokemon", side_effect=_make_mock_pokemon)
class TeamDomainTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            username="brock",
            email="brock@example.com",
            password="Sup3rS3nh@",
        )
        self.client.force_authenticate(self.user)
        self.set_url = reverse("api:team-set")
        self.list_url = reverse("api:team-list")

    def test_accepts_unique_team_within_limit(self, _mock_pokemon) -> None:
        payload = {"pokemon_ids": [1, 4, 7]}
        response = self.client.post(self.set_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        self.assertListEqual([slot["slot"] for slot in response.data], [1, 2, 3])
        self.assertListEqual(
            [slot["pokemon_id"] for slot in response.data],
            payload["pokemon_ids"],
        )

    def test_rejects_duplicate_pokemon_ids(self, _mock_pokemon) -> None:
        response = self.client.post(
            self.set_url,
            {"pokemon_ids": [10, 10]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pokemon_ids", response.data)
        self.assertEqual(TeamSlot.objects.filter(user=self.user).count(), 0)

    def test_rejects_team_larger_than_six(self, _mock_pokemon) -> None:
        response = self.client.post(
            self.set_url,
            {"pokemon_ids": [1, 2, 3, 4, 5, 6, 7]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pokemon_ids", response.data)

    def test_overwrites_existing_team_normally(self, _mock_pokemon) -> None:
        initial = {"pokemon_ids": [1, 2, 3, 4, 5, 6]}
        updated = {"pokemon_ids": [7, 8, 9]}

        first_response = self.client.post(self.set_url, initial, format="json")
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(TeamSlot.objects.filter(user=self.user).count(), 6)

        second_response = self.client.post(self.set_url, updated, format="json")
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(TeamSlot.objects.filter(user=self.user).count(), 3)
