from __future__ import annotations

from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework import serializers

from api.pokeapi_service import list_pokemon
from api.serializers import TeamSetSerializer


class ListPokemonTests(SimpleTestCase):
    @patch("api.pokeapi_service.get_pokemon")
    @patch("api.pokeapi_service._fetch_json")
    def test_list_pokemon_defaults(self, mock_fetch_json, mock_get_pokemon) -> None:
        mock_fetch_json.return_value = {
            "count": 1,
            "results": [{"name": "bulbasaur"}],
        }
        mock_get_pokemon.return_value = {
            "id": 1,
            "name": "bulbasaur",
            "types": ["grass", "poison"],
            "sprite": "sprite-url",
        }

        payload = list_pokemon(limit=200, offset=-10)

        self.assertEqual(payload["count"], 1)
        self.assertEqual(len(payload["results"]), 1)
        mock_fetch_json.assert_called_once_with("pokemon?limit=50&offset=0")

    @patch("api.pokeapi_service.get_pokemon")
    @patch("api.pokeapi_service.get_generation_catalog")
    def test_list_pokemon_generation_filters(self, mock_generation_catalog, mock_get_pokemon) -> None:
        mock_generation_catalog.return_value = [
            {"id": 1, "name": "bulbasaur"},
            {"id": 2, "name": "ivysaur"},
            {"id": 3, "name": "venusaur"},
        ]
        mock_get_pokemon.side_effect = [
            {"id": 2, "name": "ivysaur", "types": ["grass"], "sprite": "a"},
            {"id": 3, "name": "venusaur", "types": ["grass"], "sprite": "b"},
        ]

        payload = list_pokemon(generation=1, limit=2, offset=1)

        self.assertEqual(payload["count"], 3)
        self.assertEqual(len(payload["results"]), 2)
        self.assertEqual(payload["results"][0]["id"], 2)
        mock_generation_catalog.assert_called_once_with(1)


class TeamSerializerTests(SimpleTestCase):
    def test_team_serializer_accepts_up_to_six_unique_ids(self) -> None:
        serializer = TeamSetSerializer(data={"pokemon_ids": [1, 2, 3]})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_team_serializer_rejects_duplicates(self) -> None:
        serializer = TeamSetSerializer(data={"pokemon_ids": [1, 1]})
        self.assertFalse(serializer.is_valid())
        self.assertIn("pokemon_ids", serializer.errors)

    def test_team_serializer_rejects_team_overflow(self) -> None:
        serializer = TeamSetSerializer(data={"pokemon_ids": [1, 2, 3, 4, 5, 6, 7]})
        with self.assertRaises(serializers.ValidationError):
            serializer.is_valid(raise_exception=True)
