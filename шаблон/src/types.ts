export type Place = 'A-left-bottom' | 'B-strip';

export type Cue = {
  id: string;
  /** секунда от начала ИСХОДНОГО файла */
  at: number;
  until: number;
  place: Place;
  lines: string[];
  accent?: string;
  size?: number;
  /** Тип события — включает звук из таблицы соответствий библиотеки.
   *  Появление вывода озвучивается всегда; тип ЗАМЕНЯЕТ штатный свитч. */
  тип?: 'скриншот' | 'успех' | 'ошибка' | 'уведомление' | 'пометка' | 'акцент';
  note?: string;
};

/** Замазка приватного. rect — координаты в кадре композиции. */
export type Effect = {
  from: number;
  to: number;
  rect: [number, number, number, number];
  radius: number;
  round?: number;
  note?: string;
};

/** Слово субтитра: t — секунда начала в исходнике. */
export type SubWord = { t: number; w: string };

/** Строка субтитров: показывается целиком, слово под голосом подсвечивается. */
export type Sub = { at: number; until: number; words: SubWord[] };

/** Ключ крупности: в секунду at кадр должен иметь масштаб scale.
 *  cut: true — резкая склейка: масштаб меняется скачком, и Sounds ставит на неё whip. */
export type ZoomKey = { at: number; scale: number; cut?: boolean; note?: string };

export type Fragment = {
  id: string;
  clip: string;
  from: number;
  to: number;
  mode: 'A' | 'B';
  note?: string;
};
