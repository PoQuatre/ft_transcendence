#!/bin/sh
set -eu

umask 077

: "${PGWEB_ROLE_ID:?PGWEB_ROLE_ID is required}"
printf '%s\n' "$PGWEB_ROLE_ID" > /vault/file/pgweb-role-id

exec vault agent -config=/vault/config/agent.hcl
