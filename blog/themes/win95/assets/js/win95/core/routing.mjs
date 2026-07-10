export const normalizePath = (path) => {
  const next = path || "/";
  return next === "/" || next.endsWith("/") ? next : `${next}/`;
};

export const readExplorerRouteIndex = (root) => Object.fromEntries(
  Array.from(root?.querySelectorAll?.("[data-explorer-route]") || [])
    .map((item) => [normalizePath(item.dataset.explorerRoute), item.dataset.explorerWindowId])
    .filter(([, windowId]) => Boolean(windowId))
);

export const resolveExplorerWindowId = (url, routeIndex, baseUrl = "http://localhost/") => {
  try {
    const path = normalizePath(new URL(url || "/", baseUrl).pathname);
    return routeIndex[path] || null;
  } catch {
    return null;
  }
};
