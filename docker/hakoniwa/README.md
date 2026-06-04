# Hakoniwa R.A. Perl Docker

This container runs the archived Hakoniwa R.A. Final Edition CGI files under
Apache with Perl.

## Run

```sh
docker compose up --build
```

Open:

- http://localhost:8080/hako-main.cgi
- http://localhost:8080/hako-mente.cgi

The maintenance password is the value embedded in the original CGI:

```text
uhusnuvnurkanjhfh
```

Use the maintenance page to create fresh data if the game page says the data
file is missing or invalid.

## Notes

- The original archive under `archive/hako-r-a_FE` is not modified.
- The container patches only its copied `hako-main.cgi` URL settings and the
  old `jcode.pl` `defined %hash` syntax for modern Perl compatibility.
- Game data persists in the Docker volume `hakoniwa-data`.
