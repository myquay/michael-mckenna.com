  function applyWindowState() {
    let hasMaximizedWindow = false;
    const compact = isCompactMode();
    const zIndexes = Object.values(osState.windows)
      .filter((item) => item.state !== "minimized")
      .sort((a, b) => (a.z || 0) - (b.z || 0))
      .reduce((lookup, item, index) => {
        lookup[item.id] = 10 + index;
        return lookup;
      }, {});

    appWindows.forEach((appWindow) => {
      const appId = appWindow.dataset.windowId;
      const item = osState.windows[appId];
      const controls = Array.from(appWindow.querySelectorAll("[data-window-action]"));

      if (!item) {
        appWindow.classList.remove("is-normal", "is-maximized", "is-minimized", "is-modal", "is-active");
        appWindow.hidden = true;
        return;
      }

      const bounds = clampWindowBounds(appId, item);
      Object.assign(item, bounds);
      const isCompactBackground = compact && osState.activeWindowId !== appId;
      appWindow.hidden = item.state === "minimized" || isCompactBackground;
      appWindow.classList.toggle("is-normal", item.state === "normal");
      appWindow.classList.toggle("is-maximized", item.state === "maximized");
      appWindow.classList.toggle("is-minimized", item.state === "minimized");
      appWindow.classList.toggle("is-modal", isModalApplication(item));
      appWindow.classList.toggle("is-active", osState.activeWindowId === appId && item.state !== "minimized");
      appWindow.classList.toggle("is-inactive", !compact && osState.activeWindowId !== appId && item.state !== "minimized");
      appWindow.style.setProperty("--window-x", `${bounds.x}px`);
      appWindow.style.setProperty("--window-y", `${bounds.y}px`);
      appWindow.style.setProperty("--window-width", `${bounds.width}px`);
      appWindow.style.setProperty("--window-height", `${bounds.height}px`);
      appWindow.style.zIndex = String(zIndexes[appId] || 10);

      if (item.state === "maximized") {
        hasMaximizedWindow = true;
      }

      controls.forEach((control) => {
        const action = control.dataset.windowAction;
        const allowed = item.capabilities?.[action] !== false;

        const compactlyUnavailable = compact && action === "maximize";
        control.hidden = !allowed || compactlyUnavailable;
        control.disabled = !allowed || compactlyUnavailable;

        if (action === "maximize") {
          const isMaximized = item.state === "maximized";
          control.textContent = isMaximized ? "❐" : "□";
          control.setAttribute("aria-label", isMaximized ? "Restore" : "Maximize");
          control.title = isMaximized ? "Restore" : "Maximize";
        }
      });
    });

    desktop?.classList.toggle("has-maximized-window", hasMaximizedWindow || (compact && Boolean(osState.activeWindowId)));
    desktop?.classList.toggle("is-compact", compact);
    renderTaskbar();
  }

  const setShortcutPosition = (shortcut, x, y) => {
    const maxX = Math.max(0, window.innerWidth - shortcut.offsetWidth - 6);
    const maxY = Math.max(0, window.innerHeight - taskbarHeight() - shortcut.offsetHeight - 6);
    const nextX = Math.round(clamp(x, 0, maxX));
    const nextY = Math.round(clamp(y, 0, maxY));
    shortcut.style.setProperty("--x", `${nextX}px`);
    shortcut.style.setProperty("--y", `${nextY}px`);
    return { x: nextX, y: nextY };
  };

  const saveShortcutPositions = () => {
    saveOsState();
  };

  const selectShortcut = (shortcut) => {
    shortcuts.forEach((item) => item.classList.toggle("is-selected", item === shortcut));
  };

  const closeStartMenu = () => {
    startMenu?.classList.remove("is-open");
    startButton?.setAttribute("aria-expanded", "false");
    document.querySelectorAll("[data-menu-parent]").forEach((item) => item.classList.remove("is-active"));
  };

  const toggleStartMenu = () => {
    if (!startMenu || !startButton) {
      return;
    }

    const isOpen = startMenu.classList.toggle("is-open");
    startButton.setAttribute("aria-expanded", String(isOpen));
  };

  const selectedFeeds = () => feedChoices
    .filter((choice) => choice.checked)
    .map((choice) => feeds[choice.value])
    .filter(Boolean);

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = text;
      fallback.setAttribute("readonly", "");
      fallback.style.left = "-9999px";
      fallback.style.position = "fixed";
      document.body.append(fallback);
      fallback.focus();
      fallback.select();
      const copied = document.execCommand("copy");
      fallback.remove();
      return copied;
    }
  };

  const renderFeedUrls = () => {
    if (!feedUrlList) {
      return;
    }

    const selected = selectedFeeds();
    feedUrlList.replaceChildren();

    if (selected.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No feeds selected. Click Back to choose at least one feed.";
      feedUrlList.append(empty);
      return;
    }

    selected.forEach((feed) => {
      const row = document.createElement("div");
      const label = document.createElement("label");
      const input = document.createElement("input");
      const copy = document.createElement("button");
      const id = `feed-url-${feed.label.toLowerCase()}`;

      row.className = "feed-url-row";
      label.setAttribute("for", id);
      label.textContent = feed.label;
      input.id = id;
      input.type = "text";
      input.value = feed.url;
      input.disabled = true;
      copy.className = "setup-button";
      copy.type = "button";
      copy.textContent = "Copy";
      copy.addEventListener("click", async () => {
        if (await copyText(feed.url)) {
          copy.textContent = "Copied";
          window.setTimeout(() => {
            copy.textContent = "Copy";
          }, 1100);
        }
      });

      row.append(label, input, copy);
      feedUrlList.append(row);
    });
  };

  const setWizardStep = (step) => {
    if (wizardSteps.length === 0) {
      return;
    }

    wizardStep = clamp(step, 0, wizardSteps.length - 1);
    wizardSteps.forEach((item, index) => {
      item.classList.toggle("is-active", index === wizardStep);
    });

    if (rssSetupBack) {
      rssSetupBack.disabled = wizardStep === 0;
    }

    if (rssSetupNext) {
      rssSetupNext.textContent = wizardStep === wizardSteps.length - 1 ? "Finish" : "Next >";
    }

    if (wizardStep === 2) {
      renderFeedUrls();
    }
  };

  const bindRssSetup = (root = document) => {
    rssSetupWindow = root.querySelector?.("#rss-setup-window") || document.getElementById("rss-setup-window");

    if (!rssSetupWindow) {
      return;
    }

    rssSetupClose = rssSetupWindow.querySelector("#rss-setup-close");
    rssSetupBack = rssSetupWindow.querySelector("#rss-setup-back");
    rssSetupNext = rssSetupWindow.querySelector("#rss-setup-next");
    rssSetupCancel = rssSetupWindow.querySelector("#rss-setup-cancel");
    feedUrlList = rssSetupWindow.querySelector("#feed-url-list");
    feedChoices = Array.from(rssSetupWindow.querySelectorAll("[data-feed-choice]"));
    wizardSteps = Array.from(rssSetupWindow.querySelectorAll("[data-wizard-step]"));

    if (rssSetupWindow.dataset.rssSetupBound === "true") {
      return;
    }

    rssSetupWindow.dataset.rssSetupBound = "true";
    rssSetupBack?.addEventListener("click", () => {
      setWizardStep(wizardStep - 1);
      rssSetupNext?.focus();
    });
    rssSetupNext?.addEventListener("click", () => {
      if (wizardStep === wizardSteps.length - 1) {
        closeRssSetup();
        return;
      }

      setWizardStep(wizardStep + 1);
      rssSetupNext?.focus();
    });
    rssSetupCancel?.addEventListener("click", closeRssSetup);
    rssSetupClose?.addEventListener("click", closeRssSetup);
    feedChoices.forEach((choice) => choice.addEventListener("change", renderFeedUrls));
  };

  const ensureRssSetupDom = async () => {
    if (rssSetupWindow?.isConnected) {
      return rssSetupWindow;
    }

    const fragmentDocument = await ensureOsContext();
    const sourceWindow = fragmentDocument.querySelector("[data-modal-window='rss-setup']");

    if (!sourceWindow) {
      throw new Error("The RSS Setup fragment was not found");
    }

    const imported = document.importNode(sourceWindow, true);
    document.body.append(imported);
    modalWindows.push(imported);
    bindRssSetup(document);
    bindModalWindows();
    applyModalState();
    return imported;
  };

  const openRssSetup = async () => {
    try {
      await ensureRssSetupDom();
    } catch {
      window.location.assign(desktopUrl);
      return;
    }

    if (!rssSetupWindow) {
      return;
    }

    finishActiveDrag();
    closeStartMenu();
    rssSetupWindow.classList.add("is-open");
    applyModalState();
    focusModal(rssSetupWindow);
    setWizardStep(0);
    rssSetupNext?.focus();
  };

  const closeRssSetup = () => {
    rssSetupWindow?.classList.remove("is-open");
    rssSetupWindow?.classList.remove("is-active");
  };

  const setAboutTab = (tabId, root = aboutWindow) => {
    const tabs = Array.from(root?.querySelectorAll("[data-about-tab]") || []);
    const panels = Array.from(root?.querySelectorAll("[data-about-panel]") || []);

    tabs.forEach((tab) => {
      const isActive = tab.dataset.aboutTab === tabId;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.aboutPanel === tabId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  };

  const openAboutWindow = async () => {
    finishActiveDrag();
    closeStartMenu();

    try {
      await ensureOsContext();
      const root = await activateWindow("about", { requestedState: "normal", historyMode: "none" });
      setAboutTab("about", root);
      root?.querySelector("[data-about-tab]")?.focus();
    } catch {
      fallbackWindowNavigation(proposedWindowState("about", "normal"));
    }
  };

  const closeAboutWindow = () => {
    removeWindowState("about");
  };

  const syncClock = () => {
    if (!trayTime) {
      return;
    }

    const now = new Date();
    trayTime.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  };

