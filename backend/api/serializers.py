from __future__ import annotations

from typing import Any

from django.db import IntegrityError
from rest_framework import serializers

from .models import Favorite, TeamSlot
from .pokeapi_service import PokeAPIError, get_pokemon


class FavoriteSerializer(serializers.ModelSerializer):
    pokemon = serializers.SerializerMethodField()

    class Meta:
        model = Favorite
        fields = ("id", "pokemon_id", "pokemon")
        read_only_fields = ("id", "pokemon")

    def get_pokemon(self, obj: Favorite) -> dict[str, Any] | None:
        try:
            return get_pokemon(obj.pokemon_id)
        except PokeAPIError:
            return None

    def validate_pokemon_id(self, value: int) -> int:
        user = self.context["request"].user
        if Favorite.objects.filter(user=user, pokemon_id=value).exists():
            raise serializers.ValidationError("Pokémon já está nos favoritos.")
        return value

    def create(self, validated_data: dict[str, Any]) -> Favorite:
        user = self.context["request"].user
        try:
            favorite, _ = Favorite.objects.get_or_create(
                user=user,
                pokemon_id=validated_data["pokemon_id"],
            )
            return favorite
        except IntegrityError as exc:  # pragma: no cover - proteção extra
            raise serializers.ValidationError(
                {"pokemon_id": "Pokémon já está nos favoritos."}
            ) from exc


class TeamSlotSerializer(serializers.ModelSerializer):
    pokemon = serializers.SerializerMethodField()

    class Meta:
        model = TeamSlot
        fields = ("id", "slot", "pokemon_id", "pokemon")
        read_only_fields = ("id", "slot", "pokemon_id", "pokemon")

    def get_pokemon(self, obj: TeamSlot) -> dict[str, Any] | None:
        try:
            return get_pokemon(obj.pokemon_id)
        except PokeAPIError:
            return None


class TeamSetSerializer(serializers.Serializer):
    pokemon_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
    )

    def validate_pokemon_ids(self, pokemon_ids: list[int]) -> list[int]:
        unique_ids = set(pokemon_ids)
        if len(pokemon_ids) != len(unique_ids):
            raise serializers.ValidationError("Não é permitido repetir Pokémon na equipe.")
        if len(pokemon_ids) > 6:
            raise serializers.ValidationError("Equipe cheia (máx. 6).")
        return pokemon_ids
