from __future__ import annotations

from django.db import migrations


def restore_tables(apps, schema_editor):
    connection = schema_editor.connection
    table_names = set(connection.introspection.table_names())

    # Remove legado consolidado, se ainda existir.
    if "api_pokemonusuario" in table_names:
        schema_editor.execute("DROP TABLE api_pokemonusuario")
        table_names.discard("api_pokemonusuario")

    favorite_model = apps.get_model("api", "Favorite")
    team_slot_model = apps.get_model("api", "TeamSlot")

    if favorite_model._meta.db_table not in table_names:
        schema_editor.create_model(favorite_model)
    if team_slot_model._meta.db_table not in table_names:
        schema_editor.create_model(team_slot_model)


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [migrations.RunPython(restore_tables, migrations.RunPython.noop)]
