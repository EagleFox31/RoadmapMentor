# Roadmap Mentor - Backend Python Mentorship Application

## Overview

Roadmap Mentor is a mentorship tracking application designed for backend Python learning journeys. The application provides a structured week-by-week roadmap system where mentors can create and manage learning content while learners track their progress through tasks, objectives, and deliverables.

The application features two distinct user roles:
- **Mentors**: Create and manage weeks, objectives, tasks, deliverables, and resources
- **Learners**: View roadmap content, track task completion, and provide progress comments

The interface follows a glassmorphism design pattern with a developer/code-focused aesthetic, providing a premium and modern user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18+ with TypeScript
- Vite as the build tool and development server
- Wouter for client-side routing
- TanStack Query (React Query) for server state management
- Tailwind CSS with custom design system
- Shadcn UI component library (New York variant)

**Design System:**
- Glassmorphism visual language with backdrop blur effects
- Custom Tailwind configuration with HSL-based color tokens
- Responsive 3-column layout (desktop): left sidebar (week selector), center content (week details), right sidebar (progress panel)
- Mobile-first responsive design that stacks columns vertically
- Inter font family from Google Fonts

**Component Architecture:**
- Modular component structure under `client/src/components/`
- Reusable UI primitives from Radix UI via Shadcn
- Feature components: WeekSelector, WeekDetail, ObjectiveCard, TaskList, ProgressPanel, WeekComments
- Modal-based CRUD forms for all entities
- Path aliases configured for clean imports (`@/`, `@shared/`, `@assets/`)

**State Management:**
- JWT token stored in localStorage for authentication
- User profile cached in localStorage
- Server state managed through React Query with automatic cache invalidation
- Optimistic updates for better UX on mutations

### Backend Architecture

**Technology Stack:**
- Node.js with Express
- TypeScript with ES modules
- Drizzle ORM for database operations
- Neon serverless PostgreSQL database
- JWT for authentication with bcryptjs for password hashing

**API Structure:**
- RESTful API endpoints under `/api/` prefix
- Authentication endpoints: `/api/auth/register`, `/api/auth/login`
- Resource endpoints for weeks, objectives, tasks, deliverables, resources, task progress, and comments
- Role-based middleware: `authMiddleware`, `requireMentor`, `requireLearner`

**Database Schema (Drizzle ORM):**
- **users**: Authentication and role management (MENTOR/LEARNER)
- **weeks**: Week containers with validation status
- **objectives**: Categorized learning objectives (CONCEPT/ALGO/PROJECT/OTHER)
- **tasks**: Granular action items with optional flag and ordering
- **deliverables**: Expected outputs per week
- **resources**: Learning materials (DOC/VIDEO/COURSE/ARTICLE/OTHER)
- **taskProgress**: Learner-specific task completion tracking
- **weekComments**: Learner progress notes per week

**Key Design Patterns:**
- Repository pattern via storage interface (`IStorage`)
- Middleware-based authentication and authorization
- Zod schema validation for request/response data
- Centralized error handling
- Development/production environment separation with different server configurations

### Authentication & Authorization

**Authentication Flow:**
- JWT-based stateless authentication
- Tokens expire after 7 days
- Password hashing with bcryptjs (salt rounds: 10)
- Token stored client-side in localStorage
- Authorization header: `Bearer <token>`

**Authorization Model:**
- Role-based access control (RBAC)
- Two roles: MENTOR and LEARNER
- Middleware guards: `authMiddleware`, `requireMentor`, `requireLearner`
- Mentors: Full CRUD access to all content
- Learners: Read-only content access, can update own task progress and comments

### External Dependencies

**Primary Database:**
- Neon Serverless PostgreSQL via `@neondatabase/serverless`
- Connection pooling configured
- WebSocket support for serverless environments
- Drizzle ORM for type-safe database queries
- Migration system via `drizzle-kit`

**UI Component Library:**
- Radix UI primitives for accessible components
- Shadcn UI design system (New York style)
- Components configured via `components.json`

**Development Tools:**
- Replit-specific plugins for development mode:
  - Runtime error overlay
  - Cartographer (code navigation)
  - Dev banner
- TypeScript strict mode enabled
- ESLint and Prettier integration

**Additional Services:**
- date-fns for date manipulation and formatting (French locale support)
- React Hook Form with Zod resolvers for form validation
- Lucide React for iconography

**Build & Deployment:**
- Vite for frontend bundling
- esbuild for backend bundling in production
- Separate development (`index-dev.ts`) and production (`index-prod.ts`) entry points
- Static file serving in production mode