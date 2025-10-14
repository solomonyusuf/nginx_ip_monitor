# Use Debian-based Nginx image that supports dynamic modules
FROM nginxinc/nginx-unprivileged:latest

# Temporarily switch to root to install packages
USER root

# Set your MaxMind credentials
ENV ACCOUNT_ID=1239906
ENV LICENSE_KEY=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

# Install dependencies + GeoIP2 module
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    nginx-module-geoip2 wget tar gzip && \
    rm -rf /var/lib/apt/lists/*

# Copy GeoIP2 module to Nginx module directory (ensure it can load)
RUN mkdir -p /etc/nginx/modules && \
    cp /usr/lib/nginx/modules/ngx_http_geoip2_module.so /etc/nginx/modules/

# Create directory for GeoIP2 database
RUN mkdir -p /etc/nginx/GeoIP2

# Download GeoLite2-City database using MaxMind credentials
RUN wget -O /tmp/GeoLite2-City.tar.gz \
    "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&account_id=${ACCOUNT_ID}&license_key=${LICENSE_KEY}&suffix=tar.gz" \
    && mkdir -p /tmp/geolite2 \
    && tar -xzf /tmp/GeoLite2-City.tar.gz -C /tmp/geolite2 \
    && find /tmp/geolite2 -name "*.mmdb" -exec mv {} /etc/nginx/GeoIP2/GeoLite2-City.mmdb \; \
    && rm -rf /tmp/geolite2 /tmp/GeoLite2-City.tar.gz

# Copy Nginx config and startup script
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Restore permissions for unprivileged user
RUN chown -R nginx:nginx /etc/nginx /var/log/nginx /var/www

# Switch back to unprivileged user
USER nginx

# Mount points
VOLUME ["/etc/nginx/conf.d", "/var/log/nginx", "/var/www"]

# Run startup script
CMD ["/start.sh"]
