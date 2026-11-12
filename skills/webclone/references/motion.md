# Motion: measure the source, then rebuild it

In a clone, motion values come from the source, not from taste. Measure first; fall back to the defaults below only for values you cannot measure, and mark those as estimates.

> Adapted from `animate` by Emil Kowalski (MIT), `gsap-react` by GreenSock (MIT), and `ui-animation` by Matthew Blode (MIT), as curated in nexu-io/open-design. See THIRD_PARTY_NOTICES.md.

## 1. Measure

```bash
node <scripts>/motion-probe.mjs --url <source> --out docs/research/<site>/recon/motion --label original
```

It samples the page at 0/25/50/75/100% scroll and records:

- `document.getAnimations()`: every running CSS animation, CSS transition, and WAAPI animation with duration, delay, easing, iterations, keyframes, and target.
- Computed `transition` on visible elements (property, duration, timing function, delay).
- GSAP version and timeline children (duration, delay, ease, stagger, targets); `ScrollTrigger.getAll()` (trigger, start, end, scrub, pin, snap, toggleActions).
- Lenis options (`lerp`, `duration`, `wheelMultiplier`, `smoothWheel`...) or its `html.lenis` class; Locomotive; `scroll-behavior`; scroll-snap containers; sticky/fixed elements.
- `@keyframes` rules from readable stylesheets.

Then exercise states the probe cannot reach (hover, open menus, tabs) with a browser tool or `interaction-probe.mjs`, and read `getAnimations()` again in that state.

Checklist per animated element. Most of the "magic" hides in properties people forget: opacity and blur often lead the move.

| Property | What to record |
|---|---|
| Translate | start/end offset, axis, units (% of self vs px) |
| Scale | per axis; never assume uniform |
| Opacity / blur | start/end and whether they lead or trail the move |
| Radius / shadow / color | start/end |
| Timing | duration, delay, stagger, easing curve or spring config |
| Driver | time, scroll position (start/end/scrub/pin), hover, click, pointer |
| Reverse | does it replay on scroll up? does exit mirror entry? |

When nothing can be read (canvas, video, closed-source runtime), record a short screen capture, step through frames, and mark the values `GUESS` (see effect-extraction.md).

## 2. Pick the cheapest tool that reproduces it

| Source behavior | Tool in the clone |
|---|---|
| Hover/press/color/class toggle | CSS `transition` with the measured property, duration, and curve |
| Mount entrance, no JS state | CSS `@starting-style` or a keyframe animation |
| Looping/predetermined motion | CSS `@keyframes` (runs off the main thread) |
| Programmatic, no library | WAAPI `element.animate()` |
| Springs, layout/exit animation, gestures | Motion (`motion/react`) |
| Source uses GSAP timelines or ScrollTrigger | GSAP + `@gsap/react` with the measured `start`/`end`/`scrub`/`pin` |
| Source uses Lenis | `lenis` with the measured options (do not substitute native smooth scroll) |
| Scroll-linked reveal without a library | IntersectionObserver + CSS classes, matching the source threshold |

Match the source library when it carries behavior that is hard to reproduce otherwise (ScrollTrigger pinning and scrub, Lenis inertia). Do not add a library the source does not need.

## 3. Implementation rules (Next.js)

- Animation code lives in `"use client"` components. Never call `gsap`, `ScrollTrigger`, or `new Lenis()` during server render.
- GSAP: `gsap.registerPlugin(useGSAP, ScrollTrigger)` once; use `useGSAP(() => {...}, { scope: containerRef })` so selectors stay scoped and cleanup (tweens and ScrollTriggers) runs on unmount. Wrap handlers created later in `contextSafe`. Without `@gsap/react`: `gsap.context(fn, ref)` in `useEffect` and `return () => ctx.revert()`.
- Lenis: create it in one client provider at the layout level, drive it from `requestAnimationFrame` (or `gsap.ticker` when ScrollTrigger is present, calling `ScrollTrigger.update` on Lenis scroll), and destroy it on unmount.
- Animate `transform` and `opacity` (plus `clip-path`) when the source allows; layout properties trigger reflow. If the source animates `height`/`width`, reproduce it but check for jank.
- In Motion, prefer `transform: "translateX(...)"` strings over `x`/`y` shorthands for hardware acceleration under load.
- Popovers/dropdowns scale from their trigger (`transform-origin`); modals stay centered.
- Rapidly re-triggered UI (toasts, toggles) uses transitions, not keyframes, so it retargets from the current value.
- Exit the way it entered unless the source does otherwise.
- `prefers-reduced-motion: reduce`: keep opacity/color changes, drop movement. Gate hover-only effects with `@media (hover: hover) and (pointer: fine)`.

## 4. Defaults only when the source cannot be measured

Easing:

| Situation | Easing |
|---|---|
| Entering / exiting | ease-out: `cubic-bezier(0.23, 1, 0.32, 1)` |
| Moving on screen | ease-in-out: `cubic-bezier(0.77, 0, 0.175, 1)` |
| Drawer / sheet | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Hover / color | `ease` |
| Constant (marquee, progress) | `linear` |

Never `ease-in` for UI entrances. Never `scale(0)`; start from `scale(0.9-0.97)` with `opacity: 0`.

Duration:

| Element | Duration |
|---|---|
| Button press | 100-160ms |
| Tooltip / small popover | 125-200ms |
| Dropdown / select | 150-250ms |
| Modal / drawer | 200-500ms |
| Marketing reveal | longer, as measured |

Spring: `{ type: "spring", duration: 0.5, bounce: 0.2 }`; keep bounce 0.1-0.3.

## 5. Verify

Run `motion-probe.mjs` against the local route with `--label clone` and compare the two JSON files: same easing strings, durations within ~10%, same ScrollTrigger start/end/pin, same Lenis options. Compare initial, mid, and settled states at matching scroll positions, including reverse scroll. Test controls during motion and navigate away and back to catch stuck states.
