# Reverse-engineering WebGL/Canvas-heavy sites

Use when recon shows a WebGL/Canvas/Three.js front end: `window.THREE` exists, several `<canvas>` elements, or `<script type="x-shader/*">`. Pair with [effect-extraction.md](effect-extraction.md) for evidence discipline.

## Teardown steps

1. **Get single-file source first.** Many demo sites are one self-contained HTML file (GitHub raw or view-source). Read it before scripting the browser.
2. **Count canvases, read SVG defs, grep shaders.** How many `<canvas>`? Any `<filter>`? Where are the shaders? These three decide the architecture.
3. **Decide what the GPU computes.** This decides whether a second-hand analysis can be trusted:
   - `texture2D` / `sampler2D` -> sampling textures or framebuffers
   - a loop with `+= dS` / `map(` / `MAX_STEPS` -> ray marching
   - `b*b` discriminant / `sqrt(` with a quadratic -> **analytic intersection** (closed form, common for spheres/planes)
   - Never assume ray marching by instinct; refractive glass demos are often analytic sphere intersection.
4. **Find the GPU-to-DOM bridge.** If the WebGL canvas is not shown directly but goes through `toDataURL`, `<feImage>`, or `feDisplacementMap`, it is producing a data map (displacement/normal/depth) for another layer. This advanced technique is the layer second-hand analyses most often get backwards.
5. **Read physics/audio separately.** They are usually plain JS modules decoupled from rendering and can be verified alone.

## Reusable advanced patterns

- **Displacement map refracting the DOM**: off-screen WebGL renders a PNG where RG = displacement and B = an auxiliary value; SVG `<feDisplacementMap scale=N>` uses it to distort real HTML. GPU and SVG `scale` must match. This gives liquid glass, magnifiers, and ripples over a live, interactive page, which `MeshPhysicalMaterial(transmission)` cannot do.
- **One shader + a mode uniform**: refraction/reflection/shadow/foreground share one fragment shader, branching on `u_mode`.
- **Low-resolution helper maps + idle frame skipping**: displacement/reflection/shadow maps render at 1/2 or 1/4 resolution; rendering stops when objects settle.
- **One oversized triangle instead of a quad**: vertices `[-1,-1, 3,-1, -1,3]` cover the screen.

## Choosing the clone path

- **1:1 possible and the license allows it**: use the real source and change copy/colors/parameters. Keeping a single-file native site byte for byte is the most faithful clone.
- **Approximate effect is fine**: start from a similar open-source template. Swapping implementations often loses the site's defining mechanism; confirm that mechanism is not what the user wants.
- **Site-specific math must be rewritten when ported**: changing the shape changes the intersection formula; refractive index, Fresnel, and absorption constants need retuning for a new material.

## In a Next.js clone

Put the effect in a `"use client"` component that owns its canvas, creates the context in `useEffect`, and cleans up (cancel `requestAnimationFrame`, lose the context, remove listeners) on unmount. Load shader text as string modules or inline template strings. Keep the original constants with their evidence tags.

## Verification (required)

Start the dev server, open the page in a browser, read the console (no JS or shader compile errors), and compare screenshots with the source. Record what cannot be verified: synthetic `PointerEvent`s have `isTrusted=false` and may not trigger drag hit-testing, so say so instead of claiming it works. Two loads with different initial states can show indirectly that a physics engine runs.
