# Phase 1 visual baseline

Implemented 6 September 2026. Target: original Windows 95 shell, with readable
web documents and a separate compact layout.

## Reference

[Windows 95 desktop with applications](https://guidebookgallery.org/pics/gui/desktop/full/win95.png),
from [GUIdebook's Windows 95 screenshots](https://guidebookgallery.org/screenshots/win95/),
is the visual reference inspected for this pass. It is a 640 × 480 screenshot
showing desktop labels, Start and cascading menus, inactive title bars, a setup
dialog, Control Panel, and taskbar buttons. The screenshot's flat gray Start
rail, bold Windows/regular 95 branding, compact menus, unshadowed labels, and
small framed buttons guide this implementation.

The existing site's desktop, Explorer, Start menu, article, and RSS wizard were
also inspected in the review and implementation sessions at 1280 × 720. The
original Explorer used 15px menu/list/status text against an 11–12px taskbar and
title bar. The new shared scale eliminates that mismatch. This is a visual
approximation, not a claim of pixel-identical Windows rendering.

## Chosen metrics

| Element | Desktop baseline |
| --- | --- |
| UI font | Local W95FA Regular, 12px, bold synthesized for titles |
| Document body | Existing Georgia/Times stack, 16px |
| List/menu row | 20px minimum |
| Title bar | 20px minimum |
| Dialog button | 23px |
| Window controls | 16 × 14px with 10 × 10px pixel glyphs |
| Small/large shell icons | 16 × 16px / 32 × 32px |
| Desktop shortcut defaults | 76px vertical pitch; saved positions retained |
| Frame / common gap | 3px / 4px |
| Taskbar | Existing 30px plus safe area |

ICO directory inspection found native 16px and 32px frames in 23 of 24 runtime
icons. The remaining single-frame icon uses browser scaling when displayed small.
No runtime ICOs were rewritten. Photos and document screenshots no longer
inherit pixelated scaling; explicitly styled period artwork retains it.

## Behavior and compatibility

- Single selection is scoped to each desktop/list. Pointer movement never selects.
- Single desktop clicks select; double-click and Enter open; Space selects.
- Compact mode retains single-tap opening and larger controls. Assistive synthetic
  click activation is supported without demanding a double-click.
- Selected labels remain navy; inactive-window selections are gray. Keyboard
  focus uses a separate dotted outline. Selection is not stored across reloads.
- Window glyphs use CSS SVG masks and state classes, independent of text fonts.
  Window contract version 3 prevents mixing older text-glyph fragments and new
  bindings during deployment. The persisted OS-state schema is unchanged.
- Blink/WebKit receive beveled scrollbars with arrow buttons; Firefox receives
  native scrollbars with classic colors. Form inputs retain native semantics;
  select dropdowns retain native platform behavior. Forced-colors mode restores
  native checkbox/radio rendering.

## Validation record

- Repository verification passed: unit tests (including seven new selection
  behavior tests), Hugo build, generated JavaScript syntax, links and assets.
- In-app Chromium visual checks: 1280 × 720 desktop, 1024 × 768 desktop,
  390 × 844 compact layout; local font loaded, selected label color verified,
  Space selected without opening, Enter opened once, inactive selection became
  gray, and article text stayed at 16px.
- Start rail, drawn title controls, scrollbars, and RSS feed checkboxes were
  inspected visually. Existing raw-HTML Hugo warnings remain.
- Firefox/Safari, forced-colors mode, and actual browser zoom require a separate
  browser pass; their fallbacks are implemented but not claimed as exercised.
