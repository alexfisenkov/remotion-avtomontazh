#!/usr/bin/env bash
# Синтезирует нейтральный фоновый пэд для подложки под речь. Права наши, CC0.
# Запуск: синтез-музыки.sh [папка-вывода]   (по умолчанию ../music)
set -euo pipefail
command -v sox >/dev/null || { echo "Нужен sox: brew install sox / apt install sox" >&2; exit 1; }
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="${1:-$here/../music}"
mkdir -p "$out"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
R="-r 48000 -c 2"

# Спокойный дрон: квинта A2+E3 синусами + тёплый шумовой воздух, медленное
# дыхание тремоло. 30 с, зациклится компонентом Music через loop.
sox -n $R "$tmp/a.wav" synth 30 sine 110 tremolo 0.11 22
sox -n $R "$tmp/e.wav" synth 30 sine 164.81 tremolo 0.09 18
sox -n $R "$tmp/air.wav" synth 30 pinknoise lowpass 600 tremolo 0.07 30
sox -m -v 0.5 "$tmp/a.wav" -v 0.35 "$tmp/e.wav" -v 0.12 "$tmp/air.wav" "$tmp/mix.wav" \
  lowpass 1200 fade t 2 30 2
sox "$tmp/mix.wav" "$out/pad-calm.wav" gain -n -3
echo "Готово: $out/pad-calm.wav ($(ls -lh "$out/pad-calm.wav" | awk '{print $5}'))"
