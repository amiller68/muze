#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# check for the auto flag
MANUAL=false
if [ "$1" = "--manual" ]; then
    MANUAL=true
    shift # Remove --auto from arguments so $1 becomes the description
fi

# Start PostgreSQL if needed (for development)
./bin/postgres.sh run

# Set default DATABASE_URL if not set
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/muze"
fi
echo "Using DATABASE_URL: $DATABASE_URL"

# Get the migration description
DESCRIPTION=$1
if [ -z "$DESCRIPTION" ]; then
    echo "Error: Please provide a description for the migration."
    exit 1
fi

# Generate alembic migrations
echo "Generating migration..."

# Run alembic revision and capture output
if [ "$MANUAL" = true ]; then
    uv run alembic revision -m "$DESCRIPTION"
else
    uv run alembic revision --autogenerate -m "$DESCRIPTION"
fi

exit 0
