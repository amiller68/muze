#!/bin/bash

WORKER=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --worker) WORKER=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

export LISTEN_ADDRESS=0.0.0.0
export LISTEN_PORT=8000
export DEBUG=False

if [ "$WORKER" = true ]; then
    uv run arq src.task_manager.worker.WorkerSettings
else
    uv run src/__main__.py
fi

# Exit the script
exit 0
