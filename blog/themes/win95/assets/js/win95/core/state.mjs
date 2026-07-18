import { resolveExplorerWindowId } from "./routing.mjs";
import { allocateExplorerInstanceId, createExplorerSession, isExplorerWindowId } from "./explorer.mjs";

export const migrateOsState = (state, { routeIndex = {}, currentVersion = 5, baseUrl } = {}) => {
  if (Number(state.version) >= currentVersion) {
    return state;
  }

  const legacyId = "explorer-blog";
  const legacyWindow = state.windows[legacyId];

  if (legacyWindow) {
    const targetId = resolveExplorerWindowId(legacyWindow.url, routeIndex, baseUrl) || legacyId;

    if (targetId === legacyId) {
      state.windows[legacyId] = { ...legacyWindow, id: legacyId };
    } else {
      if (!state.windows[targetId]) {
        state.windows[targetId] = { ...legacyWindow, id: targetId };
      }

      delete state.windows[legacyId];

      if (state.activeWindowId === legacyId) {
        state.activeWindowId = targetId;
      }

      if (state.explorers[legacyId] && !state.explorers[targetId]) {
        state.explorers[targetId] = state.explorers[legacyId];
      }

      delete state.explorers[legacyId];
      state.taskbarOrder = state.taskbarOrder.map((appId) => appId === legacyId ? targetId : appId);
    }
  }

  state.taskbarOrder = Array.from(new Set(state.taskbarOrder));

  const explorerIds = Object.keys(state.windows).filter(isExplorerWindowId);
  const orderedExplorerIds = [
    ...state.taskbarOrder.filter((id) => explorerIds.includes(id)),
    ...explorerIds.filter((id) => !state.taskbarOrder.includes(id))
  ];
  const occupiedIds = new Set(Object.keys(state.windows).filter((id) => !explorerIds.includes(id)));
  const remappedIds = {};

  orderedExplorerIds.forEach((id) => {
    const windowState = state.windows[id];
    const instanceId = allocateExplorerInstanceId(occupiedIds);
    const contentWindowId = windowState.contentWindowId
      || resolveExplorerWindowId(windowState.url, routeIndex, baseUrl)
      || id;
    const explorer = createExplorerSession(state.explorers[id], windowState.url || "/");

    if (state.explorerTree?.expanded && Object.keys(explorer.tree.expanded).length === 0) {
      explorer.tree.expanded = { ...state.explorerTree.expanded };
    }

    occupiedIds.add(instanceId);
    remappedIds[id] = instanceId;
    state.windows[instanceId] = { ...windowState, id: instanceId, contentWindowId };
    state.explorers[instanceId] = explorer;
    delete state.windows[id];
    delete state.explorers[id];
  });

  state.taskbarOrder = state.taskbarOrder.map((id) => remappedIds[id] || id);
  state.activeWindowId = remappedIds[state.activeWindowId] || state.activeWindowId;

  delete state.explorerTree;
  state.version = currentVersion;
  return state;
};

export const isVisibleNonModalWindow = (item, modalWindowKind = "modal") => Boolean(
  item
  && item.state !== "minimized"
  && item.windowKind !== modalWindowKind
);

export const resolveMaximizedRouteOwner = (
  windows,
  preferredId,
  activeId,
  modalWindowKind = "modal"
) => {
  const lookup = windows && typeof windows === "object" ? windows : {};
  const isEligible = (item) => isVisibleNonModalWindow(item, modalWindowKind)
    && item.state === "maximized";

  if (isEligible(lookup[preferredId])) {
    return lookup[preferredId];
  }

  if (isEligible(lookup[activeId])) {
    return lookup[activeId];
  }

  return Object.values(lookup)
    .filter(isEligible)
    .sort((a, b) => (b.z || 0) - (a.z || 0))[0] || null;
};
