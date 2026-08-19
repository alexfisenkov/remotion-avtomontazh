// Oswald лежит рядом, в public/fonts — на рендере в сеть не ходим.
// Через @font-face + document.fonts.load: FontFace-конструктор в отдельных
// вкладках рендера иногда отваливается под нагрузкой, эта схема надёжнее.
import { continueRender, delayRender, staticFile } from 'remotion';

const CYRILLIC = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';
const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

const face = (file: string, range: string) => `
@font-face {
  font-family: 'Oswald';
  font-style: normal;
  font-weight: 200 700;
  font-display: block;
  src: url(${staticFile(file)}) format('woff2');
  unicode-range: ${range};
}`;

const STYLE_ID = 'oswald-face';

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    face('fonts/oswald-cyrillic.woff2', CYRILLIC) + face('fonts/oswald-latin.woff2', LATIN);
  document.head.appendChild(style);
}

const handle = delayRender('Загрузка Oswald', { timeoutInMilliseconds: 120000, retries: 2 });

Promise.all([
  // Кириллица и латиница лежат в разных файлах — тянем оба подмножества.
  document.fonts.load('700 80px Oswald', 'Ы'),
  document.fonts.load('600 58px Oswald', 'W'),
])
  .then((loaded) => {
    if (loaded.some((set) => set.length === 0)) {
      throw new Error('Oswald не подхватился: document.fonts.load вернул пусто');
    }
    continueRender(handle);
  })
  .catch((err) => {
    // Падаем громко: тихий откат в системный sans-serif испортил бы весь рендер.
    throw new Error(`Не загрузился Oswald: ${String(err)}`);
  });
