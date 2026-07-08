---
name: Cinematic Minimalist
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#bbc9cd'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#859397'
  outline-variant: '#3c494c'
  surface-tint: '#2fd9f4'
  primary: '#8aebff'
  on-primary: '#00363e'
  primary-container: '#22d3ee'
  on-primary-container: '#005763'
  inverse-primary: '#006877'
  secondary: '#9dcfda'
  on-secondary: '#00363e'
  secondary-container: '#1b5059'
  on-secondary-container: '#8fc0cc'
  tertiary: '#ffd6a3'
  on-tertiary: '#462b00'
  tertiary-container: '#ffb13b'
  on-tertiary-container: '#6e4600'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#a2eeff'
  primary-fixed-dim: '#2fd9f4'
  on-primary-fixed: '#001f25'
  on-primary-fixed-variant: '#004e5a'
  secondary-fixed: '#b8ebf7'
  secondary-fixed-dim: '#9dcfda'
  on-secondary-fixed: '#001f25'
  on-secondary-fixed-variant: '#184d57'
  tertiary-fixed: '#ffddb5'
  tertiary-fixed-dim: '#ffb957'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#643f00'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.12em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 24px
  gutter: 16px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 32px
---

## Brand & Style

The design system is anchored in the concept of "Cinematic Quietude." It prioritizes the visual impact of film poster art by reducing interface "noise" to near-zero levels. This is a content-forward experience designed for collectors who value a premium, gallery-like atmosphere.

The aesthetic leans heavily into **Minimalism** with subtle **Glassmorphic** touches. By eliminating traditional borders and dividers, the interface feels like a seamless, immersive canvas. The emotional response is one of focus and calm, positioning the app as a high-end tool for curation rather than a cluttered utility.

## Colors

The palette is strictly dark-mode, utilizing a "Near-Black" foundation to ensure maximum contrast with movie artwork. 

- **Foundation:** The background uses a deep neutral (#0B0B0C), while elevated surfaces move slightly lighter (#161617) to create depth without visible lines.
- **Accent:** A cool Cyan is used with extreme restraint. It serves only as a beacon for primary actions, active states, or focus indicators, preventing the interface from feeling "colorful" and keeping the focus on the media.
- **Status:** Semantic colors (Blue, Amber, Red, Orange) are used exclusively for system status badges and are desaturated slightly to prevent them from vibrating against the dark background.

## Typography

This design system utilizes **Inter** for all roles to maintain a clean, systematic, and utilitarian feel that doesn't compete with movie logos or titles.

- **Contrast:** Titles use high-weight (SemiBold/Bold) with tight letter-spacing to feel impactful and grounded.
- **Labels:** Metadata and small identifiers use generous letter-spacing and uppercase styling to ensure legibility and a sophisticated, architectural feel.
- **Hierarchy:** Use `display-lg` for movie titles on hero details pages and `label-md` for technical metadata like file size or resolution.

## Layout & Spacing

The layout philosophy is "Fluid Content, Fixed Ratios." The grid is a 12-column system, but the primary driver is the 2:3 aspect ratio of movie posters.

- **Rhythm:** An 8px base unit governs all padding and margins.
- **Safe Zones:** Generous margins (24px on mobile, up to 64px on desktop) ensure the content never feels crowded against the edge of the display.
- **Reflow:** On mobile, posters typically span 2 columns (6 per row); on desktop, they scale to fill the width while maintaining their 2:3 ratio, allowing the number of columns to adapt dynamically.

## Elevation & Depth

To achieve a "zero-chrome" aesthetic, depth is communicated through light and shadow rather than lines:

- **Surface Tiers:** The background is the lowest layer (#0B0B0C). Elevated elements like cards or the filter panel sit on a secondary surface (#161617).
- **Shadows:** Use large, highly diffused shadows (e.g., `box-shadow: 0 20px 40px rgba(0,0,0,0.4)`) to lift posters off the background. 
- **Backdrop Blur:** Modals and navigation overlays use a high-saturation backdrop blur (20px–30px) to maintain the cinematic context of the layer beneath without distracting the user.

## Shapes

The design uses a refined roundedness level to soften the technical feel of the grid.

- **Posters:** Use `rounded-lg` (1rem) to frame the movie art elegantly.
- **Secondary Surfaces:** The filter panel and container backgrounds use `rounded-xl` (1.5rem) to feel approachable.
- **Interactive Elements:** Buttons and status badges use pill-shaping (full roundedness) to clearly distinguish interactive/status-driven elements from content-driven elements (posters).

## Components

- **Poster Cards:** 2:3 aspect ratio. No borders or visible strokes. Title and year should appear as a subtle overlay on hover or below the card in `label-sm` typography.
- **Status Badges:** Small, pill-shaped chips with a low-opacity background tint of the semantic color and a solid-colored dot indicator. 
    - *Fetching:* Blue
    - *Needs Match:* Amber
    - *Missing:* Red
    - *Not Saved:* Orange
- **Filter Panel:** A single, horizontal-scrolling strip with pill-shaped active states. The panel should be semi-transparent with a backdrop blur to appear as if it is floating over the content.
- **Primary Action Buttons:** Pill-shaped, using the Cyan accent color (#22D3EE) with black text for maximum visibility.
- **Input Fields:** Minimalist under-lines or subtle surface shifts (#161617) only. No full borders. Use the Cyan accent for the cursor and focus state.