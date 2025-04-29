#!/bin/bash

# Set environment variables
export HOST_NAME=http://localhost:8000
export LISTEN_ADDRESS=localhost
export LISTEN_PORT=8000
export DEBUG=True
export DEV_MODE=True
export LOG_PATH=
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/muze

# Start PostgreSQL
echo "Starting PostgreSQL..."
./bin/postgres.sh run
# Give PostgreSQL a moment to start
sleep 2

# Start the main application
hcp vault-secrets run --project=7f2f1685-1074-4178-bc3c-4507ce0af722 --app=muze-dev -- uv run src/__main__.py

# Exit the script
exit 0
