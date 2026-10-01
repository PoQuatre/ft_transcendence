#!/bin/sh
set -eu

tls_dir=/run/nginx-tls
bundle="$tls_dir/.nginx-agent.pem"
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
	/^__NGINX_PKI_KEY__$/ { key = 1; next }
	key { print > key_file; next }
	{ print > cert_file }
' "$bundle"

test -s "$staging_dir/server.crt"
test -s "$staging_dir/server.key"
chmod 0644 "$staging_dir/server.crt" "$staging_dir/server.key"

# Nginx only reloads after both members of the new pair are in place. Existing
# workers keep serving the previous TLS context until that graceful reload.
mv "$staging_dir/server.crt" "$tls_dir/server.crt"
mv "$staging_dir/server.key" "$tls_dir/server.key"

printf 'updated\n' > "$staging_dir/revision"
chmod 0644 "$staging_dir/revision"
mv "$staging_dir/revision" "$tls_dir/revision"
