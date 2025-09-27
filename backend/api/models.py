from __future__ import annotations

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorites",
    )
    pokemon_id = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["pokemon_id"]
        unique_together = ("user", "pokemon_id")

    def __str__(self) -> str:  # pragma: no cover - representação humana simples
        return f"{self.user.username} ♥ {self.pokemon_id}"


class TeamSlot(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="team_slots",
    )
    slot = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(6)]
    )
    pokemon_id = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["slot"]
        unique_together = (
            ("user", "slot"),
            ("user", "pokemon_id"),
        )

    def __str__(self) -> str:  # pragma: no cover - representação humana simples
        return f"#{self.slot} -> {self.user.username} ({self.pokemon_id})"
