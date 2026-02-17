#!/bin/bash
set -e

# Configuration
REPO_URL="git@github.com:uche269/lifescope-ai.git"
APP_DIR="/opt/lifescope"

echo "=== deployment started ==="

# 1. Install Dependencies (Git, Docker)
if ! command -v git &> /dev/null; then
    echo "Installing Git..."
    apt-get update && apt-get install -y git
fi

if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
fi

# 2. Setup Directory & Clone
if [ -d "$APP_DIR" ]; then
    echo "Updating existing repository..."
    cd "$APP_DIR"
    git pull
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 3. Environment Configuration
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat <<EOT >> .env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://lifescope_user:Nuujj78rfw@76.13.48.189:5432/lifescope
# Add your Google Auth keys here
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=$(openssl rand -hex 32)
EOT
    echo "⚠️  CREATED .env FILE. PLEASE EDIT IT NOW TO ADD GOOGLE KEYS!"
    echo "Run: nano .env"
    exit 0
fi

# 4. Build and Launch
echo "Building and starting containers..."
docker compose up -d --build

echo "=== Deployment Complete! ==="
echo "Your app should be running on Port 80."
