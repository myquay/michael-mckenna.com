# Windows 95 fidelity review and improvement plan

Reviewed 6 September 2026 against repository revision `79113b9`. Concurrent working-tree changes appeared during the review, including a new Internet Explorer/first-webpage feature; those additions are outside this assessment. Findings describe the theme inspected during this review and should be reconciled with those changes before implementation.

## Assessment

**Approximately 7/10 for Windows 95 fidelity:** immediately recognizable, with a substantially implemented desktop model, but inconsistent visual proportions and unfinished interaction conventions. This is a qualitative design judgment, not a measured compatibility score.

The strongest elements are the teal/gray/navy palette, sharp beveled window frames, period icon imagery, Explorer tree, independently opened windows, taskbar entries, and setup-dialog concept. The biggest gains will come from making existing controls consistent and functional, rather than adding more decorative applications.

Recommended target: the original Windows 95 shell before the Internet Explorer Desktop Update, with deliberate concessions for a readable, accessible blog. Exact geometry should be calibrated against one reference installation at standard DPI; Windows themes, display settings, and later shell updates affect appearance.

## Scope and evidence

Reviewed theme CSS, templates, desktop JavaScript, and the documented window architecture. Built the local site successfully and visually inspected the desktop, Start menu, My Computer, Posts in Details view, and a Vue article at a 1280 × 720 browser viewport. Confirmed double-click launching and separate Explorer instances; clicked Settings and observed no submenu or action.

The browser restored existing desktop state on the local origins, so this was not a verified first-visit experience. Mobile behavior, all dialog interactions, keyboard behavior, and cross-browser rendering were reviewed in source only, not exhaustively exercised. Production was not checked. Existing Hugo raw-HTML warnings appeared during the build. No theme or application code was changed for this review.

Historical references:

- [University of Hawaii's contemporary Windows 95 guide](https://www.hawaii.edu/itsdocs/win/win95/) documents single-click selection, double-click opening, right-click menus, taskbar behavior, Explorer trees, and shortcut arrows. Its screenshots provide useful period examples; the guide dates from 1998, so it is not an exact original-release specification.
- [Microsoft's Introducing Microsoft Windows 95, 1995](https://ftpmirror1.infania.net/sites/bitsavers/pdf/microsoft/windows_95/Introducing_Microsoft_Windows_95_1995.pdf) is a primary reference for original-shell screenshots and Explorer's four views. Search-indexed excerpts were available; direct PDF retrieval failed during this review. Obtain a readable copy before treating fine pixel measurements as definitive.
- [Microsoft's description of traditional Explorer modes](https://learn.microsoft.com/en-us/archive/msdn-magazine/2000/march/windows-2000-ui-innovations-enhance-your-user-s-experience-with-new-infotip-and-icon-overlay-shell-extensions) confirms Large Icons, Small Icons, List, and Details, and the traditional file columns. This is later documentation, useful for behavior rather than original-release artwork.

## Findings

Paths below are relative to `blog/themes/win95/` unless stated otherwise.

| Area | Assessment and evidence | Suggested improvement |
| --- | --- | --- |
| Palette and frames | Strong. `00-base.css` defines classic teal, silver, navy, white, and gray; `30-windows.css` uses solid active and inactive title bars and layered bevels. | Preserve these foundations. Compare edge ordering and border thickness against the selected reference. |
| Typography and density | Major visual mismatch. Shell defaults to 11px, while Explorer menus, rows, pane headings, and status bars use 15px. The rendered title bars and taskbar look much smaller than the content chrome. Font stacks rely on locally installed fonts; no embedded UI face is defined. | Establish one compact UI scale and a redistributable period-style font. Start calibration around 11–12px shell text; keep article text at a readable size. |
| Icon sizing | The source uses 34px desktop/large icons and 20–22px file/tree icons, alongside 16px title/taskbar icons. Desktop items are spaced 102px vertically. | Normalize to native 16px and 32px artwork where possible, and tighten the desktop grid. Inspect the actual ICO frames rather than resizing every image indiscriminately. |
| Selection | Functional defect as well as fidelity gap. JavaScript applies `.is-selected` to file items, but CSS has no matching file selection rule. Files and desktop labels acquire navy selection styling on hover; file rows use full-row hover highlighting and yellow dotted outlines. | Separate hover, focus, selected, and inactive-selected states. Preserve selection when the pointer leaves. Use label-focused selection and a period-style focus rectangle. |
| Start menu | Recognizable but stylistically mixed. The branding rail uses a blue gradient; the original-shell target calls for the gray Windows 95 rail treatment. Documents and Help are absent; About replaces Help. Settings, Find, and Shut Down have no handlers. | Correct the rail and typography; restore useful menu structure. Wire Settings to existing relevant dialogs, implement Find for blog content, and add a real Help page. Disable unsupported entries until implemented. |
| Window controls | Moving, resizing, maximizing, minimizing, and independent instances are implemented. Buttons use text characters `_`, `□`, `❐`, and `x`, whose shapes vary by font. The title icon is an image without a system menu. | Replace glyphs with consistent pixel geometry. Add a system menu that uses existing window actions; reflect capability and state in disabled commands. |
| Explorer views | Tree, splitter, Details, List, icon positioning, and view persistence are good foundations. Small Icons is missing. List uses a normal row-major CSS grid. Details shows Name, Type, Published. | Add Small Icons, label the existing mode Large Icons, and make List flow down columns. Retain Published as an intentional blog field; do not invent file sizes merely for appearance. |
| My Computer | Double-click opens a two-pane `Exploring - My Computer` window. This feels like Explore rather than the original default My Computer folder view. | For stricter fidelity, distinguish a one-pane Open view from a two-pane Explore command, while retaining independent window instances. |
| Scrollbars and controls | Rounded modern scrollbars are visible in both Posts and article panes. Native form controls can also vary by host browser. | Give supported desktop scrollbars and form controls a coherent classic treatment, with usable native fallbacks where browser styling is limited. |
| Menus and keyboard | Most File/Edit/Tools/Help buttons are inert. Underlined first letters imply shortcuts, but the main shell has no corresponding mnemonic or arrow-navigation implementation. No shell `contextmenu` handler was found. | Implement a shared menu controller and useful context menus; provide visible disabled states for unavailable actions. Avoid claiming control over shortcuts intercepted by the host OS/browser. |
| Taskbar | Individual window entries are a strength. Active state is sunken but lacks the classic stippled face/bold title treatment. Buttons have a 120px minimum width; desktop overflow handling is limited compared with compact mode. | Improve active styling and shrink/overflow behavior. Add taskbar context actions such as Restore, Minimize, Close, and later Cascade/Tile. |
| Articles and secondary surfaces | Articles deliberately resemble a modern reading page inside a classic frame: Georgia text, large headline, author avatar. Activity and blogroll use cards. RSS uses a modern orange symbol within a period-style wizard concept. | Keep readability, but give the document viewer its own useful menu instead of Explorer's inert menu. Optionally reduce modern avatar/card styling. Treat RSS and personal branding as intentional adaptations. |

## Prioritized implementation plan

Effort estimates are relative: S = localized styling/templates; M = a shared component or bounded interaction; L = new behavior across routing/state/UI. Implement in this order.

### Phase 1 — Consistent appearance and selection (highest return)

Implemented 6 September 2026. See [the baseline and validation record](windows-95-phase1-baseline.md) for chosen metrics, font provenance, compatibility decisions, and browser coverage. Phases 2–4 remain planned.

1. **P1 / M: Set the visual baseline.** Record a reference desktop, Explorer, Start menu, and dialog at standard DPI. Define shared shell typography, row heights, icon sizes, spacing, and borders in `00-base.css`; apply through `10-desktop.css`, `20-dialogs.css`, `30-windows.css`, and `40-explorer.css`. Include font licensing and fallback checks.
2. **P1 / M: Fix selection styling and semantics.** Update `win95.mjs` and file/desktop CSS together. Click selects; double-click opens; moving the pointer does not select another item. Keep keyboard focus visible and selection distinguishable when the window loses focus. Start with single selection; defer multi-selection until useful batch actions exist.
3. **P1 / S: Correct conspicuous artwork and chrome.** Use native icon sizes, pixel window-control symbols, gray Start rail, and a stippled active taskbar button. Remove decorative text shadow from desktop labels if the reference baseline confirms it is inappropriate.
4. **P1 / M: Style scrollbars and form controls.** Centralize the treatment and retain accessible behavior and browser fallbacks. Limit pixelated rendering to UI artwork; the global `img` rule currently also affects photographs and article screenshots.

Acceptance: desktop and Explorer have a consistent visual scale; selected files stay visibly selected after pointer movement; hover cannot impersonate selection; controls remain legible at browser zoom. Compare screenshots before and after at identical dimensions.

### Phase 2 — Make the shell's promises real

5. **P1 / M: Audit every visible command.** In `taskbar.html` and `window-menu.html`, wire useful existing actions and disable unsupported ones. File can offer Open/Close; Help can explain navigation; document menus can offer Copy Link and Print. Do not add editable-file commands to read-only public content.
6. **P2 / M: Shared menu and keyboard behavior.** Add arrow navigation, Enter activation, Escape dismissal, submenu focus management, and mnemonics where browser delivery permits. Add title-icon system menus and focused desktop/file context menus. Restore focus to the invoking control on dismissal.
7. **P2 / M: Improve taskbar behavior.** Add state-aware context actions and deterministic overflow with many windows. Use existing window actions instead of creating a second state model.

Acceptance: every enabled command performs its named action; menus work with mouse and keyboard; unavailable actions are visibly disabled; ten open windows do not obscure Start or the clock. Preserve browser shortcuts and article text selection.

### Phase 3 — Explorer and useful applications

8. **P2 / M: Complete Explorer views.** Add Small Icons, correct List flow, and align view naming and selected-state indicators. Update `view-menu.html`, `40-explorer.css`, `core/explorer.mjs`, and persisted state normalization as needed. Preserve existing saved views.
9. **P2 / L: Distinguish Open and Explore.** Introduce one-pane My Computer/folder presentation and a two-pane Explore command without disrupting independent instances, navigation history, or URL ownership. This has more architectural risk than cosmetic work and should be a separate change.
10. **P2 / L: Implement Find and Documents.** Provide a period-style Find dialog searching post titles first, with real result links. Add a bounded local recent-documents list to Start. Route Settings to the existing Date/Time dialog and any implemented display options.

Acceptance: all four views navigate the same contents; multiple Explorer windows retain independent view and location state; old local storage restores correctly; recent documents and search open canonical pages.

### Phase 4 — Optional polish

11. **P3 / M: Refine app identity.** Give the article viewer a restrained WordPad-inspired frame while keeping readable body text, code copying, and modern document semantics. Audit RSS, Run, About, Date/Time, and device-error dialogs for consistent button metrics and focus handling.
12. **P3 / M–L: Add selected desktop extras only if useful.** Consider Cascade/Tile, a desktop Recycle Bin presentation, or a playful site-only Shut Down dialog with an obvious return path. Boot sequences, sounds, and fake filesystem operations are low priority and should never obstruct reading.

## Guardrails and validation

- Keep responsive full-screen windows and single-tap opening on phones. They are deliberate web accommodations, not fidelity failures. Do not force 11px article text or desktop-size hit targets onto mobile.
- Preserve server-rendered deep links, browser Back/Forward, canonical URLs, and the documented maximized-window URL ownership rule.
- Review at 1280 × 720 and 1024 × 768 for desktop, 390 × 844 for mobile, and 200% browser zoom. Use a fresh profile plus restored-state cases; do not clear a reader's saved desktop to test.
- Exercise opening two Explorers, navigating independently, selecting files, moving/resizing windows, minimize/restore, menus, article scrolling, copying text, and dialog focus return. Check Chromium, Firefox, and Safari for typography/control fallbacks.
- Add focused automated tests for changed selection, menu, view, and state-migration behavior. After implementation, run `./scripts/verify-site.sh` and visually compare the reference states. Cosmetic-only adjustments need screenshot inspection rather than tests duplicating CSS values.

Recommended first delivery: Phase 1 plus the Phase 2 command audit. This would remove the most noticeable breaks in the illusion without expanding the desktop into a full operating-system emulator.
