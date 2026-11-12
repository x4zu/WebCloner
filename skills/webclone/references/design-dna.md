# Design DNA: a structured design identity

Turns "make it feel like that site" into a versionable, reusable, comparable JSON spec. Used by `/webclone-brand` (extract) and `/webclone-remix` (keep the DNA, swap the content), and by `/webclone` in visual mode.

> Method and schema adapted from [zanwei/design-dna](https://github.com/zanwei/design-dna) (MIT), via the `web-clone` skill by Jane (@xiaoerzhan, MIT).

## When to use it

DNA describes a style, so it produces "a new site in the same style", not a byte-for-byte copy. That is the opposite direction from a faithful clone.

| Mode | DNA? |
|---|---|
| Faithful clone (real source, single-file native site, byte-exact WebGL) | **No.** The real source is the truth; DNA would dilute it into an approximation |
| Visual clone (same look, simplified implementation) | **Yes.** DNA is the main artifact |
| Remix (keep information architecture, rhythm, and visual grammar; swap in the user's content) | **Yes.** DNA defines what to keep |

## Three layers

1. **`design_system`**: measurable tokens (color, typography, spacing, layout, shape, elevation, iconography, motion, components). Becomes CSS custom properties / Tailwind `@theme` tokens.
2. **`design_style`**: perceived qualities (aesthetic, visual language, composition, imagery, interaction feel, brand voice in UI). Guides subjective decisions.
3. **`visual_effects`**: rendering beyond ordinary CSS (background, particles, 3D, shaders, scroll, text, cursor, image, glass/neumorphism, canvas, SVG). Decides whether Canvas/WebGL/GSAP is needed.

## Workflow

1. **Structure**: start from the skeleton (`dna-scaffold.mjs`) and drop irrelevant dimensions.
2. **Analyze** from recon output:
   - Colors: `rootVariables` and `palette` (computed backgroundColor/color/borderColor per region) in `<label>-recon.json`. Primary by area, accent by CTA usage.
   - Fonts: `fonts` + `fontFaces` + section `fontFamily`, split into heading/body/mono.
   - Spacing/layout: screenshots + section rects for rhythm and max width.
   - Effects: `frameworks.three/gsap/lenis`, canvas counts, `motion` signals -> `visual_effects.overview.primary_technology` and the `enabled` flags.
   - Style: judge mood, genre, composition, and whitespace from the 1440/768/390 screenshots.
   - Fill every field. If evidence is missing, write `TODO: <what evidence is needed>` instead of an empty string.
3. **Generate**: DNA -> CSS custom properties -> subjective decisions from `design_style` -> implementation tier from `effect_intensity` (lightweight = CSS/SVG/vanilla; medium = Canvas 2D/GSAP/Lottie; heavy = Three.js/GLSL/Pixi) -> page -> user's content. Prefer the source's real images (via `asset-harvest.mjs`) over AI-redrawn approximations when the user is allowed to use them.

## Scaffold

```bash
node <scripts>/dna-scaffold.mjs \
  --recon docs/research/<site>/recon/original-recon.json \
  --out   docs/research/<site>/design-dna.json \
  --name  "<site name>"
```

Prefills fonts, CSS color variables, and framework/effect signals; everything else stays `""` for analysis. Runs without `--recon` too (empty skeleton).

## Full schema

```json
{
  "meta": { "name": "", "description": "", "source_references": "", "created_at": "" },

  "design_system": {
    "color": {
      "palette_type": "monochromatic | complementary | analogous | triadic | split-complementary",
      "primary":   { "hex": "", "role": "" },
      "secondary": { "hex": "", "role": "" },
      "accent":    { "hex": "", "role": "" },
      "neutral":   { "scale": "", "usage": "" },
      "semantic":  { "success": "", "warning": "", "error": "", "info": "" },
      "surface":   { "background": "", "card": "", "elevated": "" },
      "contrast_strategy": "high contrast | subtle layers | dark-on-light dominant"
    },
    "typography": {
      "type_scale": {
        "display":    { "size": "", "weight": "", "line_height": "", "tracking": "" },
        "heading_1":  { "size": "", "weight": "", "line_height": "", "tracking": "" },
        "heading_2":  { "size": "", "weight": "", "line_height": "", "tracking": "" },
        "heading_3":  { "size": "", "weight": "", "line_height": "", "tracking": "" },
        "body":       { "size": "", "weight": "", "line_height": "", "tracking": "" },
        "body_small": { "size": "", "weight": "", "line_height": "", "tracking": "" },
        "caption":    { "size": "", "weight": "", "line_height": "", "tracking": "" },
        "overline":   { "size": "", "weight": "", "line_height": "", "tracking": "" }
      },
      "font_families": { "heading": "", "body": "", "mono": "" },
      "font_style_notes": ""
    },
    "spacing": { "base_unit": "", "scale": "", "content_density": "compact | comfortable | spacious", "section_rhythm": "" },
    "layout":  { "grid_system": "", "max_content_width": "", "columns": "", "gutter": "", "breakpoints": "", "alignment_tendency": "strict grid | centered | asymmetric | mixed" },
    "shape":   { "border_radius": { "small": "", "medium": "", "large": "", "pill": "" }, "border_usage": "none | subtle 1px | bold borders | only on inputs", "divider_style": "" },
    "elevation": { "shadow_style": "none | soft diffused | hard drop | layered", "levels": { "low": "", "medium": "", "high": "" }, "depth_cues": "shadows | overlapping layers | blur/glass | color intensity" },
    "iconography": { "style": "", "stroke_weight": "", "size_scale": "", "preferred_set": "" },
    "motion": { "easing": "", "duration_scale": { "micro": "", "normal": "", "macro": "" }, "entrance_pattern": "", "exit_pattern": "", "philosophy": "minimal functional | playful bouncy | cinematic | none" },
    "components": { "button_style": "", "input_style": "", "card_style": "", "navigation_pattern": "", "modal_style": "", "list_style": "", "component_notes": "" }
  },

  "design_style": {
    "aesthetic": { "mood": [], "visual_metaphor": "", "era_influence": "", "genre": "", "personality_traits": [], "adjectives": [] },
    "visual_language": { "complexity": "minimal | moderate | rich | maximal", "ornamentation": "none | subtle accents | decorative | heavily ornamented", "whitespace_usage": "", "visual_weight_distribution": "", "focal_strategy": "single hero element | distributed interest | progressive reveal", "contrast_level": "", "texture_usage": "" },
    "composition": { "hierarchy_method": "scale contrast | color weight | spatial isolation | typographic hierarchy", "balance_type": "symmetric | asymmetric | radial | mosaic", "flow_direction": "", "grouping_strategy": "", "negative_space_role": "" },
    "imagery": { "photo_treatment": "", "illustration_style": "", "graphic_elements": "", "pattern_usage": "", "image_shape": "" },
    "interaction_feel": { "feedback_style": "", "hover_behavior": "", "transition_personality": "snappy | smooth glide | bouncy elastic | fade-subtle", "loading_style": "", "microinteraction_density": "" },
    "brand_voice_in_ui": { "tone": "", "formality": "", "cta_style": "direct imperative | friendly invitation | urgent scarcity | subtle suggestion", "empty_state_approach": "", "error_tone": "" }
  },

  "visual_effects": {
    "overview": { "effect_intensity": "none | subtle-accent | moderate | heavy-immersive", "performance_tier": "lightweight | medium | heavy", "fallback_strategy": "", "primary_technology": "CSS only | Canvas 2D | WebGL/Three.js | GSAP | Lottie | SVG SMIL | Pixi.js" },
    "background_effects": { "type": "gradient-animation | noise-field | mesh-gradient | video-bg | generative-art | none", "description": "", "technology": "", "params": { "color_palette": "", "speed": "", "density": "", "opacity": "", "blend_mode": "" } },
    "particle_systems": { "enabled": false, "type": "floating-dots | confetti | snow | fireflies | connected-nodes | custom", "description": "", "technology": "", "params": { "count": "", "shape": "", "size_range": "", "movement_pattern": "", "color_behavior": "", "interaction": "mouse-repel | mouse-attract | click-burst | none", "spawn_area": "" } },
    "3d_elements": { "enabled": false, "type": "hero-model | product-viewer | scene-bg | text-extrusion | abstract-geometry", "description": "", "technology": "", "params": { "renderer": "", "lighting": "", "camera": "", "materials": "", "geometry": "", "post_processing": [], "interaction_model": "" } },
    "shader_effects": { "enabled": false, "type": "noise-distortion | wave | morph | color-shift | custom-GLSL", "description": "", "technology": "", "params": { "uniforms": "", "vertex_manipulation": "", "fragment_output": "", "noise_type": "perlin | simplex | worley | fbm", "distortion": "" } },
    "scroll_effects": { "parallax": { "enabled": false, "layers": "", "depth_range": "", "speed_curve": "" }, "scroll_triggered_animations": { "enabled": false, "trigger_points": "", "animation_type": "fade-up | scale-in | clip-reveal | counter | draw-SVG", "scrub_behavior": "" }, "scroll_morphing": { "enabled": false, "description": "" } },
    "text_effects": { "type": "split-letter-animate | typewriter | glitch | gradient-fill | 3d-extrude | none", "description": "", "technology": "", "params": { "split_strategy": "by-char | by-word | by-line", "animation_per_unit": "", "stagger": "", "effect_style": "" } },
    "cursor_effects": { "enabled": false, "type": "custom-cursor | magnetic-buttons | spotlight | trail | none", "description": "", "params": { "shape": "", "size": "", "blend_mode": "", "trail": "", "interaction_zone": "" } },
    "image_effects": { "type": "hover-distortion | reveal-clip | parallax-tilt | rgb-shift | none", "description": "", "technology": "", "params": { "filter_pipeline": "", "hover_transform": "", "reveal_animation": "", "distortion_type": "barrel | wave | liquid | glitch" } },
    "glassmorphism_neumorphism": { "enabled": false, "style": "glass | neumorphic-light | neumorphic-dark | frosted-layers | none", "params": { "blur_radius": "", "transparency": "", "border_treatment": "", "shadow_type": "", "light_source_angle": "" } },
    "canvas_drawings": { "enabled": false, "type": "generative-lines | interactive-blobs | data-visualization | pattern-fill | none", "description": "", "technology": "", "params": { "draw_method": "", "animation_loop": "", "color_scheme": "", "responsiveness": "", "interaction": "" } },
    "svg_animations": { "enabled": false, "type": "path-draw | morph-shapes | logo-reveal | decorative-loop | none", "description": "", "params": { "animation_method": "", "path_morphing": "", "stroke_animation": "", "filter_effects": "" } },
    "composite_notes": ""
  }
}
```

## Division of labor with WebGL reverse-engineering

For sites marked `heavy-immersive`, `WebGL/Three.js`, or `shader_effects.enabled = true`, do not use DNA to approximate the effect. That belongs to [effect-extraction.md](effect-extraction.md) and [reverse-engineering.md](reverse-engineering.md). DNA covers only the design layer outside the effect (color, type, layout, ordinary motion).
