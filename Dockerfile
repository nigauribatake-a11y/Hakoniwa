FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV HAKONIWA_BASE_URL=http://localhost:8080
ENV PERL_USE_UNSAFE_INC=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends apache2 perl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && a2enmod cgi

COPY docker/hakoniwa/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/hakoniwa/entrypoint.sh /usr/local/bin/hakoniwa-entrypoint
COPY archive/hako-r-a_FE/ /var/www/hako/

RUN ln -sf /usr/bin/perl /usr/local/bin/perl \
    && chmod +x /usr/local/bin/hakoniwa-entrypoint \
    && find /var/www/hako -type f \( -name '*.cgi' -o -name '*.pl' \) -exec perl -0pi -e 's/\r\n/\n/g' {} \; \
    && find /var/www/hako -name '*.cgi' -exec chmod 755 {} \; \
    && chmod 644 /var/www/hako/jcode.pl \
    && mkdir -p /var/www/hako/data \
    && chown -R www-data:www-data /var/www/hako

EXPOSE 80

ENTRYPOINT ["hakoniwa-entrypoint"]
CMD ["apachectl", "-D", "FOREGROUND"]
