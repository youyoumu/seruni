#!/bin/env bash

set -o pipefail

ARGS=("./script/dev")

# Only add the Wayland flag if DISPLAY is not set to :0
if [[ "$DISPLAY" != ":0" ]]; then
  ARGS=(--ozone-platform=wayland "${ARGS[@]}")
fi

${ELECTRON_BIN:-electron} "${ARGS[@]}" | roarr
exit "${PIPESTATUS[0]}"
