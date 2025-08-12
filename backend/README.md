# Anointed Backend API

A modern Express.js API with PostgreSQL 16, Redis 7, comprehensive testing, and CI/CD pipeline.

## Features

- **Express 5** with modern ES modules
- **PostgreSQL 16** with connection pooling
- **Redis 7** for caching and sessions
- **Health Check Endpoints** (`/api/v1/healthz`, `/api/v1/readyz`, `/api/v1/version`)
- **Comprehensive Testing** with unit tests and Testcontainers integration tests
- **GitHub Actions CI/CD** pipeline
- **Docker Compose** for local development
- **Security** with Helmet and CORS
- **Logging** with Pino
- **Linting** with ESLint and Prettier

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Git

### Development Setup

1. **Clone and setup environment:**
   ```bash
   cd backend
   cp .env.example .env
   npm install
   ```

2. **Start services with Docker Compose:**
   ```bash
   cd ..  # Go to project root
   docker-compose up -d postgres redis
   ```

3. **Start development server:**
   ```bash
   cd backend
   npm run dev
   ```

4. **Access the API:**
   - Health Check: http://localhost:3000/api/v1/healthz
   - Readiness Check: http://localhost:3000/api/v1/readyz
   - Version Info: http://localhost:3000/api/v1/version

### Full Stack with Docker

```bash
# Start all services including backend
docker-compose up --build

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## API Endpoints

### Health Checks

- `GET /api/v1/healthz` - Basic health check
- `GET /api/v1/readyz` - Readiness check (includes DB and Redis status)
- `GET /api/v1/version` - Version and system information

### Legacy

- `GET /health` - Legacy health endpoint
- `GET /api` - Welcome message

## Testing

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests (with Testcontainers)
```bash
npm run test:integration
```

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage
```bash
npm run test:coverage
```

## Database

### Connection
The app automatically connects to PostgreSQL using the `DATABASE_URL` environment variable.

### Migrations
Initial database schema is created via `scripts/init.sql` when the container starts.

### Manual Database Operations
```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d anointed

# Run queries
SELECT * FROM users;
```

## Redis

### Connection
The app connects to Redis using the `REDIS_URL` environment variable.

### Manual Redis Operations
```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Test operations
SET test "Hello Redis"
GET test
```

## Environment Variables

See `.env.example` for all available configuration options:

- **Server**: `PORT`, `NODE_ENV`, `LOG_LEVEL`
- **Database**: `DATABASE_URL`, `DB_MAX_CONNECTIONS`
- **Redis**: `REDIS_URL`
- **JWT**: `JWT_SECRET`, `JWT_EXPIRES_IN`, etc.
- **Supabase**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, etc.

## CI/CD Pipeline

The GitHub Actions pipeline includes:

1. **Install** dependencies
2. **Lint** code (ESLint + Prettier)
3. **Unit Tests** 
4. **Integration Tests** with Testcontainers
5. **Security Scan** with npm audit
6. **Docker Build** test
7. **Deploy** (staging/production)

### Pipeline Triggers
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

## Development Scripts

```bash
# Development
npm run dev          # Start with hot reload
npm start           # Start production server

# Testing
npm test            # Run all tests
npm run test:unit   # Unit tests only
npm run test:integration  # Integration tests only
npm run test:watch  # Watch mode
npm run test:coverage     # With coverage

# Code Quality
npm run lint        # Check linting
npm run lint:fix    # Fix linting issues
npm run format      # Format code
npm run format:check      # Check formatting
```

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Database, Redis, etc.
│   ├── tests/          # Test files
│   │   ├── unit/       # Unit tests
│   │   ├── integration/ # Integration tests
│   │   └── setup.js    # Test setup
│   ├── types/          # Type definitions
│   ├── utils/          # Utilities
│   └── server.js       # Main server file
├── scripts/            # Database scripts
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Local development
└── package.json        # Dependencies
```

## Services Architecture

```mermaid
graph TB
    Client[Client] --> LB[Load Balancer]
    LB --> API[Express API]
    API --> DB[(PostgreSQL 16)]
    API --> Cache[(Redis 7)]
    API --> Logs[Logging]
    
    subgraph "Health Checks"
        API --> Health[/healthz]
        API --> Ready[/readyz]
        API --> Version[/version]
    end
    
    subgraph "External Services"
        API --> Supabase[Supabase Storage]
        API --> Email[Email Service]
    end
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps postgres
   
   # Check logs
   docker-compose logs postgres
   ```

2. **Redis Connection Failed**
   ```bash
   # Check if Redis is running
   docker-compose ps redis
   
   # Test connection
   docker-compose exec redis redis-cli ping
   ```

3. **Tests Failing**
   ```bash
   # Make sure Docker is running for integration tests
   docker --version
   
   # Clean and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Port Already in Use**
   ```bash
   # Kill process using port 3000
   lsof -ti:3000 | xargs kill -9
   ```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the ISC License.
