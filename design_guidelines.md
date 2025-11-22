# Design Guidelines - Roadmap Mentor (Google Material Design 3 Style)

## Design Philosophy
Clean, modern, professional Google-inspired design with Material Design 3 principles. Bright, airy interface with white cards, generous spacing, and Google's signature color palette.

## Color Palette

### Primary Colors (Google Brand)
- **Google Blue**: #4285F4 (Primary actions, links)
- **Google Red**: #EA4335 (Errors, delete actions)
- **Google Yellow**: #FBBC04 (Warnings, highlights)
- **Google Green**: #34A853 (Success, validation)

### Neutral Colors
- **White**: #FFFFFF (Card backgrounds, surfaces)
- **Light Gray**: #F8F9FA (Background)
- **Gray 100**: #F1F3F4 (Subtle borders)
- **Gray 300**: #DADCE0 (Borders)
- **Gray 500**: #9AA0A6 (Secondary text)
- **Gray 700**: #5F6368 (Primary text)
- **Gray 900**: #202124 (Headings)

### Surface Colors
- **Background**: #F8F9FA (Page background - light gray)
- **Card Surface**: #FFFFFF (White cards with shadow)
- **Hover**: #F1F3F4 (Subtle hover states)

## Typography

### Font Family
- Primary: 'Google Sans', 'Product Sans', system-ui, -apple-system, sans-serif
- Fallback: 'Roboto', 'Helvetica Neue', Arial, sans-serif
- Code: 'Roboto Mono', 'Consolas', monospace

### Font Sizes
- Heading 1: 32px (2rem) - Bold
- Heading 2: 24px (1.5rem) - Semibold
- Heading 3: 20px (1.25rem) - Medium
- Body Large: 16px (1rem) - Regular
- Body: 14px (0.875rem) - Regular
- Small: 12px (0.75rem) - Regular

### Text Colors
- Primary: #202124 (Gray 900)
- Secondary: #5F6368 (Gray 700)
- Tertiary: #9AA0A6 (Gray 500)

## Components

### Cards
- **Background**: Pure white (#FFFFFF)
- **Border Radius**: 12px (rounded-xl)
- **Shadow**: Soft, elevated shadows
  - Default: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)
  - Hover: 0 4px 12px rgba(0,0,0,0.15)
- **Padding**: 24px (p-6)
- **Border**: None (shadow only)

### Buttons
- **Primary (Google Blue)**: 
  - Background: #4285F4
  - Text: White
  - Hover: #3367D6
  - Shadow: 0 1px 3px rgba(66,133,244,0.3)
  
- **Success (Google Green)**:
  - Background: #34A853
  - Text: White
  - Hover: #2D9348

- **Danger (Google Red)**:
  - Background: #EA4335
  - Text: White
  - Hover: #D93025

- **Outlined**:
  - Border: 1px solid #DADCE0
  - Text: #5F6368
  - Background: White
  - Hover: #F8F9FA

- **Border Radius**: 8px (rounded-lg)
- **Padding**: 10px 24px
- **Font Weight**: 500 (Medium)
- **Height**: 40px (min-h-10)

### Badges
- **Border Radius**: 16px (fully rounded pill)
- **Padding**: 4px 12px
- **Font Size**: 12px
- **Font Weight**: 500
- **Colors**: Use Google palette (Blue, Green, Yellow, Red)

### Inputs
- **Background**: White
- **Border**: 1px solid #DADCE0
- **Border Radius**: 8px
- **Padding**: 12px 16px
- **Focus**: 2px border in Google Blue (#4285F4)
- **Shadow on focus**: 0 0 0 3px rgba(66,133,244,0.1)

### Header
- **Background**: White
- **Height**: 64px
- **Shadow**: 0 1px 2px rgba(0,0,0,0.1)
- **Border**: None
- **Position**: Fixed sticky

## Layout

### Spacing Scale
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

### Container
- Max Width: 1400px
- Padding: 24px

### Grid
- Gap: 24px
- Responsive breakpoints standard

## Interactions

### Hover States
- **Cards**: Subtle shadow elevation
- **Buttons**: Slightly darker background (-10% lightness)
- **Links**: Underline appears
- **Background change**: Transition to #F8F9FA

### Active States
- **Buttons**: Even darker (-15% lightness)
- **Scale**: None (keep original size)

### Transitions
- **Duration**: 200ms
- **Easing**: ease-in-out
- **Properties**: background-color, box-shadow, transform

## Icons
- Use lucide-react icons
- Size: 20px (default), 24px (large)
- Color: Inherit from parent or #5F6368 for neutral

## Shadows

### Elevation Levels
- Level 1: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)
- Level 2: 0 4px 6px rgba(0,0,0,0.1)
- Level 3: 0 10px 20px rgba(0,0,0,0.15)

## Best Practices

1. **Generous white space** - Don't crowd elements
2. **Clear hierarchy** - Use size, weight, and color to establish importance
3. **Consistent spacing** - Use the spacing scale
4. **Minimal borders** - Rely on shadows for separation
5. **Subtle interactions** - No aggressive animations
6. **Accessibility** - Maintain WCAG AA contrast ratios
7. **Clean and simple** - Less is more
