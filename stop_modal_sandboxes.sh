#!/bin/bash

# Script to stop all running Modal apps associated with the Sentry project
# Usage: ./stop_modal_sandboxes.sh

APP_NAME="sentry-sandbox-executor"

echo "Listing active Modal apps..."
python3 -m modal app list

echo "Stopping app: $APP_NAME..."
python3 -m modal app stop $APP_NAME

echo "Stopping any other active ephemeral apps if they exist..."
# This is a bit more aggressive, it lists all apps and tries to stop them if they are not permanent
# But for now, we'll stick to the specific app name which is the most common case.

echo "Done."
