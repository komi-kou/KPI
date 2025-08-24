# Optimized Sales KPI Tracker

An optimized version of the Sales KPI Tracker with fast startup times using Vite for the frontend.

## Features

- **Fast Development**: Uses Vite instead of Create React App for much faster startup
- **Optimized Structure**: Clean separation between backend and frontend
- **Same Functionality**: All original features preserved
- **Easy Setup**: One-click start with the provided script

## Quick Start

1. **Run the application**:
   ```bash
   ./start.sh
   ```

2. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5001

## Manual Setup

If you prefer to start servers manually:

### Backend (Port 5001)
```bash
cd backend
npm install
npm start
```

### Frontend (Port 3000)
```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
sales-kpi-app/
├── backend/
│   ├── server.js          # Main backend server
│   ├── package.json       # Backend dependencies
│   ├── .env              # Backend environment variables
│   └── *.db              # SQLite database files
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── App.tsx       # Main App component
│   │   ├── main.tsx      # Vite entry point
│   │   └── config.ts     # Configuration
│   ├── package.json      # Frontend dependencies
│   ├── vite.config.ts    # Vite configuration
│   └── .env             # Frontend environment variables
├── start.sh             # One-click startup script
└── README.md            # This file
```

## Key Optimizations

- **Vite**: Replaces Create React App for ~10x faster startup
- **Proper CORS**: Configured for seamless API communication
- **Port Configuration**: Backend on 5001, Frontend on 3000
- **Environment Variables**: Proper configuration management
- **Unified Startup**: Single script to start both servers

## Development

- Backend runs on port 5001 with auto-restart on file changes
- Frontend runs on port 3000 with hot module replacement
- All original features and UI/UX preserved