import plan from '../edit-plan.json';

export const LAYOUT = plan.layout;
export const MOTION = plan.motion;
export const ZOOM = (plan as { zoom?: { origin: string; keys: unknown[] } }).zoom ?? { origin: '50% 38%', keys: [] };
export const ACCENT = plan.style.accent;
export const STRETCH_Y = plan.style.stretchY;
/**
 * Обводка текста четырьмя тенями. Строка из ТЗ рассчитана на кегль 80 в кадре
 * 1920×1080; если взять её как есть при кегле 53, обводка станет вдвое толще
 * положенного и прочтётся размытым пятном, а не контуром. Поэтому считаем от кегля.
 * Пропорции сохранены: 5/80 по осям и 4/80 по диагоналям.
 */
export const обводка = (кегль: number) => {
  const ось = Math.max(1, Math.round(кегль * 0.0625));
  const диаг = Math.max(1, Math.round(кегль * 0.05));
  return [
    `-${ось}px 0 0 #000`, `${ось}px 0 0 #000`,
    `0 -${ось}px 0 #000`, `0 ${ось}px 0 #000`,
    `-${диаг}px -${диаг}px 0 #000`, `${диаг}px ${диаг}px 0 #000`,
  ].join(', ');
};
export const FONT = 'Oswald, sans-serif';

export const toFrames = (seconds: number, fps: number) => Math.round(seconds * fps);
