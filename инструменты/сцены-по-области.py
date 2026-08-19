#!/usr/bin/env python3
"""Ищет, когда в заданной области кадра светло, а когда темно, и печатает отрезки.

Зачем: в смонтированном видео режимы кадра (камера на весь экран / сплит со
скринкастом) отличаются тем, что какая-то область стабильно чёрная. Одним
проходом ffmpeg по всему файлу это находится за секунды — глазами искать
границы по 13 минутам бессмысленно.

Как работает: ffmpeg усредняет выбранный прямоугольник до одного пикселя на
кадр (scale=1:1 с area-фильтром) и отдаёт поток яркостей. Дальше — порог и
склейка соседних кадров в отрезки.

Примеры:
  # где нижняя полоса под панелью камеры чёрная — это режим сплита
  сцены-по-области.py video.mp4 --rect 600,960,1300,110 --fps 2

  # где экран телефона светлый (светлая тема Telegram)
  сцены-по-области.py video.mp4 --rect 80,300,400,500 --fps 1 --threshold 150
"""
import argparse
import subprocess
import sys


def яркости(видео: str, rect: str, fps: float) -> list[int]:
    x, y, w, h = rect.split(',')
    цепочка = f'fps={fps},crop={w}:{h}:{x}:{y},scale=1:1:flags=area'
    команда = [
        'ffmpeg', '-v', 'error', '-i', видео,
        '-vf', цепочка, '-f', 'rawvideo', '-pix_fmt', 'gray', '-',
    ]
    готово = subprocess.run(команда, capture_output=True)
    if готово.returncode != 0:
        sys.exit(f'ffmpeg не смог прочитать видео:\n{готово.stderr.decode()[:500]}')
    return list(готово.stdout)


def отрезки(значения: list[int], порог: int, fps: float, минимум: float):
    if not значения:
        sys.exit('ffmpeg вернул пустой поток — проверьте путь к видео и координаты области.')
    ряд = []
    текущее = значения[0] >= порог
    начало = 0
    for i in range(1, len(значения)):
        сейчас = значения[i] >= порог
        if сейчас != текущее:
            ряд.append((текущее, начало / fps, i / fps))
            текущее, начало = сейчас, i
    ряд.append((текущее, начало / fps, len(значения) / fps))
    return [о for о in ряд if о[2] - о[1] >= минимум]


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('видео')
    p.add_argument('--rect', required=True, help='x,y,w,h — область в координатах кадра')
    p.add_argument('--fps', type=float, default=2, help='частота выборки, кадров в секунду (по умолчанию 2)')
    p.add_argument('--threshold', type=int, default=20, help='порог яркости 0–255 (по умолчанию 20)')
    p.add_argument('--min', type=float, default=1.0, help='не показывать отрезки короче, с (по умолчанию 1)')
    a = p.parse_args()

    if len(a.rect.split(',')) != 4:
        sys.exit('--rect задаётся как x,y,w,h — четыре числа через запятую.')

    v = яркости(a.видео, a.rect, a.fps)
    print(f'выборок: {len(v)}  длительность ~{len(v)/a.fps:.1f} с  '
          f'яркость {min(v)}–{max(v)}  порог {a.threshold}', file=sys.stderr)
    if min(v) >= a.threshold or max(v) < a.threshold:
        print('ВНИМАНИЕ: порог не делит выборку — все кадры по одну сторону. '
              'Подберите --threshold между min и max.', file=sys.stderr)

    for светло, начало, конец in отрезки(v, a.threshold, a.fps, a.min):
        метка = 'светло' if светло else 'темно '
        print(f'{метка}  {начало:8.2f} -> {конец:8.2f}   ({конец - начало:6.2f} с)')


if __name__ == '__main__':
    main()
