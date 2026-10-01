#!/bin/sh
set -eu

umask 077

: "${POSTGRES_PKI_ROLE_ID:?POSTGRES_PKI_ROLE_ID is required}"
printf '%s\n' "$POSTGRES_PKI_ROLE_ID" > /vault/file/postgres-pki-role-id

vault agent -config=/vault/config/postgres-agent.hcl &
agent_pid=$!
printf '%s\n' "$agent_pid" > /run/postgres-tls/agent.pid
chmod 0600 /run/postgres-tls/agent.pid

cleanup() {
	kill "$agent_pid" 2>/dev/null || true
	wait "$agent_pid" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM

while ! { test -s /run/postgres-tls/server.crt && test -s /run/postgres-tls/server.key && test -s /run/postgres-tls/revision; }; do
	if ! kill -0 "$agent_pid" 2>/dev/null; then
		wait "$agent_pid"
	fi
	sleep 1
done

trap - EXIT HUP INT TERM
exec /usr/local/bin/docker-entrypoint.sh "$@"
