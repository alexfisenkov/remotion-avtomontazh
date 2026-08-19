#!/usr/bin/env python3
"""Собирает контактный лист кадров с подписанным временем — чтобы просмотреть
длинный отрезок видео одним взглядом.

Зачем: чтобы найти на скринкасте все места с чужой перепиской или понять, какой
экран показан в конкретную секунду, надо увидеть много кадров сразу. Время
подписывается прямо на плитке: без подписей приходится считать позицию плитки
в уме, и на этом легко ошибиться.

Работает в два прохода по крупности:
  1. Широкий шаг (--fps 0.33) по всему видео — найти интересные участки.
  2. Мелкий шаг (--fps 4) вокруг границы — уточнить её до четверти секунды.

Примеры:
  # весь скринкаст телефона, кадр раз в 3 секунды
  контрольный-лист.py video.mp4 --rect 35,0,530,1080 --from 190 --to 768 --fps 0.33 -o лист.jpg

  # уточнить границу: где именно экран сменился
  контрольный-лист.py video.mp4 --rect 35,0,530,300 --from 215 --to 218 --fps 4 -o граница.jpg
"""
import argparse
import subprocess
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit('Нужен Pillow: pip3 install pillow')

ШРИФТЫ = [
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
]


def шрифт(размер: int):
    for путь in ШРИФТЫ:
        try:
            return ImageFont.truetype(путь, размер)
        except OSError:
            continue
    return ImageFont.load_default()


def кадры(видео, rect, начало, конец, fps, ширина):
    x, y, w, h = (int(v) for v in rect.split(','))
    высота = max(2, round(h * ширина / w) // 2 * 2)
    команда = [
        'ffmpeg', '-v', 'error', '-ss', str(начало), '-to', str(конец), '-i', видео,
        '-vf', f'fps={fps},crop={w}:{h}:{x}:{y},scale={ширина}:{высота}',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
    ]
    готово = subprocess.run(команда, capture_output=True)
    if готово.returncode != 0:
        sys.exit(f'ffmpeg не смог прочитать видео:\n{готово.stderr.decode()[:500]}')
    размер = ширина * высота * 3
    сырьё = готово.stdout
    return [
        Image.frombytes('RGB', (ширина, высота), сырьё[i * размер:(i + 1) * размер])
        for i in range(len(сырьё) // размер)
    ], высота


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('видео')
    p.add_argument('--rect', required=True, help='x,y,w,h — какую часть кадра брать')
    p.add_argument('--from', dest='начало', type=float, required=True, help='с какой секунды')
    p.add_argument('--to', dest='конец', type=float, required=True, help='по какую секунду')
    p.add_argument('--fps', type=float, default=1, help='кадров в секунду (по умолчанию 1)')
    p.add_argument('--cols', type=int, default=10, help='плиток в ряду (по умолчанию 10)')
    p.add_argument('--width', type=int, default=190, help='ширина плитки, px (по умолчанию 190)')
    p.add_argument('-o', '--out', required=True, help='куда сохранить лист (.jpg или .png)')
    a = p.parse_args()

    if len(a.rect.split(',')) != 4:
        sys.exit('--rect задаётся как x,y,w,h — четыре числа через запятую.')
    if a.конец <= a.начало:
        sys.exit('--to должен быть больше --from.')

    плитки, высота_плитки = кадры(a.видео, a.rect, a.начало, a.конец, a.fps, a.width)
    if not плитки:
        sys.exit('Ни одного кадра не получено. Проверьте путь, --from/--to и координаты.')

    подпись = 22
    ячейка_h = высота_плитки + подпись
    рядов = (len(плитки) + a.cols - 1) // a.cols
    лист = Image.new('RGB', (a.cols * a.width, рядов * ячейка_h), (17, 17, 17))
    рисунок = ImageDraw.Draw(лист)
    ф = шрифт(15)

    for i, плитка in enumerate(плитки):
        кол, ряд = i % a.cols, i // a.cols
        левый, верхний = кол * a.width, ряд * ячейка_h
        лист.paste(плитка, (левый, верхний))
        секунда = a.начало + i / a.fps
        метка = f'{int(секунда // 60):d}:{секунда % 60:05.2f}  ({секунда:.2f})'
        рисунок.text((левый + 5, верхний + высота_плитки + 3), метка, fill=(255, 194, 32), font=ф)

    лист.save(a.out, quality=90)
    print(f'{a.out}: {len(плитки)} кадров, {рядов} рядов, шаг {1 / a.fps:.2f} с')
    print(f'Диапазон {a.начало:.2f}–{a.начало + (len(плитки) - 1) / a.fps:.2f} с. '
          f'Время подписано под каждой плиткой — считать позиции в уме не надо.')


if __name__ == '__main__':
    main()
