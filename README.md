# Plaid Bank App

A minimalistic bank application built with a monorepository structure, featuring Next.js 16 with shadcn/ui for the frontend and Flask with Plaid API integration for the backend.

## 🏗️ Project Structure

```
plaid-bank-app/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── app/            # Next.js App Router
│   │   ├── components/     # React components
│   │   │   ├── ui/        # shadcn components
│   │   │   └── bank/      # Custom bank components
│   │   └── lib/           # Utilities and API client
│   │
│   └── api/                # Flask backend
│       ├── app/
│       │   ├── handlers/  # Business logic
│       │   ├── routes/    # API endpoints
│       │   └── models/    # Data models
│       └── requirements.txt
│
└── package.json           # Root workspace config
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ and npm
- **Python** 3.10+ and pip
- **Plaid Account** (Sandbox credentials)

### 1. Clone and Install

```bash
# Install frontend dependencies
cd apps/web
npm install

# Install backend dependencies (after Python installation)
cd ../api
python -m venv venv
# Windows PowerShell
.\venv\Scripts\Activate.ps1
# Windows CMD / Git Bash
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Get Plaid Sandbox Credentials

1. Sign up at [Plaid Dashboard](https://dashboard.plaid.com/signup)
2. Navigate to Team Settings > Keys
3. Copy your `client_id` and `sandbox` secret

### 3. Configure Environment Variables

**Frontend** (`apps/web/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**Backend** (`apps/api/.env`):
```env
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_sandbox_secret_here
PLAID_ENV=sandbox
```

### 4. Run the Application

**Terminal 1 - Frontend:**
```bash
cd apps/web
npm run dev
```
Frontend runs at [http://localhost:3000](http://localhost:3000)

**Terminal 2 - Backend:**
```bash
cd apps/api
# Activate virtual environment first
python run.py
```
Backend runs at [http://localhost:5000](http://localhost:5000)

## 🧪 Testing with Plaid Sandbox

### Test Credentials
- **Username:** `user_good`
- **Password:** `pass_good`
- **MFA Code:** `1234`

### Specialized Test Users
- `user_transactions_dynamic` - Realistic transactions
- `user_bank_income` - Various income streams
- `user_credit_profile_good` - Good credit profile

### Error Simulation
Use passwords like `error_INVALID_CREDENTIALS` to test error handling.

## 📚 API Endpoints

### Plaid Routes
- `POST /api/plaid/create-link-token` - Create Plaid Link token
- `POST /api/plaid/exchange-token` - Exchange public token
- `POST /api/plaid/sync-transactions/:item_id` - Sync transactions

### Accounts Routes
- `GET /api/accounts` - Get all accounts
- `GET /api/accounts/:id` - Get specific account

### Transactions Routes
- `GET /api/transactions` - Get all transactions
- `GET /api/transactions?account_id=:id` - Filter by account

## 🎨 Features

- ✅ Plaid Sandbox integration
- ✅ Account linking via Plaid Link
- ✅ Real-time balance display
- ✅ Transaction history
- ✅ Minimalistic UI with shadcn/ui (Tailwind v4)
- ✅ Dark mode support
- ✅ Responsive design
- ⏸️ MongoDB integration (planned)
- ⏸️ User authentication (planned)

## 🛠️ Tech Stack

**Frontend:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui components
- react-plaid-link
- axios

**Backend:**
- Flask 3.0
- Plaid Python SDK
- Flask-CORS
- python-dotenv
- (MongoDB - to be added)

## 📝 Notes

- Currently using in-memory storage for development
- MongoDB will be integrated in a future update
- All Plaid operations use Sandbox environment
- Database setup instructions in `apps/api/SETUP.md`

## 🤝 Contributing

This is a personal project. Feel free to fork and modify for your own use.

## 📄 License

See LICENSE file for details.


