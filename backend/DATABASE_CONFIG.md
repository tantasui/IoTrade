# Database Configuration Guide

## ⚠️ Important: Two Database URLs Needed

You need **TWO** different database URLs:

### 1. Direct Database URL (for migrations)
```bash
# This should be your actual PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

### 2. Prisma Accelerate URL (for queries - optional)
```bash
# This is your Prisma Accelerate connection string
PRISMA_ACCELERATE_URL="prisma://accelerate.prisma-data.net/?api_key=xxx"
```

## 🔧 Current Issue

Your `.env` currently has:
- `DATABASE_URL` set to Prisma Accelerate URL

**Problem**: Migrations need a direct PostgreSQL connection, not Accelerate.

## ✅ Solution

Update your `.env` file:

```bash
# Direct PostgreSQL connection (for migrations and as fallback)
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Prisma Accelerate (optional, for production queries)
PRISMA_ACCELERATE_URL="prisma://accelerate.prisma-data.net/?api_key=xxx"
```

## 🚀 Migration Steps

1. **Set Direct DATABASE_URL** in `.env`
2. **Run migration**:
   ```bash
   npm run prisma:migrate
   ```
3. **After migration succeeds**, you can use Accelerate URL for queries

## 📝 Note

- **Migrations**: Always use direct `DATABASE_URL`
- **Queries**: Can use either direct or Accelerate
- **Development**: Direct connection is fine
- **Production**: Use Accelerate for better performance

