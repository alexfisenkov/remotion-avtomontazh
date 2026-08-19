#!/usr/bin/env bash
# Копирует звуки библиотеки в проект Remotion.
# Запуск: установить.sh <папка-проекта> [имя-звука ...]
# Без списка имён копирует категорию «рабочий» целиком — базовый набор монтажа.
set -euo pipefail

# В репозитории скрипт лежит прямо в звуки/ — библиотека это его папка.
lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project="${1:?Укажите папку проекта: установить.sh <проект> [звук ...]}"
shift || true

command -v python3 >/dev/null || {
  echo "Нужен python3 — он читает манифест. macOS/Linux: обычно уже стоит; Windows: ставьте Python с python.org и перезапустите терминал." >&2
  exit 1
}
[ -d "$project/public" ] || { echo "В $project нет public/ — это проект Remotion?" >&2; exit 1; }
mkdir -p "$project/public/sounds"

if [ $# -eq 0 ]; then
  # Категория «рабочий» из манифеста — без jq, обычным python3.
  names=$(python3 -c "
import json
m = json.load(open('$lib_dir/манифест.json', encoding='utf-8'))
print('\n'.join(v['file'] for v in m['звуки'].values() if v['category'] == 'рабочий'))
")
else
  names=$(python3 -c "
import json, sys
m = json.load(open('$lib_dir/манифест.json', encoding='utf-8'))
for имя in sys.argv[1:]:
    з = m['звуки'].get(имя)
    if not з:
        print(f'Нет звука «{имя}» в манифесте', file=sys.stderr); sys.exit(1)
    print(з['file'])
" "$@")
fi

n=0
while IFS= read -r f; do
  cp "$lib_dir/sounds/$f" "$project/public/sounds/$f"
  n=$((n+1))
done <<< "$names"

echo "Скопировано звуков: $n → $project/public/sounds/"
