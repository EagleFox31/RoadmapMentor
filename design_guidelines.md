# Design Guidelines - Roadmap Mentor (Ultra-Premium 10K+ Design)

## Design Philosophy
**Premium glassmorphism aesthetic with sophisticated micro-interactions, depth effects, and fluid animations.** The design should feel expensive, modern, and delightful - like a $10,000+ SaaS product from 2025.

## Visual Identity

### Core Aesthetic
- **Glassmorphism**: Frosted glass cards with backdrop blur
- **Depth & Layering**: Multiple z-levels with colored shadows
- **Fluid Motion**: Smooth cubic-bezier transitions everywhere
- **Premium Feel**: Generous spacing, refined typography, subtle glows

### Color Philosophy
- Deep, rich gradients with subtle animation
- Colored shadows that match primary elements
- Glow effects on interactive elements
- Transparent layers with precise opacity control

## Color Palette

### Primary Gradient System
```css
--gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
--gradient-secondary: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)
--gradient-success: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)
--gradient-mesh: radial-gradient at [animated positions]
```

### Glass Colors
- **Glass Surface**: rgba(255, 255, 255, 0.08) [dark] / rgba(255, 255, 255, 0.7) [light]
- **Glass Border**: rgba(255, 255, 255, 0.18) [dark] / rgba(255, 255, 255, 0.3) [light]
- **Backdrop Blur**: 20px (cards), 40px (modals)

### Accent Colors
- **Purple**: #667eea (primary actions, focus states)
- **Pink**: #f093fb (secondary highlights)
- **Blue**: #4facfe (info, links)
- **Cyan**: #00f2fe (success, completion)

### Shadow System
```css
--shadow-glow-sm: 0 0 20px rgba(102, 126, 234, 0.15)
--shadow-glow-md: 0 0 40px rgba(102, 126, 234, 0.25)
--shadow-glow-lg: 0 0 60px rgba(102, 126, 234, 0.35)
--shadow-depth-1: 0 2px 8px rgba(0, 0, 0, 0.1), 0 0 20px rgba(102, 126, 234, 0.08)
--shadow-depth-2: 0 4px 16px rgba(0, 0, 0, 0.12), 0 0 30px rgba(102, 126, 234, 0.12)
--shadow-depth-3: 0 8px 32px rgba(0, 0, 0, 0.15), 0 0 40px rgba(102, 126, 234, 0.18)
```

## Typography

### Font System
- **Primary**: 'Inter', system-ui, -apple-system, sans-serif
- **Display**: 'Inter', weight 700-900
- **Code**: 'JetBrains Mono', monospace

### Scale (Premium Spacing)
```
Display: 48px (3rem) - Ultra Bold
H1: 36px (2.25rem) - Bold
H2: 28px (1.75rem) - Semibold
H3: 22px (1.375rem) - Semibold
Body Large: 18px (1.125rem) - Regular
Body: 16px (1rem) - Regular
Small: 14px (0.875rem) - Medium
Tiny: 12px (0.75rem) - Medium
```

### Text Hierarchy
- **Primary**: High contrast, bold weights
- **Secondary**: Medium opacity (0.7)
- **Tertiary**: Lower opacity (0.5)
- **Accent**: Gradient text on hover

## Components

### Glass Cards
```css
background: rgba(255, 255, 255, 0.08)
backdrop-filter: blur(20px)
border: 1px solid rgba(255, 255, 255, 0.18)
border-radius: 20px
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12)
```

**Hover State:**
```css
transform: translateY(-2px)
box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15), 0 0 30px rgba(102, 126, 234, 0.15)
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1)
```

### Premium Buttons
```css
/* Primary Gradient Button */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
color: white
padding: 12px 32px
border-radius: 12px
font-weight: 600
box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3), 0 0 20px rgba(102, 126, 234, 0.15)

/* Hover */
transform: translateY(-1px) scale(1.02)
box-shadow: 0 6px 24px rgba(102, 126, 234, 0.4), 0 0 30px rgba(102, 126, 234, 0.25)
```

```css
/* Glass Button */
background: rgba(255, 255, 255, 0.1)
backdrop-filter: blur(10px)
border: 1px solid rgba(255, 255, 255, 0.2)
color: inherit

/* Hover */
background: rgba(255, 255, 255, 0.15)
border-color: rgba(255, 255, 255, 0.3)
```

### Badges & Pills
```css
background: linear-gradient(135deg, color1, color2)
padding: 6px 16px
border-radius: 100px
font-size: 13px
font-weight: 600
box-shadow: 0 2px 8px rgba(color, 0.3), 0 0 15px rgba(color, 0.1)
```

### Input Fields
```css
background: rgba(255, 255, 255, 0.05)
backdrop-filter: blur(10px)
border: 1.5px solid rgba(255, 255, 255, 0.15)
border-radius: 12px
padding: 14px 18px
font-size: 16px

/* Focus State */
border-color: #667eea
box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1), 0 0 20px rgba(102, 126, 234, 0.15)
```

## Animations & Transitions

### Timing Functions
```css
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1)
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55)
--ease-elastic: cubic-bezier(0.175, 0.885, 0.32, 1.275)
```

### Standard Durations
- **Instant**: 150ms (micro-feedback)
- **Quick**: 250ms (hover states)
- **Standard**: 400ms (cards, modals)
- **Slow**: 600ms (page transitions)

### Micro-Animations
1. **Button Hover**: Scale 1.02 + glow increase
2. **Card Hover**: Lift 2px + glow shadow
3. **Icon Hover**: Rotate 5deg + scale 1.1
4. **Badge Pulse**: Subtle scale animation on load
5. **Progress Bar**: Smooth width transition with glow trail

### Loading States
```css
/* Skeleton shimmer */
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)
animation: shimmer 2s infinite
```

## Layout

### Spacing Scale (Premium)
```
xs: 8px
sm: 12px  
md: 20px
lg: 32px
xl: 48px
2xl: 64px
3xl: 96px
```

### Grid System
- **Container**: max-width 1600px
- **Gutter**: 32px (desktop), 20px (mobile)
- **Columns**: 12-column fluid grid

### Z-Index Layers
```
background-gradient: -1
base-content: 0
glass-card: 1
floating-element: 10
dropdown: 100
modal-backdrop: 1000
modal: 1001
toast: 2000
```

## Background System

### Animated Gradient Mesh
```css
background: 
  radial-gradient(at 20% 30%, rgba(102, 126, 234, 0.15) 0px, transparent 50%),
  radial-gradient(at 80% 70%, rgba(240, 147, 251, 0.12) 0px, transparent 50%),
  radial-gradient(at 40% 90%, rgba(79, 172, 254, 0.10) 0px, transparent 50%);
animation: mesh-move 20s ease-in-out infinite;

@keyframes mesh-move {
  0%, 100% { background-position: 20% 30%, 80% 70%, 40% 90%; }
  50% { background-position: 80% 70%, 20% 30%, 60% 10%; }
}
```

## Interactions

### Hover Effects
1. **Lift + Glow**: translateY(-2px) + colored shadow increase
2. **Scale + Shimmer**: scale(1.02) + shine overlay
3. **Gradient Shift**: background-position animation
4. **Border Glow**: border opacity increase + outer glow

### Active/Press States
- **Scale Down**: scale(0.98)
- **Shadow Reduce**: Flatten slightly
- **Duration**: 100ms (instant feedback)

### Focus States
- **Ring**: 3px outline with brand color at 20% opacity
- **Glow**: Soft colored shadow
- **No browser default**: outline: none (custom ring instead)

## Best Practices

### Premium Indicators
1. ✅ Generous white space (2-3x normal padding)
2. ✅ Smooth, physics-based animations
3. ✅ Colored shadows matching element color
4. ✅ Glassmorphism with proper blur
5. ✅ Gradient accents, not flat colors
6. ✅ Micro-interactions on every interactive element
7. ✅ Depth perception through layering
8. ✅ Refined typography with proper hierarchy

### Avoid
1. ❌ Harsh borders (use glass borders instead)
2. ❌ Flat, solid backgrounds
3. ❌ Instant transitions (always animate)
4. ❌ Default button/input styles
5. ❌ Black shadows (use colored shadows)
6. ❌ Cramped spacing
7. ❌ Single-color elements (use gradients)

## Accessibility

- **Contrast**: Maintain WCAG AA (4.5:1 text, 3:1 UI)
- **Focus Visible**: Always show custom focus ring
- **Reduced Motion**: Respect prefers-reduced-motion
- **Touch Targets**: Minimum 44x44px
- **Color Independence**: Don't rely solely on color

## Dark Mode

### Glass in Dark Mode
```css
.dark {
  --glass-bg: rgba(255, 255, 255, 0.08)
  --glass-border: rgba(255, 255, 255, 0.18)
  --glass-hover: rgba(255, 255, 255, 0.12)
}
```

### Light Mode
```css
:root {
  --glass-bg: rgba(255, 255, 255, 0.7)
  --glass-border: rgba(255, 255, 255, 0.3)
  --glass-hover: rgba(255, 255, 255, 0.85)
}
```

## Performance

- Use `will-change` sparingly (hover states only)
- GPU-accelerated properties: transform, opacity
- Debounce scroll animations
- Lazy-load heavy animations
- Optimize backdrop-filter usage

---

**Target Value**: This design should feel like a **$10,000+ premium product** - polished, sophisticated, and delightful in every interaction.
