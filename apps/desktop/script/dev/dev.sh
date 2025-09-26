#!/bin/env bash

set -o pipefail

ROARR_LOG=true ${ELECTRON_BIN:-electron} --ozone-platform=wayland ./script/dev | roarr
exit "${PIPESTATUS[0]}"
