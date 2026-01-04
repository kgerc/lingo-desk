# LingoDesk

**CRM for Language Schools** - Automate scheduling, payments, and communication

## 🎯 Overview

LingoDesk is a modern SaaS platform designed for language schools (1-20 teachers) to:
- Automate lesson scheduling with conflict detection
- Track student budgets and send alerts
- Manage payments with Stripe integration
- Send automated reminders (email, SMS)
- Generate reports and insights

## 🚀 Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS + shadcn/ui
- React Router v6
- React Query (data fetching)
- Zustand (state management)

### Backend
- Node.js + Express.js
- TypeScript
- Prisma ORM
- Supabase (PostgreSQL + Auth)
- Zod (validation)

### Infrastructure
- Vercel (hosting)
- Supabase (database)
- Stripe (payments)
- Resend/SendGrid (email)

## 📁 Project Structure

```
lingo-desk/
├── apps/
│   ├── backend/          # Express API
│   └── frontend/         # React SPA
├── package.json          # Root package.json (workspaces)
└── README.md
```

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account (for payments)

### Setup

1. Clone the repository:
```bash
git clone <repo-url>
cd lingo-desk
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
```bash
# Backend (.env)
cp apps/backend/.env.example apps/backend/.env

# Frontend (.env)
cp apps/frontend/.env.example apps/frontend/.env
```

4. Run database migrations:
```bash
cd apps/backend
npx prisma migrate dev
```

5. Start development servers:
```bash
npm run dev
```

This will start:
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## 📚 Documentation

- [Architecture Overview](./docs/architecture.md)
- [Database Schema](./docs/database.md)
- [API Documentation](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)

## 🗺️ Roadmap

### MVP (v1.0) - Q1 2025
- ✅ User management (admin, teacher, student)
- ✅ Course & package management
- ✅ Weekly calendar with drag & drop
- ✅ Lesson confirmation flow
- ✅ Budget tracking & alerts
- ✅ Email notifications

### v2.0 - Q2 2025
- Stripe integration
- Invoice generation
- Parent panel
- Lesson cancellation by students

### v3.0 - Q3 2025
- Teaching materials
- Teacher notes
- Progress tracking
- SMS notifications

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

## 📧 Contact

For questions or support, contact: [your-email]
