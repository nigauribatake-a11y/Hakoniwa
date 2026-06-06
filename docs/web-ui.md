# Web UI

The web package is a small browser UI for the DB-backed API.

Start the API first:

```bash
export DATABASE_URL="postgres://hakoniwa:hakoniwa_dev_password@localhost:5432/hakoniwa"
pnpm run api:start
```

Start the web UI in another terminal:

```bash
pnpm run web:start
```

Open:

```text
http://127.0.0.1:5173
```

The default API base is:

```text
http://127.0.0.1:3000
```

The UI can currently read the island, select a map cell, register a command into a queue slot, and advance one turn.

If the database was created before cell work state was added, run:

```bash
docker compose exec -T postgres psql -U hakoniwa -d hakoniwa < docs/cell-state-migration.sql
```
