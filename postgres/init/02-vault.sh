#!/usr/bin/env bash
set -euo pipefail

if [ -n "${POSTGRES_VAULT_PASSWORD:-}" ] && [ -n "${POSTGRES_VAULT_PASSWORD_FILE:-}" ]; then
	echo "POSTGRES_VAULT_PASSWORD and POSTGRES_VAULT_PASSWORD_FILE are both set" >&2
	exit 1
fi

if [ -n "${POSTGRES_VAULT_PASSWORD_FILE:-}" ]; then
	if [ ! -f "$POSTGRES_VAULT_PASSWORD_FILE" ]; then
		echo "POSTGRES_VAULT_PASSWORD_FILE does not point to a file: $POSTGRES_VAULT_PASSWORD_FILE" >&2
		exit 1
	fi

	export POSTGRES_VAULT_PASSWORD
	POSTGRES_VAULT_PASSWORD="$(<"$POSTGRES_VAULT_PASSWORD_FILE")"
fi

unset POSTGRES_VAULT_PASSWORD_FILE

psql \
	-v ON_ERROR_STOP=1 \
	-U "${POSTGRES_USER:-postgres}" \
	-d "${POSTGRES_DB:-"${POSTGRES_USER:-postgres}"}" <<-'SQL'
		\getenv vault_password POSTGRES_VAULT_PASSWORD

		CREATE ROLE vault_admin LOGIN CREATEROLE PASSWORD :'vault_password';

		GRANT app_readonly, app_readwrite, app_migrate, app_admin
		TO vault_admin WITH ADMIN OPTION;
	SQL

unset POSTGRES_VAULT_PASSWORD POSTGRES_VAULT_PASSWORD_FILE
