(() => {
  const desktop = document.getElementById("desktop");
  let shortcuts = Array.from(document.querySelectorAll(".desktop-shortcut"));
  const startButton = document.getElementById("start-button");
  const startMenu = document.getElementById("start-menu");
  const trayTime = document.getElementById("tray-time");
  let rssSetupWindow = document.getElementById("rss-setup-window");
  let rssSetupClose = document.getElementById("rss-setup-close");
  let rssSetupBack = document.getElementById("rss-setup-back");
  let rssSetupNext = document.getElementById("rss-setup-next");
  let rssSetupCancel = document.getElementById("rss-setup-cancel");
  let feedUrlList = document.getElementById("feed-url-list");
  let feedChoices = Array.from(document.querySelectorAll("[data-feed-choice]"));
  let wizardSteps = Array.from(document.querySelectorAll("[data-wizard-step]"));
  const aboutWindow = document.getElementById("about-window");
  const startAboutButtons = Array.from(document.querySelectorAll("[data-start-action='about']"));
  const appWindows = Array.from(document.querySelectorAll("[data-window-id]"));
  const modalWindows = Array.from(document.querySelectorAll("[data-modal-window]"));
  const taskbarApps = document.getElementById("taskbar-apps");
  const createExplorerContext = (list) => {
    const windowEl = list.closest("[data-window-id]");
    const menu = windowEl?.querySelector("[data-view-menu]");

    return {
      list,
      windowEl,
      tree: windowEl?.querySelector("[data-explorer-tree]"),
      fileItems: Array.from(list.querySelectorAll("[data-file-item]")),
      viewMenuButton: windowEl?.querySelector("[data-view-menu-button]"),
      viewMenu: menu,
      viewOptionButtons: Array.from(menu?.querySelectorAll("[data-view-option]") || []),
      arrangeIconButtons: Array.from(menu?.querySelectorAll("[data-arrange-icons]") || []),
      lineUpIconsButton: menu?.querySelector("[data-line-up-icons]")
    };
  };
  const explorerContexts = Array.from(document.querySelectorAll("[data-explorer-list]")).map(createExplorerContext);
  const osStorageKey = "michael95.osState";
  const legacyShortcutStorageKey = "michael95.win95Theme.shortcutPositions";
  const compactModeQuery = window.matchMedia("(max-width: 700px), (max-height: 500px) and (max-width: 900px)");
  const isCompactMode = () => compactModeQuery.matches;
  const taskbarHeight = () => document.querySelector(".taskbar")?.offsetHeight || 30;
  const dragThreshold = 4;
  const desktopUrl = "/";
  const modalWindowKind = "modal";
  const defaultCapabilities = {
    move: true,
    minimize: true,
    maximize: true,
    close: true,
    fixedSize: false,
    taskbar: true
  };
  // Content applications register from the current DOM or fetched WINDOW
  // fragments, avoiding a second hand-maintained catalogue in JavaScript.
  const applications = {};
  const feeds = {
    articles: { label: "Posts", url: "https://michael-mckenna.com/blog/rss.xml" },
    activity: { label: "Activity", url: "https://michael-mckenna.com/activity/rss.xml" },
    photos: { label: "Photos", url: "https://michael-mckenna.com/activity/rss.xml" },
    everything: { label: "Everything", url: "https://michael-mckenna.com/rss.xml" }
  };
  let osState = {
    version: 3,
    shortcuts: {},
    windows: {},
    explorers: {},
    modals: {},
    taskbarOrder: [],
    activeWindowId: null
  };
  let activeDrag = null;
  let activeFileDrag = null;
  let activeWindowDrag = null;
  let activeWindowResize = null;
  let activeModalDrag = null;
  let directModalRouteId = document.body?.dataset.pageWindowKind === modalWindowKind
    ? document.body?.dataset.pageWindowId || null
    : null;
  let overlayRouteOwnerId = null;
  let latestWindowActivation = 0;
  let wizardStep = 0;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const normalizePath = (path) => {
    const next = path || "/";
    if (next === "/") {
      return next;
    }

    return next.endsWith("/") ? next : `${next}/`;
  };

  const explorerWindowIdsByPath = {
    "/blog/": "explorer-blog",
    "/notes/": "explorer-notes",
    "/activity/": "explorer-activity",
    "/photos/": "explorer-photos",
    "/projects/": "explorer-projects",
    "/pages/": "explorer-pages"
  };
  const explorerWindowIdForUrl = (url) => {
    try {
      return explorerWindowIdsByPath[normalizePath(new URL(url || desktopUrl, window.location.origin).pathname)] || null;
    } catch {
      return null;
    }
  };

