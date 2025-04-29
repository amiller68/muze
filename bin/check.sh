#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
USE_LOCAL_POSTGRES=true
DATABASE_URL=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --ci)
      USE_LOCAL_POSTGRES=false
      shift
      ;;
    --db-url=*)
      DATABASE_URL="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--ci] [--db-url=postgresql://...]"
      exit 1
      ;;
  esac
done

# Error counter
ERRORS=0

# Function to print section headers
print_header() {
    echo -e "\n${YELLOW}=== $1 ===${NC}"
}

# Function to check command result
check_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1 passed${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        ERRORS=$((ERRORS + 1))
    fi
}

# Make sure PostgreSQL is running
if [ "$USE_LOCAL_POSTGRES" = true ]; then
    print_header "Ensuring PostgreSQL is running"
    ./bin/postgres.sh run > /dev/null
    check_result "PostgreSQL"
    
    # Set DATABASE_URL if not explicitly provided
    if [ -z "$DATABASE_URL" ]; then
        export DATABASE_URL=$(./bin/postgres.sh endpoint)
    fi
else
    print_header "Using external PostgreSQL database"
    echo -e "${GREEN}✓ Skipping local PostgreSQL setup (CI mode)${NC}"
    
    # Make sure DATABASE_URL is set in CI mode
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}Error: DATABASE_URL must be specified with --db-url when using --ci flag${NC}"
        exit 1
    fi
fi

# Export DATABASE_URL for subsequent commands
export DATABASE_URL

# Format with Black
print_header "Running Black Formatter"
uv tool run black src --check
check_result "Black"

# Lint with Ruff
print_header "Running Ruff Linter"
uv tool run ruff check src
check_result "Ruff"

# Type check with MyPy
print_header "Running MyPy Type Checker"
uv tool run mypy src
check_result "MyPy"

# Run tests with pytest
print_header "Running Tests"
uv run pytest -v
check_result "Pytest"

# Final summary
print_header "Summary"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All checks passed successfully!${NC}"
    exit 0
else
    echo -e "${RED}${ERRORS} check(s) failed${NC}"
    exit 1
fi
