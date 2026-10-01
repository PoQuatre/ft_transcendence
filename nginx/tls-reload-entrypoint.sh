#!/bin/sh
set -eu

revision_file="${NGINX_TLS_REVISION_FILE:-/run/nginx-tls/revision}"

revision_state() {
	stat -c '%d:%i:%Y:%s' "$revision_file" 2>/dev/null || true
}

# Run independently so the upstream entrypoint can generate its configuration
# and start Nginx as usual.
(
	# The nginx-agent health check guarantees this exists before Nginx starts.
	# Do not reload for the first revision: Nginx loads that pair during startup.
	while [ ! -s "$revision_file" ]; do
		sleep 1
	done
	last_revision=$(revision_state)

	while :; do
		sleep 1
		current_revision=$(revision_state)
		[ -n "$current_revision" ] || continue
		[ "$current_revision" = "$last_revision" ] && continue

		if nginx -t && nginx -s reload; then
			last_revision=$current_revision
		else
			echo "TLS revision changed, but Nginx could not reload" >&2
		fi
	done
) &

exec /docker-entrypoint.sh "$@"
