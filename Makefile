.PHONY: help check lint fmt fmt-check build test test-fe test-be dev clean

help:
	@echo "Available commands:"
	@echo "  make check      - Run all checks (lint + fmt-check + test)"
	@echo "  make lint       - Run linters (ESLint + Clippy)"
	@echo "  make fmt        - Format code (Prettier + cargo fmt)"
	@echo "  make fmt-check  - Check formatting without modifying"
	@echo "  make build      - Build frontend and backend"
	@echo "  make test       - Run all tests"
	@echo "  make test-fe    - Frontend tests only (Vitest)"
	@echo "  make test-be    - Backend tests only (cargo test)"
	@echo "  make dev        - Start dev server"
	@echo "  make clean      - Clean build artifacts"

check: lint fmt-check test

lint:
	pnpm biome check src
	cd src-tauri && cargo clippy -- -D warnings

fmt:
	pnpm biome check --write src
	cd src-tauri && cargo fmt

fmt-check:
	pnpm biome check src
	cd src-tauri && cargo fmt -- --check

build:
	pnpm run build
	cd src-tauri && cargo build --release

test: test-fe test-be

test-fe:
	pnpm run test

test-be:
	cd src-tauri && cargo test

dev:
	pnpm run tauri dev

clean:
	rm -rf dist node_modules/.vite
	cd src-tauri && cargo clean
