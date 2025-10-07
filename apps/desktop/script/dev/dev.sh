#!/bin/env bash

set -o pipefail

${ELECTRON_BIN:-electron} --ozone-platform=wayland ./script/dev | roarr
exit "${PIPESTATUS[0]}"
