#!/bin/bash

# Check if -w flag is set
# If it is, start the watcher
if [ "$1" == "-w" ]; then
	npx tailwindcss -i styles/main.css -o static/css/main.css --watch
else
	npx tailwindcss -i styles/main.css -o static/css/main.css
fi

# Exit the script
exit 0
