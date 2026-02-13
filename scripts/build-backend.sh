#!/usr/bin/env bash
# Build Go backend sidecar for Electron packaging.
# Produces statically linked binaries for macOS (arm64, amd64) and Linux (amd64).
#
# Usage:
#   ./scripts/build-backend.sh           # Build all platforms
#   ./scripts/build-backend.sh current   # Build for current platform only
#
# For macOS code signing, set CSC_LINK and CSC_KEY_PASSWORD env vars (CI secrets).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
OUTPUT_DIR="$PROJECT_ROOT/backend/bin"

mkdir -p "$OUTPUT_DIR"

build_binary() {
  local goos="$1"
  local goarch="$2"
  local output_name="bmad-backend-${goos}-${goarch}"

  echo "[build-backend] Building ${output_name}..."
  (
    cd "$BACKEND_DIR"
    GOOS="$goos" GOARCH="$goarch" CGO_ENABLED=0 \
      go build -ldflags="-s -w" -o "$OUTPUT_DIR/$output_name" .
  )
  echo "[build-backend] Built: $OUTPUT_DIR/$output_name"
}

if [ "${1:-}" = "current" ]; then
  # Build only for the current platform
  CURRENT_OS="$(go env GOOS)"
  CURRENT_ARCH="$(go env GOARCH)"
  build_binary "$CURRENT_OS" "$CURRENT_ARCH"
else
  # Build all supported platforms
  build_binary darwin arm64
  build_binary darwin amd64
  build_binary linux amd64
fi

echo "[build-backend] Done."
