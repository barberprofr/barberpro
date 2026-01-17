# BarberPro - Salon Management Platform

## Overview
BarberPro is a fullstack salon management application built with React (Vite) frontend and Express backend, using MongoDB Atlas for data storage.

## Project Structure
```
├── client/           # React frontend (Vite)
│   ├── components/   # UI components (Radix UI, custom)
│   ├── hooks/        # React hooks
│   ├── lib/          # API utilities, types
│   ├── pages/        # Page components (Login, Index, Settings, etc.)
│   └── App.tsx       # Main application entry
├── server/           # Express backend
│   ├── routes/       # API route handlers
│   ├── db.ts         # MongoDB connection
│   └── index.ts      # Server setup
├── shared/           # Shared types between client/server
└── public/           # Static assets (PWA manifest, icons)
```

## Tech Stack
- **Frontend**: React 18, Vite, TailwindCSS, Radix UI, Framer Motion
- **Backend**: Express 5, Mongoose (MongoDB)
- **Payments**: Stripe integration
- **Build**: Vite for both client bundling and server build

## Development
- Run `npm run dev` to start the development server (port 5000)
- The Vite dev server includes the Express backend via plugin

## Environment Variables Required
- `MONGODB_URI` - MongoDB Atlas connection string
- `STRIPE_SECRET_KEY` - Stripe secret API key (for payments)
- `STRIPE_PRICE_ID` - Stripe subscription price ID
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `STRIPE_PORTAL_RETURN_URL` - Return URL for Stripe customer portal

## Production Build
- `npm run build` - Builds both client and server
- `npm run start` - Runs the production server

## Key Features
- Salon appointment management
- Stylist commission tracking
- Client loyalty points program
- Subscription billing via Stripe
- PDF/CSV export for reports
- PWA support
- **Automatic language switching**: Interface switches to English when USD currency is selected, French for all other currencies

## Internationalization (i18n)
The app uses an automatic language system based on the selected currency:
- **USD** → English interface
- **All other currencies** (EUR, MAD, GBP, DZD, CHF) → French interface

Translation system located in `client/lib/i18n.ts` with categories:
- `nav`: Navigation elements
- `salon`: Services, products, stylists
- `payment`: Payment methods
- `client`: Client management
- `stats`: Statistics and reports
- `settings`: Configuration options
