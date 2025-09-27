from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0002_restore_team_tables"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="favorite",
            unique_together=set(),
        ),
        migrations.AlterUniqueTogether(
            name="teamslot",
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name="favorite",
            constraint=models.UniqueConstraint(
                fields=("user", "pokemon_id"),
                name="uq_favorite_user_pokemon",
            ),
        ),
        migrations.AddConstraint(
            model_name="favorite",
            constraint=models.CheckConstraint(
                check=models.Q(pokemon_id__gt=0),
                name="ck_favorite_positive_pokemon_id",
            ),
        ),
        migrations.AddConstraint(
            model_name="teamslot",
            constraint=models.UniqueConstraint(
                fields=("user", "slot"),
                name="uq_teamslot_user_slot",
            ),
        ),
        migrations.AddConstraint(
            model_name="teamslot",
            constraint=models.UniqueConstraint(
                fields=("user", "pokemon_id"),
                name="uq_teamslot_user_pokemon",
            ),
        ),
        migrations.AddConstraint(
            model_name="teamslot",
            constraint=models.CheckConstraint(
                check=models.Q(slot__gte=1) & models.Q(slot__lte=6),
                name="ck_teamslot_slot_range",
            ),
        ),
        migrations.AddConstraint(
            model_name="teamslot",
            constraint=models.CheckConstraint(
                check=models.Q(pokemon_id__gt=0),
                name="ck_teamslot_positive_pokemon_id",
            ),
        ),
    ]
