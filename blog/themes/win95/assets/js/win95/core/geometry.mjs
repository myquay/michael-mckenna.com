export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const constrainWindowBounds = ({
  bounds = {},
  defaults = {},
  minimums = {},
  viewport,
  sizeMargin = 0
}) => {
  const minWidth = minimums.width || 280;
  const minHeight = minimums.height || 180;
  const width = Math.round(clamp(
    bounds.width || defaults.width || 640,
    minWidth,
    Math.max(minWidth, viewport.width - sizeMargin)
  ));
  const height = Math.round(clamp(
    bounds.height || defaults.height || 420,
    minHeight,
    Math.max(minHeight, viewport.height - sizeMargin)
  ));
  const x = Math.round(clamp(bounds.x || defaults.x || 0, 0, Math.max(0, viewport.width - width)));
  const y = Math.round(clamp(bounds.y || defaults.y || 0, 0, Math.max(0, viewport.height - height)));

  return { x, y, width, height };
};
