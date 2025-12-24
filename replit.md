# KABS Annotation & Pricing AI

## Overview

KABS Annotation & Pricing AI is a professional-grade PDF annotation tool designed for interior designers. The application allows users to upload floor-plan PDFs and add professional annotations, measurements, and comments. The platform includes two main modules: an active Annotation tool and a planned Pricing AI feature for AI-powered pricing suggestions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom build script for production
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and data fetching
- **Styling**: Tailwind CSS with dark theme as default, shadcn/ui component library (New York style)
- **PDF Rendering**: pdfjs-dist for PDF viewing and manipulation
- **Canvas/Drawing**: Konva (react-konva) for annotation rendering with shapes, lines, arrows, and text
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture

- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api` prefix
- **File Uploads**: Multer for handling PDF uploads (50MB limit), stored in `uploads/` directory
- **Authentication**: Custom implementation with bcryptjs for password hashing, localStorage-based session on client
- **Build Output**: esbuild bundles server to `dist/index.cjs` for production

### Data Storage

- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**:
  - `users`: User accounts with id, email, password, name
  - `projects`: PDF annotation projects with userId, name, status, pdfUrl, pageCount
  - `annotations`: Page-level annotation data stored as JSONB
- **Migrations**: Drizzle Kit manages schema with `db:push` command

### Project Structure

```
├── client/          # Frontend React application
│   └── src/
│       ├── components/ui/  # shadcn/ui components
│       ├── pages/          # Route pages (login, signup, dashboard, projects, editor)
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities, auth context, query client
├── server/          # Backend Express application
│   ├── index.ts     # Server entry point
│   ├── routes.ts    # API route definitions
│   ├── storage.ts   # Database operations interface
│   └── db.ts        # Drizzle database connection
├── shared/          # Shared code between client and server
│   └── schema.ts    # Drizzle schema and Zod validation
└── uploads/         # PDF file storage directory
```

### Key Design Decisions

1. **Monorepo Structure**: Client and server share TypeScript types and Zod schemas via `shared/` directory, ensuring type safety across the stack.

2. **Dark Theme Default**: Application defaults to dark mode for reduced eye strain during long editing sessions, following design guidelines in `design_guidelines.md`.

3. **Canvas-Based Editor**: Uses Konva for high-performance annotation rendering, supporting shapes, freehand drawing, measurements, and text overlays on PDF pages.

4. **Page-Level Annotations**: Annotations are stored per-page rather than per-project, allowing efficient loading and saving of large documents.

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable

### File Storage
- Local filesystem storage in `uploads/` directory for PDF files

### Key NPM Packages
- `pdfjs-dist`: PDF rendering
- `react-konva`/`konva`: Canvas drawing and annotation
- `drizzle-orm`/`drizzle-kit`: Database ORM and migrations
- `bcryptjs`: Password hashing
- `multer`: File upload handling
- `@tanstack/react-query`: Data fetching and caching
- `wouter`: Client-side routing
- `zod`: Schema validation

### Build Dependencies
- `esbuild`: Server bundling for production
- `vite`: Frontend development and build