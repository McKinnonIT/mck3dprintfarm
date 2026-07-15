#!/bin/sh
# Generates a self-signed TLS cert for the camera-proxy sidecar's HLS/WebRTC
# listeners. Needed because browsers block mixed content: an http:// iframe
# embedded in an https:// dashboard gets silently blocked, so the sidecar
# has to speak https too, even though there's no real CA-signed cert
# available for it here.
#
# Run this once per deployment before first `docker compose up`, passing
# every hostname/IP browsers might use to reach this box, e.g.:
#   ./generate-cert.sh 3dprint.mckinnon.sc
#
# Because it's self-signed, each browser/device will show a "not trusted"
# warning the first time it loads https://<host>:8888/ or :8889/ directly -
# that's expected. Users need to accept it once per browser before the
# embedded live-view iframe will load (iframes can't show that warning
# themselves).
set -e

CERT_DIR="$(dirname "$0")/certs"
mkdir -p "$CERT_DIR"

PRIMARY_HOST="${1:-localhost}"
SAN="DNS:localhost,DNS:camera-proxy,IP:127.0.0.1"
for host in "$@"; do
  SAN="${SAN},DNS:${host}"
done

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -subj "/CN=${PRIMARY_HOST}" \
  -addext "subjectAltName=${SAN}"

echo "Wrote $CERT_DIR/server.key and $CERT_DIR/server.crt (SAN: ${SAN})"
