from __future__ import annotations

from typing import Iterable

from django.db import migrations


def _normalize_int(value) -> int | None:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number


def restore_tables(apps, schema_editor):
    connection = schema_editor.connection
    introspection = connection.introspection
    existing_tables = set(introspection.table_names())
    cursor = connection.cursor()

    favorite_model = apps.get_model("api", "Favorite")
    team_slot_model = apps.get_model("api", "TeamSlot")

    def ensure_table(model) -> None:
        if model._meta.db_table not in existing_tables:
            schema_editor.create_model(model)
            existing_tables.add(model._meta.db_table)

    ensure_table(favorite_model)
    ensure_table(team_slot_model)

    legacy_table = "api_pokemonusuario"
    if legacy_table not in existing_tables:
        return

    columns: Iterable[object] = introspection.get_table_description(cursor, legacy_table)
    column_lookup = {
        getattr(column, "name", "").lower(): getattr(column, "name", "")
        for column in columns
        if getattr(column, "name", None)
    }

    user_col = next(
        (
            column_lookup.get(name)
            for name in ("user_id", "usuario_id", "owner_id", "usuarioid")
            if column_lookup.get(name)
        ),
        None,
    )
    pokemon_col = next(
        (
            column_lookup.get(name)
            for name in ("pokemon_id", "pokemonid", "pokemon")
            if column_lookup.get(name)
        ),
        None,
    )
    slot_col = next(
        (
            column_lookup.get(name)
            for name in ("slot", "posicao", "position")
            if column_lookup.get(name)
        ),
        None,
    )
    favorite_flag_col = next(
        (
            column_lookup.get(name)
            for name in ("is_favorite", "favorite", "favorito", "isfavorito")
            if column_lookup.get(name)
        ),
        None,
    )

    if not user_col or not pokemon_col:
        schema_editor.execute(f"DROP TABLE {legacy_table}")
        existing_tables.discard(legacy_table)
        return

    select_columns = [user_col, pokemon_col]
    if slot_col:
        select_columns.append(slot_col)
    if favorite_flag_col:
        select_columns.append(favorite_flag_col)
    cursor.execute(
        f"SELECT {', '.join(select_columns)} FROM {legacy_table}"
    )

    favorite_rows = []
    team_rows = []

    for raw_row in cursor.fetchall():
        iterator = iter(raw_row)
        user_id = _normalize_int(next(iterator, None))
        pokemon_id = _normalize_int(next(iterator, None))
        if user_id is None or pokemon_id is None:
            continue

        slot_value = None
        if slot_col:
            slot_value = _normalize_int(next(iterator, None))
        flag_value = None
        if favorite_flag_col:
            flag_value = next(iterator, None)

        if slot_col and slot_value and 1 <= slot_value <= 6:
            team_rows.append(
                team_slot_model(user_id=user_id, slot=slot_value, pokemon_id=pokemon_id)
            )
            if favorite_flag_col:
                normalized_flag = str(flag_value).strip().lower() if flag_value is not None else ""
                if normalized_flag in {"1", "true", "t", "y", "yes", "sim"}:
                    favorite_rows.append(
                        favorite_model(user_id=user_id, pokemon_id=pokemon_id)
                    )
        elif not slot_col:
            favorite_rows.append(
                favorite_model(user_id=user_id, pokemon_id=pokemon_id)
            )

    if favorite_rows:
        favorite_model.objects.bulk_create(favorite_rows, ignore_conflicts=True)
    if team_rows:
        team_slot_model.objects.bulk_create(team_rows, ignore_conflicts=True)

    schema_editor.execute(f"DROP TABLE {legacy_table}")
    existing_tables.discard(legacy_table)


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [migrations.RunPython(restore_tables, migrations.RunPython.noop)]
