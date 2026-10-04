#!/bin/bash

perf record -F 99 -g -- ./build/native-debug/src/game
stackcollapse-perf.pl out.perf >out.folded
flamegraph.pl out.folded >out.svg
