#!/usr/bin/env bash
# Совместимость: прежний вход. Вся логика — в развернуть-проект.mjs (кроссплатформенный).
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/развернуть-проект.mjs" "$@"
