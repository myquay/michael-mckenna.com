import { resolveExplorerWindowId } from "./routing.mjs";

export const migrateOsState = (state, { routeIndex = {}, currentVersion = 3, baseUrl } = {}) => {
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
  state.version = currentVersion;
  return state;
};

export const isVisibleNonModalWindow = (item, modalWindowKind = "modal") => Boolean(
  item
  && item.state !== "minimized"
  && item.windowKind !== modalWindowKind
);
