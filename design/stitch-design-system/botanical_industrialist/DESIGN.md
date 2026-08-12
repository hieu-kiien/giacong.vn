---
name: Botanical Industrialist
colors:
  surface: '#f6fbf2'
  surface-dim: '#d6dcd3'
  surface-bright: '#f6fbf2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f5ec'
  surface-container: '#eaefe6'
  surface-container-high: '#e4eae1'
  surface-container-highest: '#dfe4db'
  on-surface: '#181d17'
  on-surface-variant: '#3f493f'
  inverse-surface: '#2c322c'
  inverse-on-surface: '#edf2e9'
  outline: '#6f7a6e'
  outline-variant: '#becabc'
  surface-tint: '#006d30'
  primary: '#00652c'
  on-primary: '#ffffff'
  primary-container: '#15803d'
  on-primary-container: '#d3ffd5'
  inverse-primary: '#79db8d'
  secondary: '#55615a'
  on-secondary: '#ffffff'
  secondary-container: '#d9e6dd'
  on-secondary-container: '#5b6760'
  tertiary: '#97344a'
  on-tertiary: '#ffffff'
  tertiary-container: '#b64c62'
  on-tertiary-container: '#fff1f1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#95f8a7'
  primary-fixed-dim: '#79db8d'
  on-primary-fixed: '#00210a'
  on-primary-fixed-variant: '#005323'
  secondary-fixed: '#d9e6dd'
  secondary-fixed-dim: '#bdcac1'
  on-secondary-fixed: '#131e19'
  on-secondary-fixed-variant: '#3e4943'
  tertiary-fixed: '#ffd9dd'
  tertiary-fixed-dim: '#ffb2bd'
  on-tertiary-fixed: '#400013'
  on-tertiary-fixed-variant: '#81233b'
  background: '#f6fbf2'
  on-background: '#181d17'
  surface-variant: '#dfe4db'
  green-600: '#16A34A'
  green-100: '#DCFCE7'
  slate-950: '#0B1220'
  slate-500: '#64748B'
  slate-200: '#E2E8F0'
  crimson-error: '#E11D2E'
  footer-gradient-start: '#065F2E'
  footer-gradient-end: '#08752E'
typography:
  hero-display:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '800'
    lineHeight: '1.08'
    letterSpacing: -0.02em
  headline-h1:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.15'
  headline-h2:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-h3:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.25'
  headline-h1-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.7'
  body-base:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.65'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.55'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.4'
  button-text:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1280px
  section-v-desktop: 96px
  section-v-mobile: 48px
  gutter: 24px
---

## Brand & Style

This design system establishes a high-trust, modern Vietnamese OEM/ODM manufacturing identity. It prioritizes a **Corporate Modern** style infused with **Natural/Sustainable** accents. The interface balances high-tech industrial precision with organic warmth, suitable for a professional B2B lead generation engine.

### Key Tenets
- **Precision Manufacturing:** Sharp typography and consistent 12-column layouts evoke factory efficiency and ISO/GMP compliance.
- **Natural Integrity:** Soft green washes and botanical gradients emphasize the organic origins of food, agricultural, and herbal products.
- **Breathable Professionalism:** Heavy use of white space ensures clarity and premium positioning, avoiding the cluttered "wholesale" feel of traditional manufacturers.

### Visual Signature
The design system utilizes rounded cards (16px+), hair-line slate borders, and soft ambient shadows to create depth without visual noise. Interaction is characterized by smooth, subtle vertical translations and gentle scaling to reinforce a feeling of quality and responsiveness.

## Colors

The palette is anchored in **Forest Green** and **Pure White**, reflecting the intersection of nature and industry.

- **Primary Forest Green (#15803D):** Used for primary CTAs, main brand marks, and active states. It represents stability and professional growth.
- **Soft Botanical Wash (#F0FDF4):** Acts as a secondary background for section alternating and highlight containers. It provides a natural, calming relief from pure white.
- **Functional Neutrals:** Slate tones provide the structural framework. Slate 950 is reserved for high-impact display text, while Slate 200 defines the hair-line borders that organize the layout.
- **Semantic Crimson (#E11D2E):** Specifically utilized for product pricing and critical errors to ensure high visibility against the green-dominated palette.
- **Footer Depth:** A deep green gradient creates a "grounded" conclusion to every page, symbolizing the established foundation of the manufacturing facility.

## Typography

This design system exclusively employs **Inter** to maintain a utilitarian, modern, and highly legible aesthetic across technical specifications and marketing copy.

### Hierarchy Principles
- **Display Typography:** Headlines are characterized by tight line-heights and heavy weights to project authority. The hero display uses a slight negative letter-spacing to appear more editorial and polished.
- **Reading Comfort:** Body text utilizes a generous 1.65–1.7x line-height. This is critical for the Vietnamese market when reading detailed ingredient lists or manufacturing steps.
- **Labels:** Small labels and tags use a medium or semi-bold weight to remain legible even at 12px.
- **Responsive Scaling:** Use fluid typography for headlines, ensuring that H1s gracefully downscale to 32px on mobile devices while maintaining their bold character.

## Layout & Spacing

The layout is built on a rigorous **12-column fluid grid** with a maximum content width of 1280px. 

### Spacing Philosophy
- **Modular Rhythm:** All spacing is derived from a base 8px unit. Consistent padding (24px or 32px) is applied to card containers to maintain internal "breathability."
- **Vertical Pacing:** Sections are separated by significant vertical whitespace (96px on desktop) to allow the user to focus on one manufacturing stage or service at a time. This prevents the "wall of content" effect common in B2B sites.
- **Grid Application:**
  - **Product Grids:** 4 columns on desktop, 2 on tablet, 1 on mobile.
  - **Service Features:** 3 columns on desktop to maximize icon and descriptive space.
  - **Forms:** 2-column inputs for desktop leads, collapsing to 1-column on mobile for touch accessibility.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** supplemented by **Ambient Shadows**.

- **Surfaces:** The primary level is Pure White. Secondary levels (alternate sections) use Gray 50 or Green 50.
- **Cards:** Cards use a subtle hair-line border (#E2E8F0) as their primary definition. Elevation via shadows is reserved for hover states and floating components (modals/drawers).
- **Shadow Character:** Shadows must be extremely diffuse with low opacity. Avoid hard blacks; instead, use a slight Slate tint in the shadow color to maintain the clean aesthetic.
- **Interactive Depth:** On hover, cards should translate -4px vertically and gain a slightly deeper shadow to signify interactivity.

## Shapes

The shape language is **Rounded**, reflecting a modern and approachable industrial feel.

- **Standard Elements:** Cards and sections use a 16px (`rounded-2xl`) radius.
- **Controls:** Buttons and input fields use a slightly tighter 10px-12px radius to feel precise and mechanical.
- **Large Containers:** Hero images and large promotional banners use a 32px radius to emphasize the "organic" and "friendly" brand personality.
- **Pills:** Category tags and status badges always use a 999px full radius for distinct shape contrast against rectangular cards.

## Components

### Buttons
- **Primary:** Forest Green background with white text. 12px radius. Smooth 200ms transition to Green 600 on hover.
- **Secondary:** Forest Green 1.5px border with a transparent or white background. On hover, fills with Green 50.
- **Tertiary:** Text-only with a trailing arrow icon. The icon should translate +4px on hover.

### Cards
- **Product Card:** Features a 1:1 image ratio, Green 100 category pill, and Crimson Red price. Includes a quantity stepper within the card footer.
- **Service Card:** Features a circular icon badge at the top-left, semi-bold titles, and a structured bullet list of benefits.

### Input Fields
- White or Gray 50 background with a Slate 300 border. Upon focus, the border transitions to Forest Green with a soft 3px green outer glow.

### Specialized Components
- **Process Steps:** Horizontal flow with large numeric watermarks in Green 100.
- **Mega Menu:** Floating white panel with 20px rounded corners, utilizing backdrop blur on the page behind it to maintain focus.
- **Quotation Form:** A structured grid utilizing chips for service selection and a dashed-border dropzone for technical document uploads.