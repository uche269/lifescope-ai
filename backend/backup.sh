#!/bin/bash

# ==============================================================================
# Database Backup Script to Backblaze B2
# ==============================================================================
# This script creates a compressed dump of the PostgreSQL database and
# uploads it to a Backblaze B2 bucket using the AWS CLI.
# ==============================================================================

# Database Configuration
DB_USER="postgres" # Update if your db user is different
DB_NAME="postgres" # Update if your db name is different
DB_HOST="localhost"

# Backblaze B2 Configuration
B2_BUCKET="lifescope-db-backups"
B2_ENDPOINT="https://s3.us-east-005.backblazeb2.com"

# Backup Information
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="/tmp/pg_backups"
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting database backup at $(date)..."

# 1. Create a compressed database dump
# We use pg_dump to extract the database and gzip to compress it
pg_dump -U "$DB_USER" -h "$DB_HOST" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Database dumped successfully: $BACKUP_FILE"
else
    echo "❌ Database dump failed!"
    exit 1
fi

# 2. Upload to Backblaze B2 using AWS CLI
echo "Uploading to Backblaze B2..."
aws s3 cp "$BACKUP_FILE" "s3://$B2_BUCKET/db_backup_$TIMESTAMP.sql.gz" --endpoint-url "$B2_ENDPOINT"

if [ $? -eq 0 ]; then
    echo "✅ Upload successful!"
else
    echo "❌ Upload failed!"
    # Don't delete the local file if upload failed so we can investigate
    exit 1
fi

# 3. Clean up the local backup file to save VPS disk space
echo "Cleaning up local file: $BACKUP_FILE"
rm "$BACKUP_FILE"

# Optional: Output the current contents of the bucket to verify
echo "Current backups in bucket:"
aws s3 ls "s3://$B2_BUCKET/" --endpoint-url "$B2_ENDPOINT"

echo "Backup process completed successfully at $(date)."
