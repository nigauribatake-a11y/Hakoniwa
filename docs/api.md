# API

The API package exposes the current DB-backed game loop over HTTP.

## Start

PowerShell:

```powershell
$env:DATABASE_URL = "postgres://hakoniwa:hakoniwa_dev_password@localhost:5432/hakoniwa"
pnpm run api:start
```

WSL/bash:

```bash
export DATABASE_URL="postgres://hakoniwa:hakoniwa_dev_password@localhost:5432/hakoniwa"
pnpm run api:start
```

The default URL is:

```text
http://127.0.0.1:3000
```

## Endpoints

```text
GET /health
GET /state
POST /command
POST /turn
```

Queue a command:

```bash
curl -X POST http://127.0.0.1:3000/command \
  -H "content-type: application/json" \
  -d '{"islandId":"1","position":0,"kind":"plant","x":5,"y":6}'
```

Advance one turn:

```bash
curl -X POST http://127.0.0.1:3000/turn
```

Read state:

```bash
curl http://127.0.0.1:3000/state
```
