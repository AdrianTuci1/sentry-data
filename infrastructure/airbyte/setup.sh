#!/bin/bash

# infrastructure/airbyte/setup.sh
# Downloads and sets up the official Airbyte Docker Compose configuration

mkdir -p infrastructure/airbyte
cd infrastructure/airbyte

echo "Downloading Airbyte docker-compose.yaml..."
curl -sO https://raw.githubusercontent.com/airbytehq/airbyte/master/docker-compose.yaml

echo "Downloading Airbyte .env..."
curl -sO https://raw.githubusercontent.com/airbytehq/airbyte/master/.env

echo "Setup complete. To start Airbyte:"
echo "cd infrastructure/airbyte && docker-compose up -d"
echo "Access UI at http://localhost:8000"
