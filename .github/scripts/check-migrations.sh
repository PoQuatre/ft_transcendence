#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_DIR="${1:-./backend/migrations}"
MIGRATION_REGEX='^([0-9]{4})_([0-9a-z_-]+)\.(tx\.)?(up|down)\.sql$'

annotation_error() {
	local file=$1
	local message=$2

	if [[ "${CI:-}" == "true" ]]; then
		printf '::error file=%s,line=1::%s\n' "$file" "$message"
	fi
}

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
	echo "ERROR: Migration directory not found: $MIGRATIONS_DIR"
	exit 1
fi

echo "Checking migrations in $MIGRATIONS_DIR..."

errors=0

declare -A seen_ids

declare -A up_migrations
declare -A down_migrations

while IFS= read -r -d '' file; do
	filename=${file##*/}

	if [[ ! "$filename" =~ $MIGRATION_REGEX ]]; then
		echo "ERROR: Invalid migration filename: $filename"
		annotation_error "$file" "Invalid migration filename: $filename"
		errors=$((errors + 1))
		continue
	fi

	id=${BASH_REMATCH[1]}
	desc=${BASH_REMATCH[2]}
	migration_direction=${BASH_REMATCH[4]}
	stem="${id}_${desc}"

	if [[ -n "${seen_ids[$id]:-}" ]]; then
		existing_stem=${seen_ids[$id]}
		if [[ "$existing_stem" != "$stem" ]]; then
			echo "ERROR: Duplicate migration ID $id:"
			echo "  - $existing_stem"
			echo "  - $stem"
			annotation_error "$file" "Duplicate migration ID $id; conflicts with $existing_stem."

			errors=$((errors + 1))
		fi
	else
		seen_ids[$id]=$stem
	fi

	if [[ "$migration_direction" == "up" ]]; then
		if [[ -n "${up_migrations[$stem]:-}" ]]; then
			echo "ERROR: Multiple up migrations for $stem:"
			echo "  - ${up_migrations[$stem]}"
			echo "  - $filename"
			annotation_error "$file" "Multiple up migrations for $stem; conflicts with ${up_migrations[$stem]}."

			errors=$((errors + 1))
		else
			up_migrations[$stem]=$filename
		fi
	else
		if [[ -n "${down_migrations[$stem]:-}" ]]; then
			echo "ERROR: Multiple down migrations for $stem:"
			echo "  - ${down_migrations[$stem]}"
			echo "  - $filename"
			annotation_error "$file" "Multiple down migrations for $stem; conflicts with ${down_migrations[$stem]}."

			errors=$((errors + 1))
		else
			down_migrations[$stem]=$filename
		fi
	fi
done < <(
	find "$MIGRATIONS_DIR" \
		-maxdepth 1 \
		-type f \
		-name '*.sql' \
		-print0 | sort -z
)

for stem in "${!up_migrations[@]}"; do
	if [[ -z "${down_migrations[$stem]:-}" ]]; then
		echo "ERROR: Missing down migration for ${up_migrations[$stem]}"
		echo "  Expected one of:"
		echo "    ${stem}.down.sql"
		echo "    ${stem}.tx.down.sql"
		annotation_error \
			"$MIGRATIONS_DIR/${up_migrations[$stem]}" \
			"Missing down migration for ${up_migrations[$stem]}."

		errors=$((errors + 1))
	fi
done

for stem in "${!down_migrations[@]}"; do
	if [[ -z "${up_migrations[$stem]:-}" ]]; then
		echo "ERROR: Missing up migration for ${down_migrations[$stem]}"
		echo "  Expected one of:"
		echo "    ${stem}.up.sql"
		echo "    ${stem}.tx.up.sql"
		annotation_error \
			"$MIGRATIONS_DIR/${down_migrations[$stem]}" \
			"Missing up migration for ${down_migrations[$stem]}."

		errors=$((errors + 1))
	fi
done

if ((errors > 0)); then
	echo
	echo "Migration validation failed with $errors error(s)."
	exit 1
fi

echo "All migrations passed validation."
