from __future__ import annotations

from django.urls import path

from .views import (
    FavoriteDestroyView,
    FavoriteListCreateView,
    PokemonListView,
    TeamListView,
    TeamSetView,
)

app_name = "api"

urlpatterns = [
    path("pokemon/", PokemonListView.as_view(), name="pokemon-list"),
    path("favorites/", FavoriteListCreateView.as_view(), name="favorite-list"),
    path("favorites/<int:pk>/", FavoriteDestroyView.as_view(), name="favorite-detail"),
    path("team/", TeamListView.as_view(), name="team-list"),
    path("team/set/", TeamSetView.as_view(), name="team-set"),
]
