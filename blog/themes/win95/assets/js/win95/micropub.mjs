const sessionKey = "michael95.micropub.session";
const pendingKey = "michael95.micropub.pending";

const encodeBase64Url = (bytes) => btoa(String.fromCharCode(...bytes))
  .replaceAll("+", "-")
  .replaceAll("/", "_")
  .replaceAll("=", "");

const randomValue = (length = 32) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
};

const challengeFor = async (verifier) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return encodeBase64Url(new Uint8Array(digest));
};

const readJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: "invalid_response", error_description: text };
  }
};

export const discoverAuthMetadata = async (configuration, fetcher = fetch) => {
  const {
    metadataEndpoint,
    authorizationEndpoint,
    tokenEndpoint
  } = configuration;

  // The site publishes explicit endpoints, so sign-in does not need to wait on
  // a second cross-origin discovery request before it can launch.
  if (authorizationEndpoint && tokenEndpoint) {
    return {
      issuer: new URL(authorizationEndpoint).origin,
      authorization_endpoint: authorizationEndpoint,
      token_endpoint: tokenEndpoint
    };
  }

  if (!metadataEndpoint) throw new Error("The IndieAuth server is not configured.");

  let response;
  try {
    response = await fetcher(metadataEndpoint, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Could not contact the IndieAuth server.");
  }

  if (!response.ok) throw new Error("Could not discover the IndieAuth server.");
  const metadata = await readJson(response);
  if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
    throw new Error("The IndieAuth server metadata is incomplete.");
  }
  return metadata;
};

const titleFor = (item) => {
  const properties = item.properties || {};
  return properties.name?.[0] || properties.content?.[0]?.slice?.(0, 58) || `Untitled ${item.postType || "entry"}`;
};

export const toLocalDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.valueOf() - offset).toISOString().slice(0, 16);
};

export const relationshipFor = (type) => ({
  reply: "in-reply-to",
  like: "like-of",
  repost: "repost-of",
  bookmark: "bookmark-of"
})[type];

export const contentTypes = {
  article: "Article", note: "Note", photo: "Photo", activity: "Activity",
  reply: "Reply", like: "Like", repost: "Repost", bookmark: "Bookmark", blogroll: "Blogroll entry"
};

const keysForType = (type) => ["content", "category", "published", ...({
  article: ["name", "summary"], note: [], photo: ["name", "photo", "alt", "location"],
  activity: ["name"], reply: ["name", "in-reply-to"], like: ["like-of"],
  repost: ["repost-of"], bookmark: ["name", "bookmark-of"], blogroll: ["name", "url", "feed"]
}[type] || [])];

export const buildUpdate = (url, original, properties) => ({
  action: "update", url, replace: properties,
  delete: keysForType(properties["post-type"]?.[0]).filter((key) => Object.hasOwn(original, key) && !Object.hasOwn(properties, key))
});

export const filterContent = (items, folder, status, search, sort = "updated") => items.filter((item) => {
  if (folder && item.postType !== folder) return false;
  if (status === "deleted") return item.state === "deleted" && titleFor(item).toLowerCase().includes(search.toLowerCase());
  if (item.state === "deleted") return false;
  if (status === "published" && !item.publishedUrl) return false;
  if (status === "draft" && item.state !== "draft" && !item.hasUnpublishedChanges) return false;
  return `${titleFor(item)} ${(item.properties?.category || []).join(" ")} ${item.properties?.content?.[0] || ""}`.toLowerCase().includes(search.toLowerCase());
}).sort((a, b) => sort === "name" ? titleFor(a).localeCompare(titleFor(b))
  : sort === "type" ? (a.postType || "").localeCompare(b.postType || "") : (b.updated || "").localeCompare(a.updated || ""));

export class MicropubClient {
  constructor(root) {
    this.root = root;
    this.form = root.querySelector("[data-mp-form]");
    this.list = root.querySelector("[data-mp-list]");
    this.status = root.querySelector("[data-mp-status]");
    this.connection = root.querySelector("[data-mp-connection]");
    this.authView = root.querySelector("[data-mp-auth]");
    this.workspace = root.querySelector("[data-mp-workspace]");
    this.busy = false;
    this.dirty = false;
    this.folder = "";
    this.current = null;
    this.items = [];
    this.config = null;
    this.session = this.readSession();
  }

  readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(sessionKey) || "null");
    } catch {
      return null;
    }
  }

  saveSession(session) {
    this.session = session;
    if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
    else sessionStorage.removeItem(sessionKey);
  }

  setStatus(message, error = false) {
    this.status.textContent = message;
    this.status.style.color = error ? "#800000" : "";
    const errorBox = this.root.querySelector("[data-mp-error]");
    errorBox.hidden = !error;
    errorBox.textContent = error ? message : "";
  }

  async init() {
    if (this.root.dataset.micropubBound === "true") return;
    this.root.dataset.micropubBound = "true";
    this.bind();
    await this.handleCallback();
    this.renderAuth();
    if (this.session) await this.connect();
  }

  bind() {
    const on = (selector, callback) => this.root.querySelectorAll(selector).forEach((button) =>
      button.addEventListener("click", callback));
    on("[data-mp-sign-in]", () => this.signIn());
    on("[data-mp-sign-out]", () => this.signOut());
    on("[data-mp-new]", () => this.chooseNew());
    on("[data-mp-refresh]", () => { if (!this.busy) this.loadPosts(); });
    on("[data-mp-about]", () => this.dialog("About Micropub", "Micropub for Windows 95\nManage articles, notes, photos, activity and your blogroll with LittlePublisher.\n\nCtrl+S saves a draft. Ctrl+N creates an item. Publication is followed by a separate site deployment.", ["OK"]));
    on("[data-mp-save-draft]", () => this.save("draft"));
    on("[data-mp-publish]", () => this.save("published"));
    on("[data-mp-delete]", () => this.deleteOrRestore());
    on("[data-mp-upload]", () => this.upload());
    on("[data-mp-revert]", async () => {
      if (!await this.canLeave()) return;
      if (this.current) this.open(this.current, true); else this.newPost();
    });
    on("[data-mp-preview-command]", () => this.selectTab("preview"));
    this.root.querySelectorAll("[data-mp-tab]").forEach((tab) => {
      tab.addEventListener("click", () => this.selectTab(tab.dataset.mpTab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...this.root.querySelectorAll("[data-mp-tab]")];
        const index = event.key === "Home" ? 0 : event.key === "End" ? 2 : (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
        this.selectTab(tabs[index].dataset.mpTab); tabs[index].focus();
      });
    });
    this.root.querySelector("[data-mp-type]").addEventListener("change", () => this.showFields());
    for (const selector of ["[data-mp-filter]", "[data-mp-sort]", "[data-mp-search]"]) {
      this.root.querySelector(selector).addEventListener("input", () => this.renderList());
    }
    this.form.addEventListener("submit", (event) => { event.preventDefault(); this.save("draft"); });
    this.form.addEventListener("input", () => { this.setDirty(true); this.renderPreview(); });
    this.root.addEventListener("keydown", (event) => {
      if (this.root.querySelector("dialog[open]")) return;
      if ((event.ctrlKey || event.metaKey) && ["s", "n"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        if (event.key.toLowerCase() === "s") this.save("draft"); else this.chooseNew();
      }
      if (event.key === "F5") { event.preventDefault(); if (!this.busy) this.loadPosts(); }
      if (event.key === "Escape") this.root.querySelectorAll("details[open]").forEach((menu) => menu.open = false);
    });
    this.root.querySelectorAll(".micropub-menu details").forEach((menu) => {
      menu.addEventListener("toggle", () => { if (menu.open) this.root.querySelectorAll(".micropub-menu details").forEach((other) => { if (other !== menu) other.open = false; }); });
      menu.addEventListener("click", (event) => { if (event.target.closest("button")) menu.open = false; });
    });
    this.root.addEventListener("click", (event) => {
      if (!event.target.closest(".micropub-menu")) this.root.querySelectorAll("details").forEach((menu) => menu.open = false);
    });
    this.root.addEventListener("window-before-close", (event) => {
      if (this.busy || this.dirty) {
        event.preventDefault();
        if (!this.busy) this.canLeave().then((allowed) => { if (allowed) this.root.querySelector('[data-window-action="close"]').click(); });
      }
    });
    window.addEventListener("beforeunload", (event) => {
      if (this.root.isConnected && (this.dirty || this.busy)) { event.preventDefault(); event.returnValue = ""; }
    });
    this.renderFolders();
  }

  setDirty(dirty) {
    this.dirty = dirty;
    this.root.querySelector("[data-mp-dirty]").textContent = dirty ? "Modified" : "";
  }

  dialog(title, message, choices = ["OK", "Cancel"], content = null) {
    const dialog = this.root.querySelector("[data-mp-dialog]");
    if (dialog.open) return Promise.resolve("Cancel");
    this.root.querySelector("[data-mp-dialog-title]").textContent = title;
    const body = this.root.querySelector("[data-mp-dialog-body]");
    body.textContent = message;
    if (content) body.append(content);
    const buttons = this.root.querySelector("[data-mp-dialog-buttons]");
    buttons.replaceChildren();
    return new Promise((resolve) => {
      const done = (choice) => { dialog.close(); resolve(choice); };
      choices.forEach((choice) => {
        const button = document.createElement("button");
        button.type = "button"; button.className = "setup-button"; button.textContent = choice;
        button.addEventListener("click", () => done(choice)); buttons.append(button);
      });
      dialog.oncancel = (event) => { event.preventDefault(); done("Cancel"); };
      dialog.showModal();
      (content || buttons.firstElementChild).focus();
    });
  }

  async canLeave() {
    if (this.busy) return false;
    if (!this.dirty) return true;
    const choice = await this.dialog("Unsaved changes", "Save changes before continuing?", ["Save Draft", "Discard", "Cancel"]);
    if (choice === "Save Draft") return this.save("draft");
    if (choice === "Discard") { this.setDirty(false); return true; }
    return false;
  }

  async chooseNew() {
    if (!this.session || !await this.canLeave()) return;
    const select = document.createElement("select"); select.setAttribute("aria-label", "Content type");
    Object.entries(contentTypes).filter(([type]) => this.supported(type)).forEach(([type, name]) => select.add(new Option(name, type)));
    select.value = this.folder || "note";
    if (!select.value) select.selectedIndex = 0;
    if (await this.dialog("New content", "Choose the type of item to create.", ["Create", "Cancel"], select) === "Create") this.newPost(select.value);
  }

  supported(type) {
    return Boolean(contentTypes[type]) && (!this.config?.["post-types"] || this.config["post-types"].some((entry) => entry.type === type));
  }

  renderFolders() {
    const folders = this.root.querySelector("[data-mp-folders]"); folders.replaceChildren();
    Object.entries({ "": "All content", article: "Articles", note: "Notes", photo: "Photos", activity: "Activity", reply: "Replies", like: "Likes", repost: "Reposts", bookmark: "Bookmarks", blogroll: "Blogroll" }).forEach(([type, label]) => {
      const button = document.createElement("button"); button.type = "button";
      button.textContent = "▣  " + label; button.setAttribute("aria-pressed", String(this.folder === type));
      button.addEventListener("click", () => { this.folder = type; this.renderFolders(); this.renderList(); });
      folders.append(button);
    });
  }

  selectTab(name) {
    this.root.querySelectorAll("[data-mp-tab]").forEach((tab) => {
      const selected = tab.dataset.mpTab === name;
      tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1;
    });
    this.root.querySelectorAll("[data-mp-panel]").forEach((panel) => panel.hidden = panel.dataset.mpPanel !== name);
    this.renderPreview();
  }

  renderPreview() {
    const fields = this.form.elements;
    const preview = this.root.querySelector("[data-mp-preview]"); preview.replaceChildren();
    const heading = document.createElement("h2"); heading.textContent = fields.name.value || contentTypes[fields["post-type"].value] || "Content"; preview.append(heading);
    const media = this.root.querySelector("[data-mp-media-preview]"); media.replaceChildren(); media.hidden = true;
    if (fields["post-type"].value === "photo" && /^(https?:\/\/|\/(?!\/))/i.test(fields.media.value)) {
      const img = document.createElement("img"); img.src = fields.media.value; img.alt = fields.alt.value; img.referrerPolicy = "no-referrer";
      media.append(img); media.hidden = false; preview.append(img.cloneNode());
    }
    if (fields["post-type"].value === "blogroll") {
      const url = document.createElement("p"); url.textContent = fields["site-url"].value; preview.append(url);
      const feed = document.createElement("p"); feed.textContent = fields.feed.value ? `Feed: ${fields.feed.value}` : ""; preview.append(feed);
    }
    if (relationshipFor(fields["post-type"].value)) { const target = document.createElement("p"); target.textContent = fields.target.value; preview.append(target); }
    const body = document.createElement("p"); body.className = "mp-preview-body"; body.textContent = fields.content.value; preview.append(body);
  }

  setBusy(busy) {
    this.busy = busy;
    this.form.inert = busy || this.readOnly || this.current?.state === "deleted";
    this.root.setAttribute("aria-busy", String(busy));
    this.root.querySelectorAll("[data-mp-save-draft], [data-mp-publish], [data-mp-new], [data-mp-upload], [data-mp-sign-out], [data-mp-revert]").forEach((button) => button.disabled = busy || !this.session || (button.matches("[data-mp-save-draft], [data-mp-publish]") && (this.readOnly || this.current?.state === "deleted" || !this.supported(this.form.elements["post-type"].value))));
    this.root.querySelectorAll("[data-mp-delete]").forEach((button) => { button.disabled = busy || !this.current; button.textContent = this.current?.state === "deleted" ? "Restore" : "Delete…"; });
  }

  async discoverAuth() {
    return discoverAuthMetadata({
      metadataEndpoint: this.root.dataset.authMetadata,
      authorizationEndpoint: this.root.dataset.authorizationEndpoint,
      tokenEndpoint: this.root.dataset.tokenEndpoint
    });
  }

  async signIn() {
    try {
      this.setStatus("Contacting IndieAuth...");
      const metadata = await this.discoverAuth();
      const verifier = randomValue(48);
      const state = randomValue(24);
      const redirectUri = `${window.location.origin}/micropub/`;
      const pending = {
        verifier,
        state,
        issuer: metadata.issuer,
        tokenEndpoint: metadata.token_endpoint || this.root.dataset.tokenEndpoint,
        redirectUri,
        clientId: redirectUri
      };
      sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      const query = new URLSearchParams({
        response_type: "code",
        client_id: pending.clientId,
        redirect_uri: redirectUri,
        state,
        code_challenge: await challengeFor(verifier),
        code_challenge_method: "S256",
        scope: "profile create update delete media",
        me: this.root.dataset.me
      });
      window.location.assign(`${metadata.authorization_endpoint || this.root.dataset.authorizationEndpoint}?${query}`);
    } catch (error) {
      this.setStatus(error.message || "Sign in failed.", true);
    }
  }

  async handleCallback() {
    const query = new URLSearchParams(window.location.search);
    if (!query.has("code") && !query.has("error")) return;
    const pending = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
    history.replaceState(history.state, "", "/micropub/");
    if (query.has("error")) {
      this.setStatus(query.get("error_description") || query.get("error"), true);
      sessionStorage.removeItem(pendingKey);
      return;
    }
    if (!pending || query.get("state") !== pending.state) {
      this.setStatus("The IndieAuth response could not be verified.", true);
      return;
    }
    if (query.get("iss") && pending.issuer && query.get("iss").replace(/\/$/, "") !== pending.issuer.replace(/\/$/, "")) {
      this.setStatus("The IndieAuth issuer did not match.", true);
      return;
    }
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: query.get("code"),
      client_id: pending.clientId,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier
    });
    const response = await fetch(pending.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const token = await readJson(response);
    sessionStorage.removeItem(pendingKey);
    if (!response.ok || !token.access_token) {
      this.setStatus(token.error_description || "Token exchange failed.", true);
      return;
    }
    this.saveSession({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + Number(token.expires_in || 900) * 1000,
      scope: token.scope,
      me: token.me,
      tokenEndpoint: pending.tokenEndpoint,
      clientId: pending.clientId
    });
  }

  async accessToken() {
    if (!this.session) throw new Error("Sign in is required.");
    if (this.session.expiresAt > Date.now() + 30_000) return this.session.accessToken;
    if (!this.session.refreshToken) throw new Error("Your session has expired.");
    const response = await fetch(this.session.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.session.refreshToken,
        client_id: this.session.clientId
      })
    });
    const token = await readJson(response);
    if (!response.ok || !token.access_token) {
      this.saveSession(null);
      this.renderAuth();
      throw new Error(token.error_description || "Your session has expired.");
    }
    this.saveSession({
      ...this.session,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || this.session.refreshToken,
      expiresAt: Date.now() + Number(token.expires_in || 900) * 1000,
      scope: token.scope || this.session.scope
    });
    return this.session.accessToken;
  }

  async api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${await this.accessToken()}`,
        ...(options.headers || {})
      }
    });
    const body = await readJson(response);
    if (!response.ok) throw new Error(body.error_description || body.title || `Request failed (${response.status}).`);
    return { response, body };
  }

  renderAuth() {
    const signedIn = Boolean(this.session);
    this.authView.hidden = signedIn;
    this.workspace.hidden = !signedIn;
    this.connection.textContent = signedIn ? "Signed in · Connecting…" : "Not signed in";
    this.setBusy(false);
    const account = this.root.querySelector("[data-mp-account]");
    if (account) account.textContent = this.session?.me || "";
  }

  async connect() {
    try {
      this.setStatus("Loading Micropub configuration...");
      const endpoint = this.root.dataset.micropubEndpoint;
      this.config = (await this.api(`${endpoint}?q=config`)).body;
      if (!await this.loadPosts()) throw new Error("Could not load the content library. Use View > Refresh to retry.");
      this.newPost();
      this.connection.textContent = "Connected to LittlePublisher";
      this.setStatus("Ready");
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }

  async loadPosts() {
    if (!this.session) return;
    try {
      this.setStatus("Loading content...");
      const endpoint = this.root.dataset.micropubEndpoint;
      const result = await this.api(`${endpoint}?q=posts&take=50`);
      this.items = result.body.items || [];
      this.renderList();
      this.setStatus(`${this.items.length} item${this.items.length === 1 ? "" : "s"}`);
      return true;
    } catch (error) {
      this.setStatus(error.message, true);
      return false;
    }
  }

  renderList() {
    const visible = filterContent(this.items, this.folder,
      this.root.querySelector("[data-mp-filter]").value,
      this.root.querySelector("[data-mp-search]").value,
      this.root.querySelector("[data-mp-sort]").value);
    this.list.replaceChildren();
    this.root.querySelector("[data-mp-count]").textContent = `${visible.length} item${visible.length === 1 ? "" : "s"}`;
    this.root.querySelector("[data-mp-limit]").textContent = this.items.length >= 50 ? "Server returns the latest 50 items only." : "";
    if (!visible.length) {
      const empty = document.createElement("p"); empty.className = "micropub-empty";
      empty.textContent = "No items match this view."; this.list.append(empty);
    }
    visible.forEach((item) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "micropub-post-item";
      const selected = this.current?.managementUrl === item.managementUrl;
      button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected));
      [titleFor(item), contentTypes[item.postType] || item.postType || "Entry", `${item.state}${item.hasUnpublishedChanges ? " *" : ""}`, item.updated ? new Date(item.updated).toLocaleDateString() : "—"].forEach((value) => {
        const cell = document.createElement("span"); cell.textContent = value; cell.title = value; button.append(cell);
      });
      button.addEventListener("click", () => this.open(item));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const rows = [...this.list.querySelectorAll("button")]; const index = rows.indexOf(button);
        const next = event.key === "Home" ? rows[0] : event.key === "End" ? rows.at(-1) : rows[index + (event.key === "ArrowDown" ? 1 : -1)]; next?.focus();
      });
      this.list.append(button);
    });
  }

  newPost(type = "note") {
    this.current = null;
    this.readOnly = false;
    this.unresolvedBlogrollUrl = false;
    this.form.reset();
    this.form.elements["post-type"].disabled = false;
    this.form.elements["post-type"].value = this.supported(type) ? type : Object.keys(contentTypes).find((entry) => this.supported(entry));
    this.form.elements.published.value = toLocalDate(new Date());
    this.setDirty(false); this.showFields(); this.selectTab("content"); this.setBusy(false);
    this.renderList();
    this.root.querySelector("[data-mp-document-title]").textContent = `New ${contentTypes[this.form.elements["post-type"].value] || "item"}`;
    this.setStatus("New item");
    this.form.elements.content.focus();
  }

  async open(item, force = false) {
    if (!force && !await this.canLeave()) return;
    this.current = item;
    this.form.reset();
    const properties = item.properties || {};
    const type = item.postType || properties["post-type"]?.[0] || "note";
    const typeField = this.form.elements["post-type"];
    if (![...typeField.options].some((option) => option.value === type)) typeField.add(new Option(type, type));
    typeField.value = type; typeField.disabled = true;
    const fields = this.form.elements;
    for (const key of ["name", "summary", "content", "alt", "feed", "location"]) fields[key].value = typeof properties[key]?.[0] === "string" ? properties[key][0] : "";
    fields.category.value = (properties.category || []).join(", ");
    for (const key of ["published", "start", "end"]) fields[key].value = toLocalDate(properties[key]?.[0]);
    fields.target.value = properties[relationshipFor(type)]?.[0] || "";
    const siteUrl = properties.url?.[0] || "";
    this.unresolvedBlogrollUrl = type === "blogroll" && [item.managementUrl, item.publishedUrl].includes(siteUrl);
    fields["site-url"].value = type === "blogroll" && !this.unresolvedBlogrollUrl ? siteUrl : "";
    this.readOnly = (properties.photo?.length || 0) > 1 || (properties.content?.length || 0) > 1 ||
      ["content", "photo", "name", "summary", "alt", "location", "feed"].some((key) => properties[key]?.[0] != null && typeof properties[key][0] !== "string");
    fields.media.value = properties.photo?.[0] || properties.audio?.[0] || properties.video?.[0] || "";
    this.setDirty(false); this.showFields(); this.selectTab("content"); this.setBusy(false); this.renderList();
    this.root.querySelector("[data-mp-document-title]").textContent = titleFor(item);
    this.setStatus(this.supported(type) ? `Editing ${contentTypes[type]}` : "This content type requires additional publishing support; editing is unavailable.", !this.supported(type));
    this.form.inert = this.readOnly || !this.supported(type) || item.state === "deleted";
    if (this.readOnly) this.setStatus("This item contains structured or multiple values. Editing is disabled to preserve them.", true);
    if (this.unresolvedBlogrollUrl) this.setStatus("LittlePublisher returned this entry’s own URL instead of its website. Enter the website before publishing; draft saves preserve the existing website when left blank.", true);
  }

  showFields() {
    const type = this.form?.elements["post-type"]?.value || "note";
    const show = (name, visible) => {
      const field = this.root.querySelector(`[data-mp-field="${name}"]`);
      if (field) field.hidden = !visible;
    };
    show("name", type !== "note" && !["like", "repost"].includes(type));
    show("summary", type === "article");
    this.root.querySelector("[data-mp-content-label]").textContent = type === "photo" ? "Caption (Markdown)" : type === "blogroll" ? "Commentary" : "Content (Markdown)";
    show("target", ["reply", "like", "repost", "bookmark"].includes(type));
    show("site-url", type === "blogroll");
    show("feed", type === "blogroll");
    show("start", type === "event");
    show("end", type === "event");
    show("location", ["photo", "event"].includes(type));
    show("media", ["photo", "audio", "video"].includes(type));
    show("alt", type === "photo");
    this.form.elements["media-file"].accept = "image/*";
    this.form.elements["post-type"].querySelectorAll("option").forEach((option) => option.disabled = !this.supported(option.value));
    this.renderPreview();
  }

  properties(status) {
    const fields = this.form.elements;
    const type = fields["post-type"].value;
    const properties = {
      "post-type": [type],
      content: [fields.content.value],
      "post-status": [status]
    };
    const add = (key, value) => {
      if (value?.trim?.()) properties[key] = [value.trim()];
    };
    if (type !== "note" && !["like", "repost"].includes(type)) add("name", fields.name.value);
    if (type === "article") add("summary", fields.summary.value);
    const originalDate = this.current?.properties?.published?.[0];
    add("published", originalDate && fields.published.value === toLocalDate(originalDate) ? originalDate : fields.published.value ? new Date(fields.published.value).toISOString() : "");
    const categories = fields.category.value.split(",").map((value) => value.trim()).filter(Boolean);
    if (categories.length) properties.category = categories;
    const relationship = relationshipFor(type);
    if (relationship) add(relationship, fields.target.value);
    if (type === "blogroll") {
      add("url", fields["site-url"].value);
      add("feed", fields.feed.value);
    }
    if (type === "photo") add("location", fields.location.value);
    if (["photo", "audio", "video"].includes(type)) add(type, fields.media.value);
    if (type === "photo") add("alt", fields.alt.value);
    return properties;
  }

  validate(status) {
    const fields = this.form.elements; const type = fields["post-type"].value;
    const required = status === "published" ? ({ article: ["name", "content"], note: ["content"], photo: ["media", "alt"], blogroll: ["name", "site-url"], activity: ["content"], reply: ["target", "content"], like: ["target"], repost: ["target"], bookmark: ["target"] }[type] || []) : [];
    for (const field of [...fields]) {
      if (!field.setCustomValidity || field.type === "file" || field.closest("[data-mp-field][hidden]")) continue;
      field.setCustomValidity("");
      if (required.includes(field.name) && !field.value.trim()) field.setCustomValidity("Complete this field before publishing.");
      if (field.name === "media" && field.value && !/^(https?:\/\/|\/(?!\/))/i.test(field.value)) field.setCustomValidity("Enter an image URL or a site-relative path.");
      if (field.type === "url" && field.value && !/^https?:\/\//i.test(field.value)) field.setCustomValidity("Enter an http or https URL.");
      if (!field.checkValidity()) {
        this.selectTab(field.closest("[data-mp-panel]").dataset.mpPanel);
        field.reportValidity(); return false;
      }
    }
    return true;
  }

  async save(status) {
    if (this.busy || this.readOnly || !this.session || !this.supported(this.form.elements["post-type"].value) || this.current?.state === "deleted") return false;
    if (!this.validate(status)) return false;
    if (status === "published" && await this.dialog("Publish content", "Publish this version to the blog? The public site updates after deployment completes.", ["Publish", "Cancel"]) !== "Publish") return false;
    this.setBusy(true);
    try {
      const endpoint = this.root.dataset.micropubEndpoint;
      const properties = this.properties(status);
      const payload = this.current ? buildUpdate(this.current.managementUrl, this.current.properties || {}, properties) : { type: ["h-entry"], properties };
      if (this.unresolvedBlogrollUrl && !properties.url && payload.delete) payload.delete = payload.delete.filter((key) => key !== "url");
      this.setStatus(status === "draft" ? "Saving draft…" : "Publishing…");
      const result = await this.api(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const location = this.current?.managementUrl || result.response.headers.get("Location") || result.body.url;
      if (!location) throw new Error("Server accepted the save but returned no item URL. Refresh the library before creating another item.");
      this.current = { ...this.current, managementUrl: location, properties: { ...this.current?.properties, ...properties }, postType: properties["post-type"][0], state: status };
      this.setDirty(false);
      this.form.elements["post-type"].disabled = true;
      const refreshed = await this.loadPosts();
      const updated = this.items.find((item) => item.managementUrl === location || item.publishedUrl === location);
      if (refreshed && updated) this.current = updated;
      this.root.querySelector("[data-mp-document-title]").textContent = titleFor(this.current);
      this.renderList();
      this.setStatus(refreshed === false ? "Saved, but the library could not refresh. Use View > Refresh." : status === "draft" ? "Draft saved" : "Publication accepted · site deployment pending");
      return true;
    } catch (error) { this.setStatus(error.message, true); return false; }
    finally { this.setBusy(false); }
  }

  async deleteOrRestore() {
    if (this.busy || !this.current || !await this.canLeave()) return;
    const deleted = this.current.state === "deleted";
    if (await this.dialog(deleted ? "Restore item" : "Delete item", `${deleted ? "Restore" : "Delete"} “${titleFor(this.current)}”?${deleted ? "" : " You can restore it from the Deleted view."}`, [deleted ? "Restore" : "Delete", "Cancel"]) === "Cancel") return;
    this.setBusy(true);
    try {
      await this.api(this.root.dataset.micropubEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: deleted ? "undelete" : "delete", url: this.current.managementUrl }) });
      await this.loadPosts(); this.newPost(); this.setStatus(deleted ? "Item restored" : "Item deleted");
    } catch (error) { this.setStatus(error.message, true); }
    finally { this.setBusy(false); }
  }

  async upload() {
    if (this.busy) return;
    const file = this.form.elements["media-file"].files?.[0];
    if (!file || !file.type.startsWith("image/")) { this.setStatus("Choose an image file first.", true); return; }
    this.setBusy(true);
    try {
      this.setStatus(`Uploading ${file.name}…`);
      const data = new FormData(); data.append("file", file);
      const endpoint = this.config?.["media-endpoint"];
      if (!endpoint) throw new Error("This server does not advertise a media endpoint.");
      const result = await this.api(endpoint, { method: "POST", body: data });
      const url = result.response.headers.get("Location") || result.body.url;
      if (!url) throw new Error("Upload response did not include a media URL.");
      this.form.elements.media.value = url;
      this.setDirty(true); this.renderPreview(); this.setStatus("Image uploaded · save the item to attach it");
    } catch (error) { this.setStatus(error.message, true); }
    finally { this.setBusy(false); }
  }

  async signOut() {
    if (!await this.canLeave()) return;
    const session = this.session;
    this.saveSession(null);
    this.current = null;
    this.items = [];
    this.renderAuth();
    this.renderList();
    this.setStatus("Signed out");
    if (session?.refreshToken && session?.tokenEndpoint) {
      fetch(`${session.tokenEndpoint}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: session.refreshToken, client_id: session.clientId })
      }).catch(() => {});
    }
  }
}

export const bindMicropubClients = (root = document) => {
  root.querySelectorAll("[data-micropub-app]").forEach((element) => {
    if (element.dataset.micropubBound !== "true") {
      new MicropubClient(element).init();
    }
  });
};

export const observeMicropubClients = () => {
  bindMicropubClients();
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0)) bindMicropubClients();
  });
  observer.observe(document.body, { childList: true, subtree: true });
};
