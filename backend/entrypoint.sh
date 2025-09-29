#!/bin/bash
set -e

echo "=== Starting Kogui Pokédx API ==="

# Wait for dependencies
echo "Waiting for Redis..."
timeout 60 bash -c 'until redis-cli -h redis ping; do sleep 1; done' || echo "⚠️ Redis timeout, continuing anyway"

# Check Python path and environment
echo "Python version: $(python --version)"
echo "Django version: $(python -c 'import django; print(django.get_version())')"
echo "Working directory: $(pwd)"

# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

# Create superuser if it doesn't exist
echo "Creating superuser..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@kogui.com', 'admin123')
    print('✅ Superuser created: admin/admin123')
else:
    print('✅ Superuser already exists')
" 2>/dev/null || echo "⚠️ Superuser creation skipped"

# Verify static files were collected
echo "Verifying static files..."
if [ -d "/app/staticfiles/admin" ]; then
    echo "✅ Admin static files collected successfully"
else
    echo "❌ Admin static files not found - attempting to collect again..."
    python manage.py collectstatic --noinput
fi

# Test Django configuration
echo "Testing Django configuration..."
python manage.py check --deploy || echo "⚠️ Django check warnings (continuing)"

echo "=== Django Ready - Starting Gunicorn ==="
echo "Starting server on 0.0.0.0:8000..."
exec "$@"