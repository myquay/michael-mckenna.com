  const registerShortcutApplication = async (shortcut) => {
    const windowId = shortcut?.dataset.shortcutWindowId;
    const url = shortcut?.dataset.shortcutUrl;

    if (!windowId || !url || applications[windowId]) {
      return;
    }

    if (normalizePath(url) === desktopUrl) {
      await ensureOsContext();
      return;
    }

    registerFragmentApplications(await fetchWindowFragment(url));
  };

  const openApplicationShortcut = async (shortcut) => {
    const windowId = shortcut?.dataset.shortcutWindowId;
    const url = shortcut?.dataset.shortcutUrl || desktopUrl;

    if (!windowId) {
      return;
    }

    try {
      await registerShortcutApplication(shortcut);
      const current = osState.windows[windowId];
      const restorePrevious = shortcut.dataset.shortcutRestore === "previous";
      const requestedState = current?.state === "minimized"
        ? restorePrevious && current.previousState === "maximized" ? "maximized" : "normal"
        : current?.state || "normal";

      await activateWindow(windowId, { requestedState });
    } catch {
      window.location.assign(url);
    }
  };

  const openShortcut = async (id) => {
    if (id === "rss-feed") {
      try {
        await ensureOsContext();
      } catch {
        window.location.assign(desktopUrl);
        return;
      }
    }

    if (id === "rss-feed") {
      openRssSetup();
      return;
    }

    if (id === "about-me") {
      openAboutWindow();
      return;
    }

    const shortcut = shortcuts.find((item) => item.dataset.shortcutId === id);
    await openApplicationShortcut(shortcut);
  };

  const bindShortcuts = () => {
    shortcuts.forEach((shortcut) => {
      if (shortcut.dataset.shortcutBound === "true") {
        return;
      }

      shortcut.dataset.shortcutBound = "true";
      const id = shortcut.dataset.shortcutId;
      const saved = osState.shortcuts[id];
      const defaultX = Number(shortcut.dataset.defaultX || 0);
      const defaultY = Number(shortcut.dataset.defaultY || 0);

      setShortcutPosition(shortcut, saved?.x ?? defaultX, saved?.y ?? defaultY);

      shortcut.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }

        closeStartMenu();
        selectShortcut(shortcut);

        if (isCompactMode()) {
          return;
        }

        shortcut.setPointerCapture(event.pointerId);
        activeDrag = {
          shortcut,
          id,
          pointerId: event.pointerId,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          startX: shortcut.offsetLeft,
          startY: shortcut.offsetTop,
          moved: false
        };
      });

      shortcut.addEventListener("pointermove", (event) => {
        if (!activeDrag || activeDrag.shortcut !== shortcut) {
          return;
        }

        moveActiveDrag(event.clientX, event.clientY);
      });

      shortcut.addEventListener("pointerup", () => {
        if (!activeDrag || activeDrag.shortcut !== shortcut) {
          return;
        }

        finishActiveDrag();
      });

      shortcut.addEventListener("dblclick", () => {
        if (!isCompactMode()) {
          openShortcut(id);
        }
      });

      shortcut.addEventListener("click", () => {
        if (isCompactMode()) {
          openShortcut(id);
        }
      });

      shortcut.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectShortcut(shortcut);
          openShortcut(id);
        }
      });
    });
  };

  const bindWindowControls = () => {
    appWindows.forEach((appWindow) => {
      if (appWindow.dataset.windowControlsBound === "true") {
        return;
      }

      appWindow.dataset.windowControlsBound = "true";
      const appId = appWindow.dataset.windowId;
      const titlebar = appWindow.querySelector(".window-titlebar");

      addWindowResizeHandles(appWindow, appId);

      appWindow.addEventListener("pointerdown", () => {
        if (osState.windows[appId]?.state !== "minimized") {
          focusWindowState(appId);
        }
      });

      titlebar?.addEventListener("pointerdown", (event) => {
        const item = osState.windows[appId];

        if (event.button !== 0 || isCompactMode() || event.target.closest("[data-window-action]") || !item?.capabilities?.move || item.state !== "normal") {
          return;
        }

        closeStartMenu();
        focusWindowState(appId);
        titlebar.setPointerCapture(event.pointerId);
        activeWindowDrag = {
          appId,
          pointerId: event.pointerId,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          startX: item.x,
          startY: item.y,
          width: item.width,
          height: item.height,
          moved: false
        };
      });

      titlebar?.addEventListener("pointermove", (event) => {
        if (!activeWindowDrag || activeWindowDrag.appId !== appId) {
          return;
        }

        moveActiveWindowDrag(event.clientX, event.clientY);
      });

      titlebar?.addEventListener("pointerup", () => {
        if (!activeWindowDrag || activeWindowDrag.appId !== appId) {
          return;
        }

        finishActiveWindowDrag();
      });

      titlebar?.addEventListener("dblclick", (event) => {
        if (isCompactMode() || event.target.closest("[data-window-action]") || osState.windows[appId]?.capabilities?.maximize === false) {
          return;
        }

        toggleMaximizeWindowState(appId);
      });

      appWindow.querySelectorAll("[data-window-action]").forEach((control) => {
        control.addEventListener("click", (event) => {
          const action = control.dataset.windowAction;

          if (action === "minimize") {
            minimizeWindowState(appId);
            return;
          }

          if (action === "close") {
            event.preventDefault();
            removeWindowState(appId);
            return;
          }

          if (action === "maximize") {
            toggleMaximizeWindowState(appId);
          }
        });
      });
    });
  };

  const unregisterDynamicWindow = (appWindow) => {
    const windowIndex = appWindows.indexOf(appWindow);

    if (windowIndex !== -1) {
      appWindows.splice(windowIndex, 1);
    }

    for (let index = explorerContexts.length - 1; index >= 0; index -= 1) {
      if (explorerContexts[index].windowEl === appWindow) {
        explorerContexts.splice(index, 1);
      }
    }
  };

  const registerDynamicWindow = (appWindow) => {
    if (!appWindow || appWindows.includes(appWindow)) {
      return;
    }

    appWindows.push(appWindow);
    const app = readWindowMetadata(appWindow);

    if (app) {
      applications[app.id] = { ...applications[app.id], ...app };
      osState.windows[app.id] = { ...osState.windows[app.id], ...app };
    }

    appWindow.querySelectorAll("[data-explorer-list]").forEach((list) => {
      const context = createExplorerContext(list);
      explorerContexts.push(context);
      bindExplorerTree(context);
      bindExplorerView(context);
    });

    bindWindowControls();

    if (app?.id === "about") {
      bindAboutWindow(appWindow);
    }
  };

  const bindTaskbar = () => {
    renderTaskbar();
  };

  const bindModalWindows = () => {
    modalWindows.forEach((modal) => {
      if (modal.dataset.modalBound === "true") {
        return;
      }

      modal.dataset.modalBound = "true";
      const titlebar = modal.querySelector("[data-modal-titlebar], .window-titlebar, .setup-titlebar");
      const id = modal.dataset.modalWindow;

      modal.addEventListener("pointerdown", () => {
        if (modal.classList.contains("is-open")) {
          focusModal(modal);
        }
      });

      titlebar?.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || isCompactMode() || event.target.closest("button, a, input, textarea, select")) {
          return;
        }

        if (!modal.classList.contains("is-open")) {
          return;
        }

        const rect = modal.getBoundingClientRect();
        focusModal(modal);
        titlebar.setPointerCapture(event.pointerId);
        activeModalDrag = {
          modal,
          id,
          pointerId: event.pointerId,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          startX: rect.left,
          startY: rect.top,
          moved: false
        };
      });

      titlebar?.addEventListener("pointermove", (event) => {
        if (!activeModalDrag || activeModalDrag.modal !== modal) {
          return;
        }

        moveActiveModalDrag(event.clientX, event.clientY);
      });

      titlebar?.addEventListener("pointerup", () => {
        if (!activeModalDrag || activeModalDrag.modal !== modal) {
          return;
        }

        finishActiveModalDrag();
      });
    });
  };

  const bindAboutWindow = (root = aboutWindow) => {
    if (root && root.dataset.aboutBound !== "true") {
      root.dataset.aboutBound = "true";
      const tabs = Array.from(root.querySelectorAll("[data-about-tab]"));
      const closeButtons = Array.from(root.querySelectorAll("[data-about-close]"));
      const copyButtons = Array.from(root.querySelectorAll("[data-copy-target]"));

      if (!root.hidden) {
        setAboutTab("about", root);
      }

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          setAboutTab(tab.dataset.aboutTab, root);
        });
      });

      closeButtons.forEach((button) => {
        button.addEventListener("click", closeAboutWindow);
      });

      copyButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const target = root.querySelector(`#${button.dataset.copyTarget}`);

          if (!target || !("value" in target)) {
            return;
          }

          if (await copyText(target.value)) {
            button.textContent = "Copied";
            window.setTimeout(() => {
              button.textContent = "Copy";
            }, 1100);
          }
        });
      });
    }

    startAboutButtons.forEach((button) => {
      if (button.dataset.aboutBound === "true") {
        return;
      }

      button.dataset.aboutBound = "true";
      button.addEventListener("click", () => {
        openAboutWindow();
      });
    });
  };

  loadOsState();
  registerDomWindows();
  syncPageToOsState();
  applyWindowState();
  applyModalState();
  bindShortcuts();
  bindWindowControls();
  bindTaskbar();
  bindModalWindows();
  bindRssSetup();
  explorerContexts.forEach((context) => {
    bindExplorerTree(context);
    bindExplorerView(context);
  });
  bindAboutWindow();
  hydratePersistedWindows();
  ensureOsContext().catch(() => {
    // The normal route remains usable; individual actions retain hard-navigation fallbacks.
  });

  document.addEventListener("mousemove", (event) => {
    moveActiveDrag(event.clientX, event.clientY);
    moveActiveFileDrag(event.clientX, event.clientY);
    moveActiveWindowDrag(event.clientX, event.clientY);
    moveActiveWindowResize(event.clientX, event.clientY);
    moveActiveModalDrag(event.clientX, event.clientY);
  });

  document.addEventListener("mouseup", () => {
    finishActiveDrag();
    finishActiveFileDrag();
    finishActiveWindowDrag();
    finishActiveWindowResize();
    finishActiveModalDrag();
  });

  startButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleStartMenu();
  });

  document.querySelectorAll("[data-menu-parent]").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll("[data-menu-parent]").forEach((other) => {
        other.classList.toggle("is-active", other === item);
      });
    });
  });

  document.addEventListener("pointerdown", (event) => {
    blurActiveModalOutside(event.target);

    if (startMenu && startButton && !startMenu.contains(event.target) && !startButton.contains(event.target)) {
      closeStartMenu();
    }

    explorerContexts.forEach((context) => {
      if (context.viewMenu && context.viewMenuButton && !context.viewMenu.contains(event.target) && !context.viewMenuButton.contains(event.target)) {
        closeViewMenu(context);
      }
    });

    if (!event.target.closest(".desktop-shortcut")) {
      shortcuts.forEach((item) => item.classList.remove("is-selected"));
    }
  });

  document.addEventListener("focusin", (event) => {
    blurActiveModalOutside(event.target);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeStartMenu();
      closeViewMenu();
      closeRssSetup();
      closeAboutWindow();
    }
  });

  window.addEventListener("popstate", (event) => {
    activateRouteUrl(window.location.pathname, event.state).catch(() => {
      window.location.reload();
    });
  });

  window.addEventListener("resize", () => {
    if (isCompactMode()) {
      finishActiveDrag();
      finishActiveFileDrag();
      finishActiveWindowDrag();
      finishActiveWindowResize();
      finishActiveModalDrag();
      applyWindowState();
      applyModalState();
      return;
    }

    shortcuts.forEach((shortcut) => {
      const id = shortcut.dataset.shortcutId;
      const next = setShortcutPosition(shortcut, shortcut.offsetLeft, shortcut.offsetTop);

      if (osState.shortcuts[id]) {
        osState.shortcuts[id] = next;
      }
    });
    Object.keys(osState.windows).forEach((appId) => {
      osState.windows[appId] = {
        ...osState.windows[appId],
        ...clampWindowBounds(appId, osState.windows[appId])
      };
    });
    modalWindows.forEach((modal) => {
      const id = modal.dataset.modalWindow;
      const item = osState.modals[id];

      if (item?.position) {
        item.position = clampModalPosition(modal, item.position.x, item.position.y);
      }
    });
    saveShortcutPositions();
    applyWindowState();
    applyModalState();

    explorerContexts.forEach((context) => {
      if (context.list.dataset.view === "icons") {
        lineUpExplorerIcons(context, { save: false });
        applySavedExplorerIconPositions(context);
      }
    });
  }, { passive: true });

  compactModeQuery.addEventListener("change", () => {
    explorerContexts.forEach((context) => {
      const state = ensureExplorerState(context);
      setExplorerView(context, isCompactMode() ? "list" : state.view || "details", { persist: false });
    });
    applyWindowState();
    applyModalState();
  });

  syncClock();
  window.setInterval(syncClock, 30000);
})();
