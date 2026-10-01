#!/bin/sh
set -eu

umask 077

: "${NGINX_PKI_ROLE_ID:?NGINX_PKI_ROLE_ID is required}"
printf '%s\n' "$NGINX_PKI_ROLE_ID" > /vault/file/nginx-pki-role-id

exec vault agent -config=/vault/config/nginx-agent.hcl
