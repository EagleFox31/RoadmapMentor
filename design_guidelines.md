# Design Guidelines - Pavel Roadmap Application

## Design System Approach
**Glassmorphism** with developer/backend/code theme - premium, modern aesthetic focusing on transparency, blur effects, and technical visual language.

## Core Design Elements

### A. Typography
- **Primary Font**: Inter (sans-serif via Google Fonts)
- **Hierarchy**:
  - H1 (Page titles): 3em, bold
  - H2 (Section headers): 2em, bold, color: #1e3a8a (deep blue)
  - H3 (Component titles): 1.8em, semi-bold
  - Body: 1.1em, regular weight
  - Labels/metadata: 1em, medium weight

### B. Layout System
**Tailwind spacing units**: Use units of 4, 6, 8, 12, 16, 20, 24, 30, 32 for consistent rhythm

**Main Layout Structure** (Desktop):
- **3-column grid layout**:
  - Left column (25%): Week selector/timeline - sticky position
  - Center column (50%): Week detail view - scrollable main content
  - Right column (25%): Progress panel & notes - sticky position
- **Top bar**: Fixed header with logo, user avatar, role indicator
- **Mobile**: Stack columns vertically, full-width cards

### C. Component Library

**Glassmorphism Card Base**:
- Background: `bg-white/10`
- Backdrop filter: `backdrop-blur-xl`
- Border: `border border-white/20`
- Border radius: `rounded-2xl` (larger cards), `rounded-xl` (smaller cards)
- Shadow: `shadow-xl`
- Padding: `p-6` to `p-8`

**Buttons**:
- Primary: Gradient `from-sky-500 to-indigo-500`, rounded-full or rounded-lg
- Hover: `hover:scale-105`, `hover:shadow-2xl`
- Transitions: `transition-all duration-200`
- Padding: `px-6 py-3`
- Font weight: semi-bold

**Interactive Elements**:
- Checkboxes: Custom styled, 20px × 20px, with smooth check animation
- Task items: `border-bottom border-white/10`, padding `py-3`, flex layout
- Hover effects on cards: `hover:translate-y-[-5px]`, `hover:shadow-2xl`

**Week Cards** (Left sidebar):
- Vertical timeline or stacked cards
- Active state: enhanced glow/border
- Number badge: circular, gradient background, positioned top-left

**Progress Bars**:
- Container: `bg-white/10`, height 40px, rounded-full
- Fill: Gradient `from-green-500 to-green-600`
- Percentage text: white, bold, positioned right

**Modals** (for Mentor editing):
- Centered overlay with glassmorphism
- Backdrop: dark semi-transparent
- Form inputs: glassmorphism style with white/20 backgrounds

## Color Palette

### Primary Colors
- **Blue gradient**: #667eea → #764ba2 (page background)
- **Deep blue**: #1e3a8a, #1e40af (headers, titles)
- **Sky-Indigo gradient**: sky-500 → indigo-500 (buttons)

### Accent Colors
- **Success/Progress**: #10b981, #059669 (green gradient)
- **Warning/Status**: #f59e0b, #d97706 (orange gradient)
- **Cyan**: For tech/code accents
- **Violet**: Secondary accent

### Neutral Glassmorphism
- Card backgrounds: white/10 to white/20
- Borders: white/20 to white/30
- Text on glass: white or very dark (#1e3a8a)

## Background Treatment

**Full-page background**:
- Primary: Linear gradient (135deg, deep blue to purple)
- Overlay: Semi-transparent image of code/terminal/backend infrastructure (blurred, 20-30% opacity)
- Effect: Creates depth while maintaining readability of glassmorphism elements

## Images

**Hero/Header Section**:
- Large decorative rocket emoji (🚀) or code-themed graphic at 200px, positioned absolutely with low opacity (0.1)
- Background image: Developer workspace, code editor, terminal, or cloud infrastructure - heavily blurred

**No additional images required** - design relies on glassmorphism, gradients, and iconography

## Component-Specific Design

**WeekSelector**: Vertical cards with week numbers, glassmorphism, click to expand
**WeekDetail**: Central panel with sections for Concepts/Algo/Project/Deliverables/Resources
**TaskList**: Checkbox + label rows, strikethrough on completion
**ProgressBar**: Glassmorphism container with animated gradient fill
**EditorPanel** (Mentor only): Floating action buttons, modal forms with glass cards

## Interaction Patterns

- **Hover states**: Subtle scale (1.05), enhanced shadow, no color changes
- **Active states**: Slight press effect (scale 0.98)
- **Transitions**: 200ms for buttons, 300ms for cards
- **Loading states**: Pulse animation on glassmorphism cards
- **Form validation**: Red accent (#ef4444) for errors, green for success

## Accessibility
- Maintain 4.5:1 contrast ratio minimum
- Focus states: outline with cyan/sky color
- Keyboard navigation support for all interactive elements
- ARIA labels on custom checkboxes and icon buttons