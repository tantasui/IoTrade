#!/bin/bash
# Helper script to set up Koyeb DATABASE_URL

cd "$(dirname "$0")"

# Check if password is provided as argument
if [ -z "$1" ]; then
  echo "Usage: ./setup-koyeb-db.sh YOUR_PASSWORD"
  echo ""
  echo "Or set DATABASE_PASSWORD in .env and run:"
  echo "  DATABASE_PASSWORD=your_password ./setup-koyeb-db.sh"
  exit 1
fi

PASSWORD="$1"

# Construct DATABASE_URL
DATABASE_URL="postgresql://koyeb-adm:${PASSWORD}@ep-autumn-silence-a2bld6od.eu-central-1.pg.koyeb.app:5432/koyebdb?sslmode=require"

# Remove old DATABASE_URL if exists
sed -i '/^DATABASE_URL=/d' .env

# Add new DATABASE_URL
echo "DATABASE_URL=\"${DATABASE_URL}\"" >> .env

echo "✅ DATABASE_URL configured!"
echo ""
echo "Next steps:"
echo "  1. Run: npx prisma migrate dev --name init"
echo "  2. Run: npx prisma generate"
echo "  3. Run: npm run dev"

