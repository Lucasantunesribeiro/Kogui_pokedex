from __future__ import annotations

import logging

from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.generics import DestroyAPIView, ListAPIView, ListCreateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Favorite, TeamSlot
from .pokeapi_service import PokeAPIError, list_pokemon
from .serializers import FavoriteSerializer, TeamSetSerializer, TeamSlotSerializer

logger = logging.getLogger(__name__)


class PokemonListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        params = request.query_params
        filters = {
            "generation": params.get("generation"),
            "name": params.get("name"),
            "limit": params.get("limit", 20),
            "offset": params.get("offset", 0),
        }
        logger.info("pokemon.list.request", extra={"event": "pokemon.list.request", "extra_data": filters})
        try:
            payload = list_pokemon(
                generation=filters["generation"],
                name=filters["name"],
                limit=filters["limit"],
                offset=filters["offset"],
            )
        except PokeAPIError as exc:
            logger.error(
                "pokemon.list.error",
                extra={"event": "pokemon.list.error", "extra_data": filters},
                exc_info=True,
            )
            raise APIException(str(exc)) from exc
        logger.info(
            "pokemon.list.success",
            extra={
                "event": "pokemon.list.success",
                "extra_data": {"count": payload.get("count", 0)},
            },
        )
        return Response(payload)


class FavoriteListCreateView(ListCreateAPIView):
    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).order_by("pokemon_id", "id")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context


class FavoriteDestroyView(DestroyAPIView):
    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).order_by("pokemon_id", "id")


class TeamListView(ListAPIView):
    serializer_class = TeamSlotSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return TeamSlot.objects.filter(user=self.request.user).order_by("slot", "id")


class TeamSetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = TeamSetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pokemon_ids = serializer.validated_data["pokemon_ids"]
        user = request.user

        logger.info(
            "team.update.request",
            extra={
                "event": "team.update.request",
                "extra_data": {"count": len(pokemon_ids)},
            },
        )

        with transaction.atomic():
            TeamSlot.objects.filter(user=user).delete()

            slots = [
                TeamSlot(user=user, slot=index, pokemon_id=pokemon_id)
                for index, pokemon_id in enumerate(pokemon_ids, start=1)
            ]
            if slots:
                try:
                    TeamSlot.objects.bulk_create(slots)
                except IntegrityError as exc:
                    logger.warning(
                        "team.update.conflict",
                        extra={
                            "event": "team.update.conflict",
                            "extra_data": {"count": len(slots)},
                        },
                    )
                    raise ValidationError(
                        {"pokemon_ids": ["Equipe inválida. Verifique duplicatas ou slots fora do intervalo 1..6."]}
                    ) from exc

        queryset = TeamSlot.objects.filter(user=user).order_by("slot", "id")
        response_serializer = TeamSlotSerializer(queryset, many=True)
        team_size = queryset.count()

        logger.info(
            "team.update.success",
            extra={
                "event": "team.update.success",
                "extra_data": {"count": team_size},
            },
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)
