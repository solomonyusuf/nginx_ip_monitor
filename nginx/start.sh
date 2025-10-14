#!/bin/sh

# Ensure log directory exists
mkdir -p /var/log/nginx

# Start Nginx in background
nginx -g "daemon off;" &
NGINX_PID=$!

RULES_DIR="/etc/nginx/conf.d"
RULES_FILE="${RULES_DIR}/ip-rules.conf"

# Watch the ip-rules.conf file and reload Nginx on changes
while true; do
  if [ -f "$RULES_FILE" ]; then
    inotifywait -e modify,create,delete,move "$RULES_FILE" 2>/dev/null
    echo "$(date -Iseconds) [watcher] rules changed - reloading nginx" >> /var/log/nginx/ip-watcher.log 2>&1
    # Test Nginx config first to avoid downtime
    nginx -t && nginx -s reload
  else
    sleep 2
  fi
done &

# Optional: Watch the entire conf.d directory as well (for adding/removing sites)
while true; do
  inotifywait -e modify,create,delete,move -r "$RULES_DIR" 2>/dev/null
  echo "$(date -Iseconds) [watcher] conf.d changed - reloading nginx" >> /var/log/nginx/ip-watcher.log 2>&1
  nginx -t && nginx -s reload
done &

# Wait for the main Nginx process to exit
wait $NGINX_PID
