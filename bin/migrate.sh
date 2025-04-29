#!/bin/bash

# Parse arguments
DEV=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
  --dev) DEV=true ;;
  *)
    echo "Unknown parameter: $1"
    exit 1
    ;;
  esac
  shift
done

echo "Running migrations..."

# Handle development environment
if [ "$DEV" = true ]; then
  # Start PostgreSQL if needed
  ./bin/postgres.sh run
  
  # Set default DATABASE_URL for development
  if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/muze"
  fi
  echo "DEV mode: Using DATABASE_URL=$DATABASE_URL"
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  echo "For development, run with --dev flag or set DATABASE_URL"
  exit 1
fi

# Run the migrations
uv run alembic upgrade head

# Exit the script
exit 0
