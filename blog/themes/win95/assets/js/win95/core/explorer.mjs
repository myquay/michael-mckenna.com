export const createExplorerTreeState = (state, version) => {
  const current = state && typeof state === "object" ? state : {};

  return {
    ...current,
    expanded: current.expanded && typeof current.expanded === "object" ? current.expanded : {},
    version
  };
};

export const createExplorerSession = (session, location = "/") => {
  const current = session && typeof session === "object" ? session : {};
  const currentLocation = current.location || location;
  const history = Array.isArray(current.history) && current.history.length > 0
    ? current.history
    : [currentLocation];
  const historyIndex = Number.isInteger(current.historyIndex)
    ? Math.min(Math.max(current.historyIndex, 0), history.length - 1)
    : history.length - 1;

  return {
    view: "details",
    sort: "date",
    icons: {},
    tree: { expanded: {} },
    ...current,
    tree: {
      ...(current.tree && typeof current.tree === "object" ? current.tree : {}),
      expanded: current.tree?.expanded && typeof current.tree.expanded === "object"
        ? current.tree.expanded
        : {}
    },
    location: currentLocation,
    history,
    historyIndex
  };
};

export const allocateExplorerInstanceId = (existingIds = [], prefix = "explorer-window") => {
  const ids = new Set(existingIds);
  let sequence = 1;

  while (ids.has(`${prefix}-${sequence}`)) {
    sequence += 1;
  }

  return `${prefix}-${sequence}`;
};

export const navigateExplorerSession = (session, location) => {
  const current = createExplorerSession(session, location);

  if (current.location === location) {
    return current;
  }

  const history = current.history.slice(0, current.historyIndex + 1);
  history.push(location);

  return {
    ...current,
    location,
    history,
    historyIndex: history.length - 1
  };
};

export const navigateExplorerWindow = (sourceWindow, targetApplication, {
  instanceId,
  contentWindowId,
  z
} = {}) => {
  if (!sourceWindow || !targetApplication || !instanceId || !contentWindowId) {
    return null;
  }

  return {
    ...sourceWindow,
    ...targetApplication,
    id: instanceId,
    contentWindowId,
    state: sourceWindow.state,
    previousState: sourceWindow.previousState || "normal",
    restoreBounds: sourceWindow.restoreBounds || {
      x: sourceWindow.x,
      y: sourceWindow.y,
      width: sourceWindow.width,
      height: sourceWindow.height
    },
    z
  };
};

export const isExplorerWindowId = (id) => Boolean(
  id === "my-computer"
  || id === "my-documents"
  || id?.startsWith("explorer-")
);

export const isWindowContractCompatible = (expectedVersion, fragmentVersion) => Boolean(
  expectedVersion
  && fragmentVersion
  && String(expectedVersion) === String(fragmentVersion)
);
