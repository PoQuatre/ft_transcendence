#!/usr/bin/env bash
set -o pipefail

declare -A pkg_dirs

while IFS=$'\t' read -r pkg dir; do
	pkg_dirs["$pkg"]="$dir"
done < <(go list -f '{{.ImportPath}}{{"\t"}}{{.Dir}}' ./...)

parse_go_test() {
	jq -j '
        select(.Action == "output" and .Package and .Output)
        | .Package, "\u0000", .Output, "\u0000"
    ' |
		while IFS= read -r -d '' pkg && IFS= read -r -d '' output; do
			# Keep the normal test output.
			printf '%s' "$output"

			# Example:
			#     server_test.go:17: status = 200, want 201
			if [[ "$output" =~ ^[[:space:]]*(.+\.go):([0-9]+):[[:space:]]*(.*)$ ]]; then
				file="${BASH_REMATCH[1]}"
				line="${BASH_REMATCH[2]}"
				message="${BASH_REMATCH[3]}"

				full_path="${pkg_dirs[$pkg]}/$file"

				printf '::error file=%s,line=%s::%s\n' \
					"$full_path" \
					"$line" \
					"$message"
			fi
		done
}

go test -json "$@" | parse_go_test

# Preserve the exit status from `go test`, not from the parser.
exit "${PIPESTATUS[0]}"
