---
name: Family Finance Glass Core
colors:
  surface: '#f9f9ff'
  surface-dim: '#d8d9e3'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3fd'
  surface-container: '#ecedf7'
  surface-container-high: '#e6e7f2'
  surface-container-highest: '#e1e2ec'
  on-surface: '#191b23'
  on-surface-variant: '#424754'
  inverse-surface: '#2e3038'
  inverse-on-surface: '#eff0fa'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#006577'
  on-tertiary: '#ffffff'
  tertiary-container: '#008096'
  on-tertiary-container: '#f9fdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#f9f9ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ec'
typography:
  headline-xl:
    fontFamily: Poppins
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Poppins
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Poppins
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Poppins
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-padding: 24px
  gutter: 16px
  card-gap: 20px
  section-margin: 40px
---

## Brand & Style
The design system is engineered to evoke a sense of "secure transparency." It targets modern families who value both sophisticated technology and approachable financial management. The aesthetic is rooted in **Glassmorphism**, utilizing multi-layered translucency to represent the clarity of a family's financial health. 

The brand personality is **Professional and Elegant**, leaning heavily into a **Futuristic** vision of wealth management that feels light, airy, and non-intimidating. The emotional response is one of calm control—removing the "weight" of traditional banking through floating elements, vibrant blurs, and soft, organic depth.

## Colors
The palette is dominated by a core triad of **Royal Blue**, **Purple**, and **Cyan**. These colors are primarily used for interactive elements and data visualization. 

The background is a soft, multi-stop gradient that provides the necessary "vibrancy" behind glass layers to make the frosting effect visible. Text should maintain high contrast against the translucent backgrounds using deep navy or charcoal tones, while feedback colors (Success, Warning, Danger) are kept vivid to ensure clarity in financial status reporting.

## Typography
This design system utilizes **Poppins** for all display and heading roles to inject a geometric, friendly, and modern energy. Its bold weights are used to anchor sections on the translucent cards. 

**Inter** is employed for all body copy and UI labels to ensure maximum legibility, especially when text is placed over varying background blurs. To maintain a futuristic feel, headings use a slightly tighter letter-spacing, while labels use a slightly increased letter-spacing for better readability in high-density financial data.

## Layout & Spacing
The system uses a **Fluid Grid** model with generous safe areas to enhance the airy aesthetic. 
- **Desktop:** 12-column grid with 24px gutters.
- **Mobile:** 4-column grid with 16px gutters and 24px side margins.

Spacing follows an 8px base unit. Because glass elements appear to float, horizontal and vertical margins between cards should be consistent to maintain the "tiled" look of the dashboard. Elements within glass cards should have a minimum internal padding of 24px to ensure content doesn't feel cramped against the rounded corners.

## Elevation & Depth
Depth is the primary communicator of hierarchy in this system. 
- **Level 1 (Base):** The colorful background gradient.
- **Level 2 (The Glass Layer):** Main content containers. Apply a `backdrop-filter: blur(25px)` and a `background: rgba(255, 255, 255, 0.25)`.
- **Level 3 (Interactive Elements):** Buttons and active states. These use solid gradients or more opaque glass fills.

**Shadows:** Use extremely soft, low-opacity shadows with a large spread (e.g., `0 8px 32px 0 rgba(31, 38, 135, 0.07)`). This prevents the UI from looking "heavy" while still defining the physical separation of the glass panes.

## Shapes
The shape language is defined by **large, friendly radii**. Every primary container and card must use a **24px (rounded-xl)** corner radius. 

Interactive elements like buttons and input fields should follow this curvature to maintain harmony. Secondary elements like chips or badges should use a full-pill shape. Borders on glass cards should be subtle, 1px thick, using a linear gradient that simulates a light catching the edge of the glass.

## Components

### Glass Cards
The signature component. Features 25% white opacity, 25px backdrop blur, and a 1px gradient border (White to Transparent). These cards house all financial data and modules.

### Buttons
- **Primary:** Linear gradient from Royal Blue to Purple. High roundedness (24px).
- **Secondary:** Transparent glass fill with a solid primary-colored border.
- **Interaction:** On hover, buttons should increase in brightness and scale slightly (1.02x) to mimic a tactile glass physical response.

### Financial Icons & Charts
- **Icons:** Use thin-line (2pt) icons with a dual-tone treatment (Primary color with a secondary color accent).
- **Charts:** Interactive line and bar charts using the Cyan and Purple palette. Use "glow" effects (drop shadows in the stroke color) for line charts to make them pop against the frosted background.

### Input Fields
Soft, translucent backgrounds with 24px rounded corners. The active state should be indicated by a 2px Cyan border and a soft glow.

### Family Profile Chips
Small glass circles or rounded squares with user avatars, outlined in the secondary purple to denote different family members.