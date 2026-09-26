#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

INIT_FILE=${INIT_FILE:-/bootstrap/init.json}
POLICIES_DIR=${POLICIES_DIR:-/bootstrap/policies}
STATE_FILE=${STATE_FILE:-/bootstrap/managed.json}
HEALTHCHECK_FILE=${HEALTHCHECK_FILE:-/tmp/vault-bootstrap-healthy}
DEFAULT_POLICIES=${DEFAULT_POLICIES:-}

declare -a MANAGED_POLICIES=()
declare -a MANAGED_ROLES=()
declare -A EMPTY_POLICY_WARNINGS=()

umask 077

first_boot=true
sleep_pid=

shutdown() {
	echo "Stopping Vault bootstrap..."
	if [[ -n "$sleep_pid" ]]; then
		kill "$sleep_pid" 2>/dev/null || true
		wait "$sleep_pid" 2>/dev/null || true
	fi
	exit 0
}

trap shutdown INT TERM

first_boot_echo() {
	if $first_boot; then
		echo "$@"
	fi
}

contains() {
	local needle=$1
	shift

	local value
	for value; do
		[[ "$value" == "$needle" ]] && return
	done

	return 1
}

load_managed_state() {
	if [[ ! -f "$STATE_FILE" ]]; then
		return
	fi

	if ! jq -e '(.policies | type == "array") and (.roles | type == "array")' "$STATE_FILE" >/dev/null; then
		echo "ERROR: $STATE_FILE is invalid."
		exit 1
	fi

	mapfile -t MANAGED_POLICIES < <(jq -r '.policies[]' "$STATE_FILE")
	mapfile -t MANAGED_ROLES < <(jq -r '.roles[]' "$STATE_FILE")
}

save_managed_state() {
	local policies roles tmp
	policies=$(jq -cn --args '$ARGS.positional' "${MANAGED_POLICIES[@]}")
	roles=$(jq -cn --args '$ARGS.positional' "${MANAGED_ROLES[@]}")
	tmp=$(mktemp "$STATE_FILE.XXXXXX")

	jq -n --argjson policies "$policies" --argjson roles "$roles" \
		'{policies: $policies, roles: $roles}' >"$tmp"
	mv "$tmp" "$STATE_FILE"
}

init_vault() {
	first_boot_echo "Waiting for Vault..."

	local response
	until response=$(curl -fsSL "$VAULT_ADDR/v1/sys/init"); do
		sleep 1
	done

	if printf '%s\n' "$response" | jq -e '.initialized == true' >/dev/null; then
		first_boot_echo "Vault already initialized."
		return
	fi

	echo "Initializing Vault..."

	local tmp
	tmp=$(mktemp "$INIT_FILE.XXXXXX")

	vault operator init \
		-key-shares=1 \
		-key-threshold=1 \
		-format=json \
		>"$tmp"
	mv "$tmp" "$INIT_FILE"

	echo "Vault initialized."
}

unseal_vault() {
	if [ ! -f "$INIT_FILE" ]; then
		echo "ERROR: Vault is initialized but $INIT_FILE is missing."
		echo "Cannot automatically unseal."
		exit 1
	fi

	local response
	if ! response=$(curl -fsSL "$VAULT_ADDR/v1/sys/seal-status"); then
		return 1
	fi

	export VAULT_TOKEN
	VAULT_TOKEN=$(jq -er '.root_token' "$INIT_FILE")

	local unseal_key
	unseal_key=$(jq -er '.unseal_keys_b64[0]' "$INIT_FILE")

	if printf '%s\n' "$response" | jq -e '.sealed == false' >/dev/null; then
		first_boot_echo "Vault already unsealed."
		return
	fi

	echo "Unsealing Vault..."
	vault operator unseal "$unseal_key"
	echo "Vault unsealed."

	until vault status >/dev/null 2>&1; do
		sleep 1
	done
}

enable_features() {
	if ! vault secrets list -format=json | jq -e 'has("secret/")' >/dev/null; then
		echo "Enabling KV v2 secrets engine..."
		vault secrets enable -path=secret/ kv-v2
	fi

	if ! vault auth list -format=json | jq -e 'has("approle/")' >/dev/null; then
		echo "Enabling AppRole auth method..."
		vault auth enable approle
	fi

	if ! vault secrets list -format=json | jq -e 'has("database/")' >/dev/null; then
		echo "Enabling Database Secrets Engine..."
		vault secrets enable database
	fi

	if ! vault read -format=json database/config/postgres >/dev/null 2>&1; then
		echo "Configuring PostgreSQL database connection..."
		vault write database/config/postgres \
			plugin_name="postgresql-database-plugin" \
			allowed_roles="app-readonly,app-readwrite,app-migrate,app-admin" \
			connection_url="postgres://{{username}}:{{password}}@$POSTGRES_HOST/$POSTGRES_DB" \
			username="vault_admin" \
			password="$POSTGRES_VAULT_PASSWORD" \
			password_authentication="scram-sha-256"

		vault write -force database/rotate-root/postgres
	fi
}

register_policies() {
	local -a prev_policies=("${MANAGED_POLICIES[@]}")
	local -a registered_policies=()
	local -a present_policies=()

	for file in "$POLICIES_DIR"/*.hcl; do
		local policy_name
		policy_name=$(basename "$file" .hcl)
		present_policies+=("$policy_name")

		if [ ! -s "$file" ]; then
			if [[ ! -v 'EMPTY_POLICY_WARNINGS[$policy_name]' ]]; then
				printf "Policy '%s' is empty, skipping.\n" "$policy_name"
				EMPTY_POLICY_WARNINGS["$policy_name"]=1
			fi

			if contains "$policy_name" "${prev_policies[@]}"; then
				registered_policies+=("$policy_name")
			fi
			continue
		fi
		unset 'EMPTY_POLICY_WARNINGS[$policy_name]'

		local old new
		old=$(mktemp)
		new=$(mktemp)

		cp "$file" "$new"

		if ! vault policy read "$policy_name" >"$old" 2>/dev/null; then
			printf "Registering policy '%s'...\n" "$policy_name"
			vault policy write "$policy_name" "$new"
		else
			vault policy fmt "$old" >/dev/null
			vault policy fmt "$new" >/dev/null

			if ! cmp -s "$old" "$new"; then
				printf "Updating policy '%s'...\n" "$policy_name"
				vault policy write "$policy_name" "$new"
			fi
		fi

		registered_policies+=("$policy_name")
		rm -f "$old" "$new"
	done

	for policy in "${prev_policies[@]}"; do
		if ! contains "$policy" "${present_policies[@]}"; then
			printf "Unregistering policy '%s'...\n" "$policy"
			vault policy delete "$policy"
		fi
	done

	MANAGED_POLICIES=("${registered_policies[@]}")
}

normalize_policies() {
	jq -Rr '
		split(",")
		| map(gsub("^\\s+|\\s+$"; ""))
		| sort
		| unique
		| join(",")
	'
}

register_roles() {
	local -a prev_roles=("${MANAGED_ROLES[@]}")
	local -a registered_roles=()

	while IFS= read -r role_id_var; do
		local prefix=${role_id_var%_ROLE_ID}
		local policies_var=${prefix}_ROLE_POLICIES

		local role_name=${prefix,,}
		role_name=${role_name//_/-}

		local desired_role_id=${!role_id_var}
		local desired_policies=${!policies_var:-"$DEFAULT_POLICIES"}
		local normalized_desired_policies
		normalized_desired_policies=$(normalize_policies <<<"$desired_policies")

		local role_exists=false
		local policies_changed=false
		local role_id_changed=false

		local current_role
		if current_role=$(vault read -format=json auth/approle/role/"$role_name" 2>/dev/null); then
			role_exists=true

			local normalized_current_policies
			normalized_current_policies=$(
				jq -r '
					.data.token_policies
					| sort
					| unique
					| join(",")
				' <<<"$current_role"
			)

			local current_role_id
			current_role_id=$(vault read -format=json auth/approle/role/"$role_name"/role-id | jq -r '.data.role_id')

			if [[ "$normalized_current_policies" != "$normalized_desired_policies" ]]; then
				policies_changed=true
			fi

			if [[ "$current_role_id" != "$desired_role_id" ]]; then
				role_id_changed=true
			fi
		fi

		if ! $role_exists; then
			printf "Registering role '%s'....\n" "$role_name"

			vault write auth/approle/role/"$role_name" \
				token_policies="$desired_policies" \
				token_period="1h" \
				secret_id_ttl="0" \
				secret_id_num_uses="0"

			vault write auth/approle/role/"$role_name"/role-id \
				role_id="$desired_role_id"
		elif $policies_changed || $role_id_changed; then
			printf "Updating role '%s'...\n" "$role_name"

			if $policies_changed; then
				vault write auth/approle/role/"$role_name" \
					token_policies="$desired_policies"
			fi

			if $role_id_changed; then
				vault write auth/approle/role/"$role_name"/role-id \
					role_id="$desired_role_id"
			fi
		fi

		local secret_id_file=/credentials/"$role_name"/secret_id
		if [[ -d ${secret_id_file%/*} ]]; then
			if [[ ! -f "$secret_id_file" ]] ||
				! vault write auth/approle/role/"$role_name"/secret-id/lookup \
					secret_id="$(<"$secret_id_file")" >/dev/null 2>&1; then
				printf "Generating Secret ID for role '%s'...\n" "$role_name"

				local tmp
				tmp=$(mktemp "$secret_id_file.XXXXXX")
				chmod 0640 "$tmp"
				vault write -format=json -force auth/approle/role/"$role_name"/secret-id |
					jq -er '.data.secret_id' >"$tmp"
				mv "$tmp" "$secret_id_file"
			fi
		fi

		registered_roles+=("$role_name")
	done < <(compgen -e | grep '._ROLE_ID$')

	for role in "${prev_roles[@]}"; do
		if ! contains "$role" "${registered_roles[@]}"; then
			printf "Unregistering role '%s'...\n" "$role"
			vault delete auth/approle/role/"$role"
		fi
	done

	MANAGED_ROLES=("${registered_roles[@]}")
}

register_db_roles() {
	for role in "app-readonly" "app-readwrite" "app-migrate" "app-admin"; do
		if ! vault read -format=json database/roles/"$role" >/dev/null 2>&1; then
			printf "Registering database role '%s'...\n" "$role"

			vault write database/roles/"$role" \
				db_name="$POSTGRES_DB" \
				creation_statements="
					CREATE ROLE \"{{name}}\"
					WITH LOGIN PASSWORD '{{password}}'
					VALID UNTIL '{{expiration}}';
					GRANT \"${role//-/_}\" TO \"{{name}}\";
				" \
				renew_statements="
					ALTER ROLE \"{{name}}\" VALID UNTIL '{{expiration}}';
				" \
				default_ttl="1h" \
				max_ttl="24h"
		fi
	done
}

main() {
	rm -f "$HEALTHCHECK_FILE"
	load_managed_state

	while true; do
		init_vault
		unseal_vault
		enable_features
		register_policies
		register_roles
		register_db_roles
		save_managed_state

		touch "$HEALTHCHECK_FILE"
		first_boot=false

		sleep 10 &
		sleep_pid=$!
		wait "$sleep_pid"
		sleep_pid=
	done
}

[[ "${BASH_SOURCE[0]}" == "$0" ]] && main
