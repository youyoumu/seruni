#!/bin/env bash

set -o pipefail

ARGS=("./script/dev")

if [[ "$SSH_PREFER_FISH" != "1" ]]; then
  ARGS=(--ozone-platform=wayland "${ARGS[@]}")
fi

${ELECTRON_BIN:-electron} "${ARGS[@]}" | roarr
exit "${PIPESTATUS[0]}"
