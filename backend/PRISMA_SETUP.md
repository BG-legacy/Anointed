# 🧬 Prisma Schema & Database Setup

## Overview

This project uses **Prisma ORM** for database management with PostgreSQL. The schema includes comprehensive user management with UUID primary keys, timestamps, and soft delete functionality.

## 📋 Models

### User Model
- **Primary Key**: UUID
- **Features**: Soft deletes, timestamps
- **Fields**:
  - `id` (UUID, PK)
  - `email` (String, unique, required)
  - `passwordHash` (String, required)
  - `displayName` (String, optional)
  - `avatarUrl` (String, optional)
  - `tz` (String, optional) - Timezone preference
  - `createdAt` (DateTime)
  - `updatedAt` (DateTime)
  - `deletedAt` (DateTime, optional) - Soft delete

### UserSettings Model
- **Primary Key**: `userId` (references User)
- **Features**: One-to-one with User, cascade delete
- **Fields**:
  - `userId` (UUID, PK, FK to User)
  - `bibleTranslation` (String, optional) - e.g., "NIV", "ESV"
  - `denomination` (String, optional) - e.g., "Baptist", "Methodist"
  - `quietTimeStart` (String, optional) - e.g., "06:00"
  - `quietTimeEnd` (String, optional) - e.g., "07:00"
  - `pushOptIn` (Boolean, default: true)
  - `createdAt` (DateTime)
  - `updatedAt` (DateTime)

### Device Model
- **Primary Key**: UUID
- **Features**: Push notification management, unique constraint
- **Fields**:
  - `id` (UUID, PK)
  - `userId` (UUID, FK to User)
  - `platform` (String) - e.g., "ios", "android", "web"
  - `pushToken` (String)
  - `lastSeenAt` (DateTime, optional)
  - `createdAt` (DateTime)
  - `updatedAt` (DateTime)
- **Constraints**: Unique combination of `userId` + `pushToken`

## 🚀 Setup & Usage

### Initial Setup

1. **Install Dependencies**:
   ```bash
   npm install prisma @prisma/client
   ```

2. **Environment Configuration**:
   ```bash
   # Copy .env.example to .env and configure DATABASE_URL
   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/anointed
   ```

3. **Generate Prisma Client**:
   ```bash
   npm run db:generate
   ```

4. **Run Migrations**:
   ```bash
   npm run db:migrate
   ```

### Available Scripts

```bash
# Generate Prisma client
npm run db:generate

# Create and apply migration
npm run db:migrate

# Reset database (DEVELOPMENT ONLY)
npm run db:reset

# Deploy migrations (production)
npm run db:deploy

# Open Prisma Studio
npm run db:studio
```

## 🏗️ Repository Classes

### UserRepository

```javascript
import { UserRepository } from '../repositories/index.js';

const userRepo = new UserRepository();

// Create user
const user = await userRepo.create({
  email: 'user@example.com',
  passwordHash: 'hashedPassword',
  displayName: 'John Doe'
});

// Find user (excludes soft deleted)
const user = await userRepo.findByEmail('user@example.com');

// Soft delete
await userRepo.softDelete(userId);

// Restore soft deleted user
await userRepo.restore(userId);
```

### UserSettingsRepository

```javascript
import { UserSettingsRepository } from '../repositories/index.js';

const settingsRepo = new UserSettingsRepository();

// Upsert settings
const settings = await settingsRepo.upsert(userId, {
  bibleTranslation: 'NIV',
  denomination: 'Baptist',
  quietTimeStart: '06:00',
  quietTimeEnd: '07:00',
  pushOptIn: true
});
```

### DeviceRepository

```javascript
import { DeviceRepository } from '../repositories/index.js';

const deviceRepo = new DeviceRepository();

// Register device
const device = await deviceRepo.upsert(userId, pushToken, {
  platform: 'ios'
});

// Get push tokens for user
const tokens = await deviceRepo.getPushTokensForUser(userId);
```

## 🔧 Prisma Client Service

The `prismaService` provides a singleton instance with connection management:

```javascript
import prismaService from '../services/prisma.js';

// Connect to database
await prismaService.connect();

// Health check
const isHealthy = await prismaService.healthCheck();

// Get raw client
const client = prismaService.getClient();
```

## 📊 Database Schema

The generated SQL creates the following tables:

- `users` - User accounts with soft delete support
- `user_settings` - User preferences and settings
- `devices` - Device registration for push notifications

### Key Features:

✅ **UUID Primary Keys**: All models use UUIDs for better scalability  
✅ **Timestamps**: Automatic `createdAt` and `updatedAt` fields  
✅ **Soft Deletes**: Users can be soft deleted with `deletedAt` field  
✅ **Cascade Deletes**: Settings and devices are cleaned up when user is deleted  
✅ **Unique Constraints**: Prevent duplicate device registrations  
✅ **Foreign Key Relationships**: Proper referential integrity  

## 🧪 Testing

Run the Prisma integration tests:

```bash
npm run test:unit -- --testNamePattern="Prisma"
```

The test suite covers:
- Database connectivity
- CRUD operations for all models
- Soft delete functionality
- Repository methods
- Relationship handling

## 🔒 Security Notes

- All passwords are stored as hashes (never plaintext)
- Soft deletes ensure data can be recovered if needed
- Push tokens are unique per user to prevent conflicts
- Cascade deletes maintain data integrity

## 📈 Performance Considerations

- UUID primary keys for horizontal scaling
- Indexes on frequently queried fields (email, push tokens)
- Efficient repository patterns
- Connection pooling via Prisma
- Prepared statements for security and performance

