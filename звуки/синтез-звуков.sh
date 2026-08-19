#!/usr/bin/env bash
# Синтезирует недостающие звуки библиотеки через sox. Права на результат — наши
# (звук, порождённый командой, не имеет чужого автора), лицензия CC0: файлы можно
# класть в публичный репозиторий. Запуск: путь/к/синтез-звуков.sh [папка-вывода]
# Все файлы: 48 кГц, моно, пик −3 дБFS — как у остальной библиотеки.
set -euo pipefail
command -v sox >/dev/null || { echo "Нужен sox: brew install sox / apt install sox" >&2; exit 1; }

# Папка вывода: рядом со скриптом (раскладка репозитория) или на уровень выше
# (раскладка проекта, где скрипт живёт в tools/). Создаём в любом случае.
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$here/sounds" ]; then default_out="$here/sounds"; else default_out="$here/../sounds"; fi
out="${1:-$default_out}"
mkdir -p "$out"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
R="-r 48000 -c 1"

riser() { # $1 длительность, $2 имя
  local d="$1" f="$2"
  # Два слоя: шумовое нарастание + восходящий тон. Огибающая почти до конца,
  # обрыв короткий — райзер должен КОНЧАТЬСЯ на событии, а не переживать его.
  sox -n $R "$tmp/n.wav" synth "$d" whitenoise lowpass 3800 fade t "$(echo "$d*0.88" | bc)" "$d" 0.06
  sox -n $R "$tmp/t.wav" synth "$d" sine 160:700 fade t "$(echo "$d*0.88" | bc)" "$d" 0.06
  sox -m -v 0.42 "$tmp/n.wav" -v 0.5 "$tmp/t.wav" "$out/$f" gain -n -3
}
riser 0.5 riser-05s.wav
riser 1.0 riser-1s.wav
riser 2.0 riser-2s.wav

# Поп: короткий нисходящий синус с мягкой атакой — «пузырёк», не «пищалка».
sox -n $R "$out/pop-soft.wav" synth 0.09 sine 430:290 fade q 0.004 0.09 0.06 gain -n -3

# Тик: узкий квадрат, почти щелчок.
sox -n $R "$out/tick.wav" synth 0.03 square 1700 lowpass 6000 fade t 0.001 0.03 0.02 gain -n -3

# Мягкая ошибка: два нисходящих тона, без комизма windows-звука.
sox -n $R "$tmp/e1.wav" synth 0.13 sine 330 fade q 0.008 0.13 0.05
sox -n $R "$tmp/e2.wav" synth 0.19 sine 233 fade q 0.008 0.19 0.12
sox -v 0.6 "$tmp/e1.wav" "$tmp/e2.wav" "$out/error-soft.wav" lowpass 2200 gain -n -3
# Карандаш: пять коротких штрихов фильтрованного шума с паузами — ритм письма.
# Имена переменных латиницей: bash 3.2 на macOS кириллицу в идентификаторах не берёт.
i=0
strokes=()
for d in 0.09 0.07 0.11 0.06 0.08; do
  sox -n $R "$tmp/s$i.wav" synth "$d" whitenoise band 2600 1400 fade t 0.008 "$d" 0.02
  sox -n $R "$tmp/g$i.wav" trim 0 0.045
  strokes+=("$tmp/s$i.wav" "$tmp/g$i.wav")
  i=$((i+1))
done
sox "${strokes[@]}" "$out/pencil.wav" gain -n -3

# Мягкий свист для шторок: шумовой горб с полосой, короче и мягче whoosh.
sox -n $R "$tmp/w.wav" synth 0.35 whitenoise band 1200 900 fade q 0.12 0.35 0.18
sox "$tmp/w.wav" "$out/whoosh-soft.wav" gain -n -3

echo "Синтезировано в $out:"
ls -la "$out" | grep -E "riser|pop-soft|tick|error-soft|pencil|whoosh-soft" | awk '{print "  " $9, $5 " байт"}'
