"""Integrações com a PokéAPI v2."""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

import requests
from django.core.cache import cache
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

POKEAPI_BASE_URL = "https://pokeapi.co/api/v2"
CACHE_TTL = int(os.environ.get("POKEAPI_CACHE_TTL", "3600"))  # 1 hour default

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "KoguiPokedex/1.0 (Fair Use Cache Implementation)"})

# Exponential backoff for 429/5xx errors
retry_strategy = Retry(
    total=4,
    backoff_factor=1.0,  # More aggressive backoff for fair use
    status_forcelist=[429, 502, 503, 504],  # Include 429 rate limit
    allowed_methods=["GET"],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
SESSION.mount("https://", adapter)
SESSION.mount("http://", adapter)

logger = logging.getLogger(__name__)


class PokeAPIError(RuntimeError):
    """Exceção lançada para erros na PokéAPI."""



def _fetch_json(endpoint: str) -> Dict[str, Any]:
    """Perform a GET request to PokéAPI with Django cache and backoff."""
    cache_key = f"pokeapi:{endpoint}"

    # Try cache first
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        logger.info("pokeapi.cache.hit", extra={"event": "pokeapi.cache.hit", "extra_data": {"endpoint": endpoint}})
        return cached_data

    # Cache miss - fetch from API
    url = f"{POKEAPI_BASE_URL}/{endpoint.lstrip('/')}"
    logger.info("pokeapi.fetch", extra={"event": "pokeapi.fetch", "extra_data": {"url": url}})
    try:
        response = SESSION.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        # Cache the result
        cache.set(cache_key, data, CACHE_TTL)

        logger.info(
            "pokeapi.fetch.success",
            extra={
                "event": "pokeapi.fetch.success",
                "extra_data": {"url": url, "status_code": response.status_code, "cached": True},
            },
        )
        return data
    except requests.RequestException as exc:  # pragma: no cover - integração externa
        logger.error(
            "pokeapi.fetch.error",
            extra={"event": "pokeapi.fetch.error", "extra_data": {"url": url}},
            exc_info=True,
        )
        raise PokeAPIError(f"Erro ao consultar PokéAPI: {exc}") from exc


def _extract_stat(pokemon_data: Dict[str, Any], stat_name: str) -> int:
    for stat in pokemon_data.get("stats", []):
        if stat.get("stat", {}).get("name") == stat_name:
            return int(stat.get("base_stat", 0))
    return 0


def _normalize_stat_value(base_value: int) -> int:
    try:
        base = int(base_value)
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, round(base * 1.5)))


def _normalize_pokemon(pokemon_data: Dict[str, Any]) -> Dict[str, Any]:
    sprite = (
        pokemon_data.get("sprites", {})
        .get("other", {})
        .get("official-artwork", {})
        .get("front_default")
        or pokemon_data.get("sprites", {}).get("front_default")
    )
    types = [slot.get("type", {}).get("name", "") for slot in pokemon_data.get("types", [])]
    hp = _normalize_stat_value(_extract_stat(pokemon_data, "hp"))
    attack = _normalize_stat_value(_extract_stat(pokemon_data, "attack"))
    defense = _normalize_stat_value(_extract_stat(pokemon_data, "defense"))

    return {
        "id": pokemon_data.get("id"),
        "name": pokemon_data.get("name"),
        "types": [type_name for type_name in types if type_name],
        "sprite": sprite,
        "stats": {
            "hp": hp,
            "attack": attack,
            "defense": defense,
        },
    }


def _parse_id_from_url(url: str) -> int:
    return int(url.rstrip("/").split("/")[-1])


def get_pokemon(identifier: str | int) -> Dict[str, Any]:
    """Get detailed Pokemon data with caching."""
    data = _fetch_json(f"pokemon/{identifier}/")
    return _normalize_pokemon(data)


def get_generation_catalog(generation_id: int) -> List[Dict[str, Any]]:
    """Get Pokemon catalog for a specific generation with caching."""
    payload = _fetch_json(f"generation/{generation_id}/")
    catalog = []
    for entry in payload.get("pokemon_species", []):
        catalog.append({
            "id": _parse_id_from_url(entry.get("url", "")),
            "name": entry.get("name"),
        })
    catalog = [item for item in catalog if item["id"] and item["name"]]
    catalog.sort(key=lambda item: item["id"])
    return catalog


def get_global_catalog() -> List[Dict[str, Any]]:
    """Get global Pokemon catalog with caching."""
    payload = _fetch_json("pokemon?limit=2000&offset=0")
    catalog = []
    for entry in payload.get("results", []):
        catalog.append({
            "id": _parse_id_from_url(entry.get("url", "")),
            "name": entry.get("name"),
        })
    catalog = [item for item in catalog if item["id"] and item["name"]]
    catalog.sort(key=lambda item: item["id"])
    return catalog


def list_pokemon(
    *,
    generation: int | None = None,
    name: str | None = None,
    type: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> Dict[str, Any]:
    """Return a normalized Pokédex payload filtered by generation or name."""
    try:
        limit_value = max(1, min(int(limit), 50))
    except (TypeError, ValueError):
        limit_value = 20
    try:
        offset_value = max(0, int(offset))
    except (TypeError, ValueError):
        offset_value = 0

    name_filter = (name or "").strip().lower()
    type_filter = (type or "").strip().lower()

    if not generation and not name_filter and not type_filter:
        payload = _fetch_json(f"pokemon?limit={limit_value}&offset={offset_value}")
        results = [
            get_pokemon(entry.get("name"))
            for entry in payload.get("results", [])
            if entry.get("name")
        ]
        return {
            "count": payload.get("count", len(results)),
            "results": results,
        }

    catalog: List[Dict[str, Any]]
    if generation:
        try:
            generation_id = int(generation)
        except (TypeError, ValueError) as exc:  # pragma: no cover - validação simples
            raise PokeAPIError("Geração inválida.") from exc
        catalog = get_generation_catalog(generation_id)
    else:
        catalog = get_global_catalog()

    if name_filter:
        catalog = [item for item in catalog if name_filter in item["name"].lower()]

    # Filtro por tipo - paginação eficiente
    if type_filter:
        filtered_results = []
        current_offset = 0
        batch_size = 50  # Processar em lotes pequenos

        # Continuar buscando até ter resultados suficientes ou esgotar o catálogo
        while len(filtered_results) < offset_value + limit_value and current_offset < len(catalog):
            # Processar apenas um lote por vez
            batch = catalog[current_offset:current_offset + batch_size]

            for item in batch:
                try:
                    pokemon_data = get_pokemon(item["name"])
                    if any(type_filter == pokemon_type.lower() for pokemon_type in pokemon_data.get("types", [])):
                        filtered_results.append(pokemon_data)

                    # Se já temos resultados suficientes, parar
                    if len(filtered_results) >= offset_value + limit_value:
                        break
                except Exception:
                    # Skip em caso de erro na PokéAPI
                    continue

            current_offset += batch_size

        # Aplicar paginação nos resultados filtrados
        total = len(filtered_results)  # Estimativa baseada nos resultados encontrados
        results = filtered_results[offset_value:offset_value + limit_value]
    else:
        total = len(catalog)
        sliced = catalog[offset_value: offset_value + limit_value]
        results = [get_pokemon(item["name"]) for item in sliced]

    return {
        "count": total,
        "results": results,
    }
