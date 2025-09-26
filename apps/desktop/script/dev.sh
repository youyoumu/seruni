#!/bin/env bash
ROARR_LOG=true ${ELECTRON_BIN:-electron} --ozone-platform=wayland ./script/vite_dev.ts | roarr
