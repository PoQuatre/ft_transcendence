#!/bin/sh
set -eu

tls_dir=/run/postgres-tls
bundle="$tls_dir/.postgres-agent.pem"
lock_dir="$tls_dir/.install.lock"
staging_dir=

cleanup() {
	[ -z "$staging_dir" ] || rm -rf "$staging_dir"
	rmdir "$lock_dir" 2>/dev/null || true
}

while ! mkdir "$lock_dir" 2>/dev/null; do
	sleep 1
done
trap cleanup EXIT HUP INT TERM

staging_dir=$(mktemp -d "$tls_dir/.next.XXXXXX")
awk -v cert_file="$staging_dir/server.crt" -v key_file="$staging_dir/server.key" '
	/^__POSTGRES_PKI_KEY__$/ { key = 1; next }
	key { print > key_file; next }
	{ print > cert_file }
' "$bundle"

test -s "$staging_dir/server.crt"
test -s "$staging_dir/server.key"
chmod 0600 "$staging_dir/server.crt" "$staging_dir/server.key"

# PostgreSQL reads the pair only after the revision is written. During a
# renewal, pg_ctl reload applies the new pair without interrupting sessions.
mv "$staging_dir/server.crt" "$tls_dir/server.crt"
mv "$staging_dir/server.key" "$tls_dir/server.key"

if [ -f "${PGDATA}/postmaster.pid" ]; then
	attempt=0
	until pg_ctl reload -D "$PGDATA"; do
		attempt=$((attempt + 1))
		if [ "$attempt" -ge 3 ]; then
			printf 'failed\n' > "$tls_dir/renewal-failed"
			exit 1
		fi
		sleep 1
	done
fi

rm -f "$tls_dir/renewal-failed"
printf 'updated\n' > "$staging_dir/revision"
chmod 0600 "$staging_dir/revision"
mv "$staging_dir/revision" "$tls_dir/revision"
