MASTER DIRECTIVE: Platform Visual & Financial Architecture Overhaul
CONTEXT: You are tasked with overhauling a school management platform. The frontend code is in this repository, and the backend data is in Firebase. The platform serves adult students in a high-end educational environment.

Currently, the platform suffers from two critical failures:

Visual Failure: Terrible UI/UX. Low contrast (light gray text on white backgrounds, dark blue text on black backgrounds). It does not look like a premium, high-end platform.
Financial Failure: The Admin finance dashboard is entirely wrong and does not reflect proper accounting practices.
Your mission is to execute the two phases below meticulously.

STRICT BOUNDARIES & RULES (DO NOT VIOLATE)
DO NOT DELETE EXISTING FIREBASE DATA: You may create new collections (e.g., invoices, transactions), but you must not write scripts that delete existing user data.
FRAMEWORK ADHERENCE: Detect the frontend framework used in this repository (React, Vue, plain HTML/JS, etc.) and adhere strictly to its best practices. Do not introduce new libraries unless absolutely necessary (e.g., a charting library like Recharts/Chart.js for finance graphs).
ACCESSIBILITY (WCAG): All text MUST have a contrast ratio of at least 4.5:1. No excuses.
COMMITMENTS: Make logical, step-by-step commits. Do not squash everything into one massive commit.
PHASE 1: THE VISUAL OVERHAUL (High-End Premium Aesthetic)
The platform must look sophisticated, clean, and professional.

1. Global Design System ImplementationFind the main CSS file (or theme config if using Tailwind/styled-components) and implement the following strict color palette:

Backgrounds:
Main App Background: #F8F9FA (Soft off-white)
Cards/Containers Background: #FFFFFF (Pure white)
Admin Sidebar Background: #1E293B (Deep slate/navy)
Typography (Mandatory Contrast Fixes):
Primary Text: #1E1E1E (Near black) - MUST be used for all main body text.
Secondary Text: #475569 (Dark gray) - For labels, subtitles, and secondary info.
Sidebar Text: #FFFFFF or #CBD5E1 - MUST be used for text on the dark sidebar.
PROHIBITED: Light gray (#cccccc or lighter) on white backgrounds. Dark blue on black backgrounds.
Accent Colors:
Primary Buttons/Links: #0F172A (Deep Navy) or #4F46E5 (Rich Indigo).
Typography Family: Change global font to Inter, Helvetica Neue, or Segoe UI. Base font size must be 16px.
2. Layout and Spacing Rules

Implement a "Card-based" UI. All major sections (student dashboard widgets, admin tables) must be wrapped in a container with: background: #FFFFFF, border-radius: 8px, box-shadow: 0 4px 12px rgba(0,0,0,0.05), and border: 1px solid #E2E8F0.
Increase whitespace. Add adequate padding (minimum 24px) inside cards.
3. Fixing the Student vs. Admin Views

Ensure the navigation clearly separates Student views from Admin views.
Scan all components for hardcoded inline styles that cause contrast issues and replace them with the global CSS classes/variables defined above.
PHASE 2: FINANCE ARCHITECTURE OVERHAUL (Admin View)
The current finance system is wrong. A proper school finance system requires separating Invoices (what is owed) from Transactions (what was paid).

1. Firebase Firestore Data Structure UpdatesEnsure the database utilizes the following structure. (If these collections don't exist, create empty ones and update the app to read/write to them).

Collection: invoices
studentId (string)
amount (number)
description (string - e.g., "Fall Tuition")
status (string: unpaid, partially_paid, paid, overdue)
dueDate (timestamp)
createdAt (timestamp)
Collection: transactions
studentId (string)
invoiceId (string - reference to the invoice)
amount (number)
type (string: payment, refund, scholarship)
method (string: credit_card, cash, bank_transfer)
date (timestamp)
2. Admin Finance Dashboard UIRebuild the Admin Finance landing page to include:

KPI Metric Cards (Top Row):
Total Revenue (Last 30 Days): Sum of transactions where type == 'payment'.
Outstanding Balances: Sum of invoices where status != 'paid'.
Overdue Amount: Sum of invoices where status == 'overdue'.
Cash Flow Chart: A line or bar chart showing Revenue vs. Expenses over the last 6 months.
Recent Transactions Table: A clean, high-contrast table showing the latest 10 transactions (Date, Student Name, Amount, Status).
3. Status Badges (Visual Clarity for Finances)Implement CSS status badges for financial tables:

Paid: Green text (#15803D) on light green background (#F0FDF4).
Pending/Unpaid: Amber text (#B45309) on light amber background (#FFFBEB).
Overdue: Red text (#B91C1C) on light red background (#FEF2F2).
EXECUTION STEPS FOR YOU (THE AI):
Scan the repository structure to understand the framework and locate the main styling files and finance components.
Create a new branch named feature/platform-overhaul.
Execute Phase 1 (Visuals) first. Commit with message: feat(ui): implement high-end design system and fix contrast issues.
Execute Phase 2 (Finance UI & Firebase mappings) second. Commit with message: feat(finance): rebuild admin dashboard and restructure finance data architecture.
Output a summary of files changed and any manual Firebase setup required by the user.
