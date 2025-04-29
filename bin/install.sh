#!/bin/bash

uv venv
uv python pin 3.12
uv lock
uv sync --dev
