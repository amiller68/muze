#!/usr/bin/env bash
# Script to manage a local PostgreSQL container for development (Mac-optimized)
set -o errexit
set -o nounset

# Container configuration
POSTGRES_CONTAINER_NAME="muze-postgres"
POSTGRES_VOLUME_NAME="muze-postgres-data"
POSTGRES_PORT="5432"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
POSTGRES_DB="muze"
POSTGRES_IMAGE_NAME="postgres:17"

# Check if docker or podman is available
CONTAINER_RUNTIME="docker"
if ! which docker &>/dev/null && which podman &>/dev/null; then
    CONTAINER_RUNTIME="podman"
fi

# Verify Docker/Podman is running
function check_runtime {
    if ! $CONTAINER_RUNTIME ps &>/dev/null; then
        echo "Error: $CONTAINER_RUNTIME is not running. Please start it first."
        exit 1
    fi
}

# Start local PostgreSQL for development
function run {
    check_runtime

    if ! $CONTAINER_RUNTIME ps | grep -q "$POSTGRES_CONTAINER_NAME"; then
        echo "Starting PostgreSQL container..."
        start_postgres_container

        # Wait for PostgreSQL to be ready
        echo "Waiting for PostgreSQL to be ready..."
        sleep 3

        # Mac-specific: Verify network connectivity to container
        verify_connection

        echo ""
        echo "PostgreSQL started. Set environment variables:"
        echo "  export DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
        echo ""
        echo "Connection command:"
        echo "  psql postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
    elif ! $CONTAINER_RUNTIME ps | grep -q "$POSTGRES_CONTAINER_NAME.*Up"; then
        echo "Starting existing PostgreSQL container..."
        $CONTAINER_RUNTIME start $POSTGRES_CONTAINER_NAME
        sleep 3
        verify_connection
    else
        echo "PostgreSQL container is already running."
        verify_connection
    fi
}

# Verify connection to PostgreSQL
function verify_connection {
    echo "Verifying container status..."
    $CONTAINER_RUNTIME logs --tail 10 $POSTGRES_CONTAINER_NAME

    # Check if container has the expected listening port
    if ! $CONTAINER_RUNTIME exec $POSTGRES_CONTAINER_NAME netstat -an | grep -q "LISTEN.*:5432"; then
        echo "Warning: PostgreSQL may not be listening properly inside the container."
    fi

    echo "Testing connection from host to container..."
    if command -v pg_isready &>/dev/null; then
        if pg_isready -h localhost -p $POSTGRES_PORT -U $POSTGRES_USER; then
            echo "✅ Connection successful!"
        else
            echo "⚠️ Connection test failed. See troubleshooting tips below."
            show_troubleshooting
        fi
    else
        echo "pg_isready not found. Install PostgreSQL client tools to test connectivity."
        show_troubleshooting
    fi
}

# Helper function to show troubleshooting tips
function show_troubleshooting {
    echo ""
    echo "=== Troubleshooting Tips for macOS ==="
    echo "1. Check Docker Desktop settings - ensure port forwarding is enabled"
    echo "2. Try restarting Docker Desktop completely"
    echo "3. Check if another service is using port $POSTGRES_PORT:"
    echo "   lsof -i :$POSTGRES_PORT"
    echo "4. Verify your Mac firewall settings allow Docker connections"
    echo "5. Try explicitly connecting with host.docker.internal instead of localhost:"
    echo "   export DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@host.docker.internal:${POSTGRES_PORT}/${POSTGRES_DB}"
    echo ""
}

# Helper functions for container management
function start_postgres_container {
    $CONTAINER_RUNTIME pull $POSTGRES_IMAGE_NAME

    if ! $CONTAINER_RUNTIME ps -a | grep $POSTGRES_CONTAINER_NAME &>/dev/null; then
        echo "Creating new PostgreSQL container..."
        $CONTAINER_RUNTIME volume create $POSTGRES_VOLUME_NAME || true

        # Mac-optimized container settings
        $CONTAINER_RUNTIME run \
            --name $POSTGRES_CONTAINER_NAME \
            --publish $POSTGRES_PORT:5432 \
            --volume $POSTGRES_VOLUME_NAME:/var/lib/postgresql/data \
            --env POSTGRES_USER=$POSTGRES_USER \
            --env POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
            --env POSTGRES_DB=$POSTGRES_DB \
            --env POSTGRES_HOST_AUTH_METHOD=trust \
            --health-cmd="pg_isready -U postgres" \
            --health-interval=5s \
            --health-timeout=5s \
            --health-retries=5 \
            --detach \
            $POSTGRES_IMAGE_NAME
    else
        echo "Starting existing PostgreSQL container..."
        $CONTAINER_RUNTIME start $POSTGRES_CONTAINER_NAME
    fi
}

function clean {
    check_runtime
    echo "Cleaning up PostgreSQL container and volume..."
    $CONTAINER_RUNTIME stop $POSTGRES_CONTAINER_NAME 2>/dev/null || true
    $CONTAINER_RUNTIME rm -f $POSTGRES_CONTAINER_NAME 2>/dev/null || true
    $CONTAINER_RUNTIME volume rm -f $POSTGRES_VOLUME_NAME 2>/dev/null || true
    echo "PostgreSQL container and volume removed."
}

function endpoint {
    check_runtime
    if $CONTAINER_RUNTIME ps -a | grep $POSTGRES_CONTAINER_NAME &>/dev/null; then
        echo "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
    else
        echo "PostgreSQL container is not running. Start it with: $0 run" >&2
        exit 1
    fi
}

function connect {
    psql ""$(./bin/postgres.sh endpoint)""
}

function status {
    check_runtime
    if $CONTAINER_RUNTIME ps | grep -q "$POSTGRES_CONTAINER_NAME"; then
        echo "PostgreSQL container is running."
        $CONTAINER_RUNTIME logs --tail 20 $POSTGRES_CONTAINER_NAME
        echo ""

        if command -v pg_isready &>/dev/null; then
            echo "Connection status:"
            pg_isready -h localhost -p $POSTGRES_PORT -U $POSTGRES_USER || true
        fi
    else
        echo "PostgreSQL container is not running."
    fi
}

function help {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  run      - Start a local PostgreSQL container for development"
    echo "  clean    - Remove the PostgreSQL container and volume"
    echo "  endpoint - Print the PostgreSQL connection URLs"
    echo "  connect  - Connect to the postgres instance"
    echo "  status   - Check container status and connection"
    echo "  help     - Show this help message"
    echo ""
    echo "For production, set the DATABASE_URL environment variable."
}

# Process command
CMD=${1:-help}
case "$CMD" in
run | clean | endpoint | connect | status | help)
    $CMD
    ;;
*)
    echo "Unknown command: $CMD"
    help
    exit 1
    ;;
esac
