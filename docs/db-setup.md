# DB Setup

This project uses PostgreSQL for the modern implementation. The old Perl CGI
container can keep running separately; the new DB is exposed on localhost port
`5432`.

## 1. Prepare `.env`

Copy `.env.example` to `.env`.

```powershell
Copy-Item .env.example .env
```

The default local connection string is:

```text
postgres://hakoniwa:hakoniwa_dev_password@localhost:5432/hakoniwa
```

This password is only for local development.

## 2. Start PostgreSQL

```powershell
docker compose up -d postgres
```

Check that the database is healthy:

```powershell
docker compose ps postgres
```

## 3. Apply the Initial Schema

Run the schema SQL inside the PostgreSQL container:

```powershell
Get-Content packages/db/schema/postgres.sql | docker compose exec -T postgres psql -U hakoniwa -d hakoniwa
```

## 4. Useful Commands

Open a SQL prompt:

```powershell
docker compose exec postgres psql -U hakoniwa -d hakoniwa
```

List tables:

```sql
\dt
```

Stop the DB without deleting data:

```powershell
docker compose stop postgres
```

Delete the local DB data and start fresh:

```powershell
docker compose down -v
```

Only use `down -v` when you are fine losing local development data.

## Notes

The TypeScript core does not talk to PostgreSQL directly. `packages/db` owns
the persistence boundary, and future adapters should load/save plain
`GameState` objects.
