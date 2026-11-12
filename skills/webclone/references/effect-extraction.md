# Effect extraction: evidence discipline and the baseline gate

[reverse-engineering.md](reverse-engineering.md) explains how to read a rendering architecture. This file explains how not to fool yourself while reverse-engineering an effect, and what to do when no real source exists. Three rules: **evidence grading, no compensation, baseline first.**

> The discipline is inspired by the method behind `web-shader-extractor` (github.com/lixiaolin94/skills). That repository has no license, so only the concepts are used here, rewritten from scratch.

## 1. Grade every conclusion

In `TEARDOWN.md`, tag every key fact about the rendering pipeline. Untagged means the lowest grade.

| Tag | Meaning | Examples |
|---|---|---|
| `SOURCE` | Direct, target-bound hard evidence | Public source lines, source-map modules, runtime object dumps, captured shader/WGSL text, frame captures, hashed network bodies |
| `PARTIAL` | A handle for the next probe, not a conclusion | Class/function/field names, minified bundle slices, framework objects, a shader without its uniforms/passes/inputs |
| `GUESS` | Reconstructed without direct evidence | Visual fitting, name-based inference, default values, hand-tuned magic numbers, anything that "looks right" |

- Untagged = `GUESS`. Never let unproven items mix with "known" ones.
- Any `GUESS` implementation must be upgraded to `SOURCE` before it is copied into the clone.
- Second-hand analyses (including AI-written teardowns) are concept sketches at best; their executable code is `GUESS` by default. Verify every line against real source.

## 2. No compensation

Never tweak brightness, speed, position, or noise to make output "look right" while hiding a real error in timing, color, FBOs, assets, coordinate systems, or state.

- A fitted constant that makes output closer is still `GUESS`; record what evidence would upgrade it.
- Wiring facts (pass order, coordinate transforms, time units, input coupling) are not proven by a similar picture. Trace each one to evidence.
- Record what you cannot verify. Never claim "drag works" when synthetic input could not trigger it.

## 3. Baseline-first gate

The common failure is rewriting, refactoring, and beautifying at once until the result neither matches nor explains itself. Gate the work:

```
locate render surface -> capture minimal truth -> RAW REPLAY -> BASELINE frame comparison passes
                                                                   | only then
                                                             PROJECTIZE (editable code) -> integrate
```

- **RAW REPLAY**: the smallest possible runnable reproduction using the captured draw calls, shaders, uniforms, and vertex data. No optimizing, no framework swap, no parameter changes.
- **BASELINE gate**: the replay must match the source frame by frame (or across sampled frames). No refactoring before it passes.
- **PROJECTIZE**: rewrite into maintainable code (raw WebGL, Three.js, R3F) inside a client component, keeping evidence tags.
- Finish in one honest state: `DONE_BASELINE_VERIFIED`, `DONE_PROJECTIZED`, or `DONE_BASELINE_WITH_GAPS` (gaps recorded).

## 4. No source: capture runtime truth

When GitHub and source maps give nothing, do not fall back to "write what it looks like" (that is `GUESS`). Capture at the rendering boundary:

- Intercept the WebGL/WebGPU context: draw calls, bound programs, compiled shader source (`getShaderSource`), uniform values, FBO/texture sizes, blend/depth state.
- Techniques: Spector.js-style frame capture, patching `WebGLRenderingContext.prototype` from an init script that runs before page scripts, recording calls per frame.
- What you capture is `SOURCE`. It becomes the new "real source" for the baseline gate.

## Where artifacts go

- `docs/research/<site>/TEARDOWN.md`: technical teardown with evidence tags and a table that checks second-hand claims.
- `docs/research/<site>/baseline/`: the raw replay plus its comparison screenshots.
