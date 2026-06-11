# Sentry Data Ingestion (Meltano)

This directory contains the ELT (Extract, Load, Transform) pipeline for Sentry Data.

## Prerequisites
- Python 3.9+
- [Meltano](https://meltano.com/) (`pipx install meltano`)

## Setup
1. Copy `.env.example` to `.env`.
2. Populate `.env` with your credentials (R2, API keys, etc.).
3. Run `meltano install` to install plugins.

## Usage
Run a specific pipeline:
```bash
meltano run tap-something target-parquet
```
