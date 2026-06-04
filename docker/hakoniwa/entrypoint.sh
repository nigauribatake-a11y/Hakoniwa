#!/bin/sh
set -eu

app_dir=/var/www/hako
base_url=${HAKONIWA_BASE_URL:-http://localhost:8080}

mkdir -p "$app_dir/data"

needs_init=0

if [ ! -s "$app_dir/data/hakojima.dat" ]; then
    needs_init=1
else
    first_line=$(sed -n '1p' "$app_dir/data/hakojima.dat" | tr -d '\r')
    second_line=$(sed -n '2p' "$app_dir/data/hakojima.dat" | tr -d '\r')

    case "$first_line" in
        ''|*[!0-9]*) needs_init=1 ;;
        *)
            if [ "$first_line" -gt 1000000 ]; then
                needs_init=1
            fi
            ;;
    esac

    case "$second_line" in
        ''|*[!0-9]*) needs_init=1 ;;
    esac
fi

if [ "$needs_init" -eq 1 ]; then
    now=$(date +%s)
    turn_unit=21600
    start_time=$((now - now % turn_unit))
    {
        printf '1\n'
        printf '%s\n' "$start_time"
        printf '0\n'
        printf '1\n'
    } > "$app_dir/data/hakojima.dat"
fi

touch "$app_dir/data/howner.dat" "$app_dir/data/ips.dat"

# The original scripts are EUC-JP/Shift_JIS era CGI. Patch only the
# container copy so the archived source remains untouched.
perl -0pi -e "s|my\\(\\\$baseDir\\) = 'http://www\\.xxxxxxxx/cgi-bin/hako';|my(\\\$baseDir) = '$base_url';|" "$app_dir/hako-main.cgi"
perl -0pi -e "s|my\\(\\\$imageDir\\) = 'http://www\\.xxxxxxxx/cgi-bin/hako/hakoimg';|my(\\\$imageDir) = '$base_url/hakoimg';|" "$app_dir/hako-main.cgi"
perl -0pi -e "s|\\\$HdirName = 'data';|\\\$HdirName = '$app_dir/data';|" "$app_dir/hako-main.cgi"
perl -0pi -e "s|my\\(\\\$dirName\\) = 'data';|my(\\\$dirName) = '$app_dir/data';|" "$app_dir/hako-mente.cgi"
perl -0pi -e 's/Content-type: text\/html/Content-type: text\/html; charset=EUC-JP/' "$app_dir/hako-mente.cgi"
perl -0pi -e 's/do convf\(\*_, \$opt\);/&convf(*_, $opt);/g; s/unless defined %z2h_euc/unless %z2h_euc/g; s/unless defined %z2h_sjis/unless %z2h_sjis/g' "$app_dir/jcode.pl"

find "$app_dir" -name '*.cgi' -exec chmod 755 {} \;
chown -R www-data:www-data "$app_dir/data"
touch "$app_dir/hakojimalockflock"
chown www-data:www-data "$app_dir/hakojimalockflock"

exec "$@"
