# Koyeb Database Connection Setup

## Environment Variables

Add these to your `.env` file:

```bash
DATABASE_HOST=ep-autumn-silence-a2bld6od.eu-central-1.pg.koyeb.app
DATABASE_USER=koyeb-adm
DATABASE_NAME=koyebdb
DATABASE_PASSWORD=your_password_here

# Prisma DATABASE_URL (constructed from above)
DATABASE_URL="postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:5432/${DATABASE_NAME}?sslmode=require"
```

## Quick Setup Script

Run this to set up your DATABASE_URL:

```bash
cd backend
# Replace YOUR_PASSWORD with your actual password
export DATABASE_PASSWORD="YOUR_PASSWORD"
echo "DATABASE_URL=\"postgresql://koyeb-adm:${DATABASE_PASSWORD}@ep-autumn-silence-a2bld6od.eu-central-1.pg.koyeb.app:5432/koyebdb?sslmode=require\"" >> .env
```

## Steps to Connect

1. **Add your password to .env:**
   ```bash
   # Edit .env and add:
   DATABASE_PASSWORD=your_actual_password
   ```

2. **Generate DATABASE_URL:**
   ```bash
   cd backend
   # Replace YOUR_PASSWORD with your actual password
   echo 'DATABASE_URL="postgresql://koyeb-adm:YOUR_PASSWORD@ep-autumn-silence-a2bld6od.eu-central-1.pg.koyeb.app:5432/koyebdb?sslmode=require"' >> .env
   ```

3. **Run migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

5. **Start server:**
   ```bash
   npm run dev
   ```

## Testing Connection

You can test the connection with:

```bash
npx prisma db pull
```

If successful, you'll see your schema structure.

