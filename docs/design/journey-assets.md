# Journey illustration assets

Generated with the built-in `image_gen` tool. Both selected outputs are saved in the mobile project:

- `apps/mobile/assets/art/journey-landscape-v2.png`
- `apps/mobile/assets/art/journey-mascot-v2.png` (transparent background)

The road, milestones, avatars, labels, status and actions are rendered by the application using live journey data.

## Landscape prompt

```text
Use case: illustration-story. Asset type: portrait mobile app background, 1024x1792 or similar tall ratio. Generate a beautiful softly rendered 3D illustration landscape for the Dike green ride-sharing app. Match the user's latest reference image's scenery: pale cyan-white sky in top 22%, layered rolling mint and sage green hills, a small distant turquoise modern Vietnamese coastal city skyline on the upper right at about 26% height, small sun at horizon, soft white clouds, subtle birds. Middle 65% is mostly open very pale mint and warm ivory rolling hills suitable for readable app UI overlays. Soft rounded lush bushes on extreme left and right edges and bottom corners, a few large botanical leaves, gentle sunlight glow. Premium polished friendly ecological travel illustration, delicate airy pastel palette #087d61 accents, mint #e8f6ed and pale cream #fff9e5. IMPORTANT: no text, no letters, no logos, no roads or paths (road will be drawn in code), no cards, no circles, no interface, no avatars, no mascots, no people. Keep center broad and quiet, detailed scenery mostly at top horizon and outer edges. This is a NEW illustration using the latest attached reference only as visual style/composition reference, not a screenshot to reproduce.
```

## Mascot prompt

Reference/edit target: `apps/web/public/images/green ride duck.png`.

```text
Background-extraction edit. Isolate ONLY the existing cute white Dike duck wearing its teal helmet and backpack riding its mint green scooter, together with the three small yellow excitement rays. Preserve the duck, helmet, scooter, pose, face, colors and 3D illustration style exactly. Remove ALL road, city, buildings, trees, bushes, leaves and scenery. True transparent alpha background. Tight portrait crop around full scooter and duck with small breathing room. This is an app illustration asset, no added text or interface.
```
