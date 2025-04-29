# muze

## requirements

- python 3.12
- uv
- hcp (for vault secrets)
- tailwindcss@3

## development

fmt

```
uv run black src
```

check

```
uv run ruff check src
```

mypy

```
uv run mypy src
```

dev

```
./bin/dev.sh
```

run

```
./bin/run.sh
```

prepare alembic

```
./bin/prepare_migrations.sh
```

migrate

```
./bin/migrate.sh
```

tailwind

```
./bin/tailwind.sh -w
```
