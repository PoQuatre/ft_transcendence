#!/bin/bash

perf record -F 99 -g -- ./build/native-debug/src/game
perf script >out.perf
stackcollapse-perf.pl out.perf >out.stack
flamegraph.pl out.stack >out.svg
