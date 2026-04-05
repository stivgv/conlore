# ⚙️ Tennis Club Manager - Core Infrastructure & System Rules

## 🎯 System Overview
Enterprise-grade Tennis Club management system. The architecture focuses strictly on robust backend logic, fail-safe database operations, and strict Role-Based Access Control (RBAC).

## 🛠️ Core Infrastructure Stack
- **Framework:** Next.js 15+ (App Router).
- **Architecture Paradigm:** React Server Components (RSC) by default. Client Components (`"use client"`) must be used ONLY when DOM interactivity or React hooks are strictly required.
- **Database & Auth:** Supabase (PostgreSQL).
- **Language:** TypeScript (Strict mode enabled).

## 💻 Core Operations & Commands
- **Type Checking:** Always run `npx tsc --noEmit` to verify type safety before proposing structural changes.
- **Environment:** Node.js environment.

## 🗄️ Database, Security & Business Logic (Supabase)

### 1. Database & RLS (Row Level Security)
- **Strict Access:** All database queries must respect Supabase RLS. 
- **Server-Side Preferred:** Database interactions must happen primarily on the server (Server Components or Server Actions) using `@/lib/supabase/server`.
- **RBAC (Role-Based Access Control):** Users have roles (`admin`, `member`). Admin-only routes must verify the role server-side via Supabase Auth before fetching data or rendering.

### 2. Server Actions (Mutations)
- **Location:** All mutations (creates, updates, deletes) must be handled via Next.js Server Actions (e.g., `app/dashboard/actions.ts`).
- **State Standard:** Server actions should return a predictable state object, typically: `{ status: 'idle' | 'success' | 'error', message?: string }`.
- **Cache Invalidation:** Always use `revalidatePath()` after a successful mutation to ensure the UI stays synchronized with the database.

### 3. Booking Engine Rules (CRITICAL)
- **Time Intervals:** The system operates strictly on **30-minute intervals** (e.g., 08:00, 08:30, 09:00). Time generation logic must rely on numeric minute calculations, not simple hour increments.
- **Boundaries:** Bookings must strictly respect the individual `open_time` and `close_time` columns of the specific `court`.
- **Anti-Overlapping:** The database uses PostgreSQL GiST constraints to prevent double-booking. Server logic must also pre-validate overlaps before attempting inserts.

## 🤖 AI Behavioral Golden Rules

### 1. Atomic & Scoped Changes
- **Strict Focus:** Implement exactly what is requested. Do NOT proactively refactor unrelated code or add unrequested features.
- **Code Preservation:** Never remove existing UI/Styling classes or logic unless explicitly instructed to do so.

### 2. Next.js 15 Compliance
- **Async Params:** Always treat `params` and `searchParams` as Promises (Next.js 15 standard). E.g., `const { id } = await params;`.
- **Modern Hooks:** Use `useActionState` (not the deprecated `useFormState`) for server action forms.

### 3. Component Architecture
- **Leaf Nodes:** Keep Client Components (`"use client"`) as low in the React tree as possible (Leaf nodes) to maximize server-side rendering performance.
- **Prop Passing:** Pass plain data (not complex objects or un-serializable functions) from Server to Client Components.