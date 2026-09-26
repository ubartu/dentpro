# Design references

The user supplied these Figma Community copies for the patient app redesign:

- [Login / Register kit](https://www.figma.com/design/F58xlg6wkBPs3lbp3ogoDn/20-Screen-Login---Register-Mobile-App--Community-?node-id=2-2): Login Version 1 (`3:5123`) and its registration screen (`37:827`). White background, prominent Inter heading, outlined fields, gradient primary action and simple registration switch.
- [Meditation app UI](https://www.figma.com/design/xySgQlByttG0EyFWGM3yWv/Meditation-app-UI--Community-?node-id=1-2): Home (`1:2`), especially cards (`1:6`, `1:175`) and the continuation banner (`1:159`). Spacing, illustrated cards, pill actions and selected navigation treatment are adapted to dental case management in blue tones.

Local PNG exports from the second file:

| File | Figma node | Export size |
| --- | --- | --- |
| `care-illustration.png` | `1:8` | 177 × 210 |
| `relax-illustration.png` | `1:177` | 177 × 210 |
| `banner-pattern.png` | `1:161` | 374 × 95 |

These are the original exports, not redrawn artwork. The native UI uses blend compositing and opacity over blue cards. Their resolution reflects the available exports. File access does not establish redistribution rights; the upstream Community terms govern the reference artwork.

The current DENTpro tooth logo was supplied separately from these Figma references. Its original is stored at `assets/dentpro-logo-original.jpeg`; square adaptations are stored at `assets/dentpro-brand-square.png` and `assets/dentpro-brand-adaptive.png`. `src/components/logo-mark.tsx` renders the square logo and rotates it only during loading, pausing in the background and respecting the device's reduced-motion preference. The older `brand-mark.svg` and related PNGs remain as unused historical assets.

The source templates' unrelated meditation content and unconnected social authentication/password recovery controls are not included. All visible patient actions connect to DENTpro's existing workflows.
