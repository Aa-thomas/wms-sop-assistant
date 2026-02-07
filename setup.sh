#!/bin/bash

# WMS SOP Assistant - Quick Start Setup
# Run this script to set up your development environment

set -e  # Exit on error

echo "🚀 WMS SOP Assistant - Quick Start"
echo "=================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "⚠️  psql not found. Installing postgres client..."
    # macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install libpq
        export PATH="/usr/local/opt/libpq/bin:$PATH"
    # Ubuntu/Debian
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y postgresql-client
    fi
fi

echo "✅ Prerequisites OK"

# Start Postgres
echo ""
echo "🐘 Starting Postgres with pgvector..."

docker run -d \
  --name wms-postgres \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=wms_sop \
  -p 5432:5432 \
  -v wms-pgdata:/var/lib/postgresql/data \
  ankane/pgvector:latest

echo "⏳ Waiting for Postgres to be ready..."
sleep 5

# Check if Postgres is up
until docker exec wms-postgres pg_isready -U postgres > /dev/null 2>&1; do
  echo "   Still waiting..."
  sleep 2
done

echo "✅ Postgres is ready"

# Initialize database
echo ""
echo "📊 Initializing database schema..."

if [ -f "scripts/init_db.sql" ]; then
    PGPASSWORD=dev psql -h localhost -U postgres -d wms_sop -f scripts/init_db.sql
    echo "✅ Database schema created"
else
    echo "⚠️  scripts/init_db.sql not found. You'll need to create it."
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."

npm install

if [ -d "client" ]; then
    echo "   Installing client dependencies..."
    cd client && npm install && cd ..
fi

echo "✅ Dependencies installed"

# Check .env file
echo ""
echo "🔑 Checking environment variables..."

if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your API keys:"
    echo "   - OPENAI_API_KEY"
    echo "   - ANTHROPIC_API_KEY"
    echo ""
    echo "   Then re-run this script."
    exit 1
fi

# Check if API keys are set
if grep -q "sk-proj-" .env && grep -q "sk-ant-" .env; then
    echo "✅ API keys found"
else
    echo "⚠️  API keys not set in .env. Please add:"
    echo "   - OPENAI_API_KEY=sk-proj-..."
    echo "   - ANTHROPIC_API_KEY=sk-ant-..."
    exit 1
fi

# Check for sample data
echo ""
echo "📁 Checking for sample SOPs..."

if [ -z "$(ls -A data/source 2>/dev/null)" ]; then
    echo "⚠️  No PPTX files found in data/source/"
    echo "   Add your WMS SOP PPTX files there, then run:"
    echo "   npm run extract"
    echo "   npm run ingest"
else
    FILE_COUNT=$(ls -1 data/source/*.pptx 2>/dev/null | wc -l)
    echo "✅ Found $FILE_COUNT PPTX file(s)"
    
    # Ask if they want to extract now
    echo ""
    read -p "Extract and ingest SOPs now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run extract
        npm run ingest
        echo "✅ SOPs ingested"
    fi
fi

# Done
echo ""
echo "=================================="
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start the dev server:"
echo "     npm run dev"
echo ""
echo "  2. Open http://localhost:5173"
echo ""
echo "  3. Ask a test question from data/test-questions.md"
echo ""
echo "Useful commands:"
echo "  npm run extract  - Extract text from PPTX files"
echo "  npm run ingest   - Embed and load into Postgres"
echo "  npm run dev      - Start frontend + backend"
echo ""
echo "Database connection:"
echo "  psql -h localhost -U postgres -d wms_sop"
echo "  (password: dev)"
echo ""
echo "🚀 Happy building!"
