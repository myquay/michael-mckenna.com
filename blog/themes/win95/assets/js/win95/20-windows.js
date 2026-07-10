  const windowFragmentCache = new Map();
  let osContextPromise = null;

  const fragmentUrlForRoute = (url) => {
    const routeUrl = normalizePath(url);

    return routeUrl === desktopUrl ? "/window.html" : `${routeUrl}window.html`;
  };

  const fetchWindowFragment = async (url) => {
    const routeUrl = normalizePath(url);

    if (!windowFragmentCache.has(routeUrl)) {
      const request = fetch(fragmentUrlForRoute(routeUrl), { credentials: "same-origin" }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load the window fragment for ${routeUrl}`);
        }

        return new DOMParser().parseFromString(await response.text(), "text/html");
      }).catch((error) => {
        windowFragmentCache.delete(routeUrl);
        throw error;
      });

      windowFragmentCache.set(routeUrl, request);
    }

    return windowFragmentCache.get(routeUrl);
  };

  const registerFragmentApplications = (fragmentDocument) => {
    Array.from(fragmentDocument?.querySelectorAll("[data-window-id]") || []).forEach((sourceWindow) => {
      const app = readWindowMetadata(sourceWindow);

      if (app) {
        applications[app.id] = { ...applications[app.id], ...app };
      }
    });
  };

  const mountDesktopShortcuts = (fragmentDocument) => {
    if (!desktop || shortcuts.length > 0) {
      return;
    }

    Array.from(fragmentDocument?.querySelectorAll(".desktop-shortcut") || []).forEach((sourceShortcut) => {
      desktop.append(document.importNode(sourceShortcut, true));
    });
    shortcuts = Array.from(document.querySelectorAll(".desktop-shortcut"));
    bindShortcuts();
  };

  const ensureOsContext = () => {
    if (!osContextPromise) {
      osContextPromise = fetchWindowFragment(desktopUrl).then((fragmentDocument) => {
        registerFragmentApplications(fragmentDocument);
        mountDesktopShortcuts(fragmentDocument);
        return fragmentDocument;
      }).catch((error) => {
        osContextPromise = null;
        throw error;
      });
    }

    return osContextPromise;
  };

  const hydrateWindowDom = async (item, { apply = true } = {}) => {
    if (!item?.id || !item.url || item.state === "minimized") {
      return null;
    }

    const existing = appWindows.find((windowEl) => windowEl.dataset.windowId === item.id);

    if (existing && normalizePath(existing.dataset.windowUrl) === normalizePath(item.url)) {
      return existing;
    }

    const fragmentDocument = await fetchWindowFragment(item.url);
    const sourceWindow = Array.from(fragmentDocument.querySelectorAll("[data-window-id]"))
      .find((windowEl) => windowEl.dataset.windowId === item.id);

    if (!sourceWindow) {
      throw new Error(`Window ${item.id} was not found at ${item.url}`);
    }

    const imported = document.importNode(sourceWindow, true);
    imported.hidden = !apply;

    if (existing) {
      unregisterDynamicWindow(existing);
      existing.replaceWith(imported);
    } else {
      desktop?.append(imported);
    }

    registerDynamicWindow(imported);

    if (apply) {
      applyWindowState();
    }

    return imported;
  };

  const proposedWindowState = (appId, requestedState) => {
    const existing = osState.windows[appId] || null;
    const app = applications[appId] || existing;

    if (!app) {
      return null;
    }

    applications[appId] = { ...applications[appId], ...app, id: appId };
    const defaults = defaultWindowBounds(appId);
    const bounds = clampWindowBounds(appId, {
      x: existing?.x ?? defaults.x,
      y: existing?.y ?? defaults.y,
      width: existing?.width ?? defaults.width,
      height: existing?.height ?? defaults.height
    });
    const state = isModalApplication(app)
      ? "normal"
      : requestedState || (existing?.state === "minimized"
        ? existing.previousState === "maximized" ? "maximized" : "normal"
        : existing?.state || "normal");

    return {
      ...existing,
      ...applications[appId],
      ...bounds,
      capabilities: { ...defaultCapabilities, ...(app.capabilities || {}) },
      state,
      previousState: "normal",
      restoreBounds: existing?.restoreBounds || bounds,
      z: existing?.z || Date.now()
    };
  };

  const fallbackWindowNavigation = (item) => {
    if (!item) {
      return;
    }

    osState.windows[item.id] = { ...item, z: nextWindowZ() };
    osState.activeWindowId = item.id;
    directModalRouteId = isModalApplication(item) ? item.id : null;
    saveOsState();
    window.location.assign(isModalApplication(item) || item.state === "maximized"
      ? item.url
      : desktopUrl);
  };

  const activateWindow = (appId, { requestedState, historyMode = "push", directModal = false } = {}) => {
    const activationId = ++latestWindowActivation;
    const activation = (async () => {
      const proposed = proposedWindowState(appId, requestedState);

      if (!proposed) {
        return null;
      }

      const priorOwnerId = resolveRouteOwner()?.id || null;
      const replacingDirectModalRoute = Boolean(directModalRouteId && directModalRouteId !== appId);
      let root;

      try {
        root = await hydrateWindowDom(proposed, { apply: false });
      } catch (error) {
        if (activationId !== latestWindowActivation) {
          return null;
        }

        throw error;
      }

      if (activationId !== latestWindowActivation) {
        return root;
      }

      osState.windows[appId] = { ...proposed, z: nextWindowZ() };
      osState.activeWindowId = appId;

      if (isModalApplication(proposed)) {
        overlayRouteOwnerId = priorOwnerId;
        directModalRouteId = directModal ? appId : null;
      } else {
        overlayRouteOwnerId = null;
        directModalRouteId = null;
      }

      saveOsState();
      applyWindowState();

      if (!isModalApplication(proposed) || directModal) {
        syncUrlToWindowStack({ mode: replacingDirectModalRoute ? "replace" : historyMode });
      }

      return root;
    })();

    return activation;
  };

  const activateTaskbarWindow = async (appId) => {
    const current = osState.windows[appId];

    if (!current || isModalApplication(current)) {
      return;
    }

    if (current.state !== "minimized" && osState.activeWindowId === appId) {
      minimizeWindowState(appId);
      return;
    }

    const requestedState = current.state === "minimized"
      ? current.previousState === "maximized" ? "maximized" : "normal"
      : current.state;
    const proposed = proposedWindowState(appId, requestedState);

    try {
      await activateWindow(appId, { requestedState });
    } catch {
      fallbackWindowNavigation(proposed);
    }
  };

  const hydratePersistedWindows = async () => {
    const missingVisibleWindows = Object.values(osState.windows)
      .filter((item) => item.state !== "minimized")
      .filter((item) => !appWindows.some((windowEl) => windowEl.dataset.windowId === item.id
        && normalizePath(windowEl.dataset.windowUrl) === normalizePath(item.url)));

    if (isDesktopPath()) {
      await Promise.allSettled(missingVisibleWindows.map((item) => hydrateWindowDom(item)));
      applyWindowState();
      return;
    }

    await Promise.allSettled(missingVisibleWindows.map(async (item) => {
      const fragmentDocument = await fetchWindowFragment(item.url);
      registerFragmentApplications(fragmentDocument);
    }));
  };

  const activateRouteUrl = async (url, historyState = window.history.state) => {
    const routeUrl = normalizePath(url);

    if (routeUrl === desktopUrl) {
      const departingModalId = directModalRouteId;

      if (departingModalId) {
        delete osState.windows[departingModalId];
      }

      directModalRouteId = null;
      overlayRouteOwnerId = null;
      const historyWindow = osState.windows[historyState?.windowId];
      const persistedActive = osState.windows[osState.activeWindowId];
      const normalWindow = visibleNonModalWindows().find((item) => item.state === "normal");
      const owner = historyWindow && !isModalApplication(historyWindow)
        ? historyWindow
        : persistedActive?.state === "normal" && !isModalApplication(persistedActive)
          ? persistedActive
          : normalWindow || (persistedActive?.state !== "minimized" && !isModalApplication(persistedActive)
            ? persistedActive
            : visibleNonModalWindows()[0] || null);

      if (owner && historyState?.presentation === "normal") {
        owner.state = "normal";
        owner.previousState = "normal";
      }

      osState.activeWindowId = owner?.id || null;

      if (owner) {
        owner.z = nextWindowZ();
      }

      saveOsState();
      await hydratePersistedWindows();
      applyWindowState();
      return;
    }

    const fragmentDocument = await fetchWindowFragment(routeUrl);
    const sourceWindow = fragmentDocument.querySelector("[data-window-id]");
    const routeWindowId = sourceWindow?.dataset.windowId;

    if (!routeWindowId || !sourceWindow) {
      throw new Error(`No route window was found at ${routeUrl}`);
    }

    const app = readWindowMetadata(sourceWindow);
    applications[routeWindowId] = { ...applications[routeWindowId], ...app, url: routeUrl };
    const existing = osState.windows[routeWindowId];
    const restoreBounds = existing?.state === "normal"
      ? clampWindowBounds(routeWindowId, existing)
      : existing?.restoreBounds || defaultWindowBounds(routeWindowId);

    osState.windows[routeWindowId] = {
      ...existing,
      ...applications[routeWindowId],
      state: isModalApplication(applications[routeWindowId]) ? "normal" : "maximized",
      previousState: "normal",
      restoreBounds,
      z: nextWindowZ()
    };

    if (isModalApplication(applications[routeWindowId])) {
      overlayRouteOwnerId = resolveRouteOwner()?.id || null;
      directModalRouteId = routeWindowId;
    } else {
      overlayRouteOwnerId = null;
      directModalRouteId = null;
    }

    osState.activeWindowId = routeWindowId;
    rememberTaskbarOrder(routeWindowId);
    saveOsState();
    await hydrateWindowDom(osState.windows[routeWindowId]);
    applyWindowState();
  };

