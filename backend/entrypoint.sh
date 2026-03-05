#!/bin/bash
set -e

echo "=== Starting Kogui Pokédx API ==="

echo "Python version: $(python --version)"
echo "Django version: $(python -c 'import django; print(django.get_version())')"
echo "Working directory: $(pwd)"

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

# SEC-03: credenciais via variáveis de ambiente (com defaults apenas para dev local)
SUPERUSER_USERNAME="${DJANGO_SUPERUSER_USERNAME:-admin}"
SUPERUSER_EMAIL="${DJANGO_SUPERUSER_EMAIL:-admin@kogui.local}"
SUPERUSER_PASSWORD="${DJANGO_SUPERUSER_PASSWORD:-}"

if [ -n "$SUPERUSER_PASSWORD" ]; then
    python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
username = '${SUPERUSER_USERNAME}'
email = '${SUPERUSER_EMAIL}'
password = '${SUPERUSER_PASSWORD}'
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, password)
    print(f'Superuser created: {username}')
else:
    print(f'Superuser already exists: {username}')
" 2>/dev/null || echo "Superuser creation skipped"
else
    echo "DJANGO_SUPERUSER_PASSWORD not set — skipping superuser creation"
fi

echo "Testing Django configuration..."
python manage.py check --deploy 2>&1 | grep -v "^System check" || true

echo "=== Django Ready - Starting Gunicorn ==="
exec "$@"
