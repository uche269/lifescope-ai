#!/bin/bash
set -e

# 1. Install Docker & Docker Compose
echo "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 2. Firewall Setup (UFW)
echo "Configuring Firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
# Allow Postgres from User IP only (Optional - simpler to keep internal for now)
# ufw allow from 102.219.153.222 to any port 5432
ufw --force enable

# 3. Create Project Directory
mkdir -p /opt/lifescope
cd /opt/lifescope

# 4. Create .env file with placeholders (User must fill these)
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat <<EOT >> .env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=$(openssl rand -hex 32)
EOT
    echo "⚠️  PLEASE EDIT .env FILE WITH YOUR REAL GOOGLE CREDENTIALS!"
fi

echo "Setup Complete! "
echo "Next steps:"
echo "1. Upload your code to /opt/lifescope"
echo "2. Edit .env with nano .env"
echo "3. Run: docker compose up -d"
