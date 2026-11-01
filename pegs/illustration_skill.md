# Illustration Skill — Aruga Hand-Drawn Peg

> Use this file as the peg when generating similar illustrations. It captures the exact prompt and reasoning used for `public/pegs/understanding-videos-inspired.svg` (two-character inspired illustration).

## Source Peg References
- Primary visual vibe: `pegs/d538b8cbd80907d5c8c94109838b8bf6.jpg` (20 kids in animal costumes, flat crayon, bold outlines, dotted textures)
- Secondary vibe: `pegs/furry.png` (single fluffy dotted outline, pink face)
- Output peg: `public/pegs/understanding-videos-inspired.svg` (restored two-character version)

## Design Tokens
- **Canvas:** `viewBox 0 0 600 360`, transparent background (`fill="none"`), corner `rx=24`
- **Outline:** `#111`, `stroke-width 4-6`, `linecap round`, `linejoin round`
- **Palette:** Crayon flat — `#FF8FAB` (bunny pink), `#FFE66D` (face yellow), `#FF9F1C` (lion orange), `#FFD93D` (mane/sparkle), `#E8F0FF` (video inner), `#14b8a6` / `#0284c7` (dashed insight boxes), `#4D96FF` / `#FF6B6B` / `#6BCB77` (bg dots at 0.08 opacity)
- **Texture cues:** subtle bg dots, sparkle stars, dashed boxes `stroke-dasharray 6 4`
- **Typography in image:** None — no text inside illustration (text lives in card UI outside SVG)
- **Background inside image:** Transparent; video frame is white (`fill white`) but outer canvas is transparent so it blends on black breaker

## Prompt Used
```
Two kids in cute animal costumes (one pink bunny with long ears, one orange lion with yellow mane) standing inside a simple white video frame with thick black outline. Flat crayon illustration, bold black outlines, dotted textures, soft pastel palette matching d538 peg. Each has a small round face (pale yellow/pink), tiny dot eyes, simple smile, no glasses, no text. Overlay two dashed rounded rectangles as AI insight boxes (teal and blue). Add two small sparkle stars. Transparent outer background. Playful, hand-drawn, child-friendly, easy to understand.
```

## Reasoning Used
1. **Inspired, not copied:** Did not trace the peg; recreated the *language* — thick outlines, flat fills, costume animals, dotted outline texture, crayon palette — with original shapes via SVG paths.
2. **No text, no background:** Kept illustration transparent so the black breaker shows through; moved all copy to the card outside the image for readability and i18n.
3. **Concept first:** Characters represent “understanding videos” — two kids doing a tabletop task inside a video frame, with dashed boxes hinting that AI spots key moments, aligning with the card copy `AI spots key moments so you can give quick, clear feedback.`
4. **Two characters to show range:** Bunny + lion give variety (like the 20-character peg) but limited to two to stay uncluttered and readable at card size; lion adds warm contrast to bunny pink.
5. **Video frame as context:** Thick white frame with rounded `rx 18` and inner `E8F0FF` area signals “video” without extra icons; keeps composition centered (`x 140 y 60 w 320 h 200`).
6. **Simple construction:** Each costume is one path for body + ears/mane, face is circle + smile path + dot eyes — scalable, recolorable via `fill` swaps for future variants (e.g., swap lion for crocodile green, keep same construction).
7. **Sizing:** `h-40 sm:h-48 scale-110` in the card enlarges the 600×360 art to fill the card without cropping; no extra background keeps file tiny and crisp.

## How to Generate Similar Illustrations
1. Copy this file and `public/pegs/understanding-videos-inspired.svg` as your starting peg.
2. Swap costume color/fill and ear/mane shape for a new animal (e.g., green crocodile, blue cat, sheep white) — keep same stroke, face pattern, and video-frame scaffold.
3. Keep two characters max, transparent outer, no text, dashed insight box if the concept needs “AI sees”.
4. Export as SVG with same tokens; place in `public/pegs/<name>-inspired.svg` and reference with `h-40 sm:h-48 object-contain scale-110` and `bg-transparent`.

## Second Illustration — Performance Tracking
- **File:** `public/pegs/performance-tracking-inspired.svg` (transparent, no text)
- **Prompt:** `Hand-drawn crayon chart with 4 growing bars (yellow, green, blue, pink) inside white panel with thick black outline, dotted trend line with white dots, small pink bunny character climbing near the chart, tiny goal flag at the end, two sparkle stars, flat crayon palette, bold outlines, no text, transparent outer`
- **Reasoning:** Kept same tokens (white panel `#111` outline, `E8F0FF` inner, bar fills from peg palette, dashed line `8 6`), added goal flag to signal clinician's goal, kept bunny character to link the two cards visually, no text/bg.

## Third Illustration — Activity Sheets
- **File:** `public/pegs/activity-sheets-inspired.svg` (transparent, no text)
- **Prompt:** `Stack of 3 white activity sheets with thick black outline, dotted gray lines inside, simple shapes (yellow circle, green rectangle, blue triangle) and a small yellow bunny peek, two sparkle stars, flat crayon palette, bold outlines, no text, transparent outer`
- **Reasoning:** Used stacked panels to convey “tailored” and “made for you”, kept same line weight and palette, added peek character for human link, no text/bg to stay clean.

## OT / PT / SP Illustrations — Human-like
- **Files:** `public/pegs/ot-inspired.svg` (table stacking), `public/pegs/pt-inspired.svg` (balance on mat), `public/pegs/sp-inspired.svg` (speech bubble with waveform)
- **Prompt:** `Single child character in crayon animal costume (bunny/cat/lion) doing a simple task: OT stacking blocks on a yellow table, PT balancing on a mat with arms out, SP speaking with a speech bubble and waveform. Flat crayon, thick black outline, pastel fills (#FFD93D, #FF8FAB, #4D96FF, #FFE66D), no text, transparent background, playful human illustration`
- **Reasoning:** Replaced lucide icons with the same hand-drawn token set; each scene is one human action that instantly reads as OT/PT/Speech, no background, kept 200×160 viewBox, thick outlines for legibility at 80×64px.

## Verification
- `npx tsc --noEmit` clean after referencing `public/pegs/understanding-videos-inspired.svg` in `src/app/page.tsx:351`
