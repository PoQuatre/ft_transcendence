#!/bin/sh
set -u

watcher=

stop() {
	kill "$watcher" 2>/dev/null
	wait "$watcher" 2>/dev/null
	exit 0
}

trap stop TERM

build() {
	cmake --preset web-debug -DCMAKE_EXPORT_COMPILE_COMMANDS=OFF || return
	cmake --build --preset web-debug --parallel || return
	cp build/web-debug/src/game.mjs build/web-debug/src/game.wasm /out/ || return
	date +%s%N >/out/.build-id || return
	mv /out/.build-id /out/build-id
}

date +%s%N >/out/build-id

if ! build; then
	printf '%s\n' 'Initial game build failed; waiting for source changes.' >&2
fi

while :; do
	inotifywait -qr -e close_write,create,delete,move \
		src CMakeLists.txt CMakePresets.json &
	watcher=$!
	wait "$watcher" || break

	if ! build; then
		printf '%s\n' 'Game build failed; waiting for source changes.' >&2
	fi
done
