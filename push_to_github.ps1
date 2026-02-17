# PowerShell Script to Push Changes to GitHub

$RepoUrl = "https://github.com/Start-End-2025/lifescope-ai.git"

Write-Host "=== Git Automation Started ===" -ForegroundColor Cyan

# 1. Initialize Git if needed
if (-not (Test-Path ".git")) {
    Write-Host "Initializing Git repository..."
    git init
    git branch -M main
    git remote add origin $RepoUrl
} else {
    # Check if remote exists, if not add it
    $remotes = git remote
    if ($remotes -notcontains "origin") {
        Write-Host "Adding remote origin..."
        git remote add origin $RepoUrl
    }
}

# 2. Add all files
Write-Host "Adding files..."
git add .

# 3. Commit
Write-Host "Committing changes..."
git commit -m "Configure production deployment with remote DB"

# 4. Push
Write-Host "Pushing to GitHub..."
git push -u origin main

Write-Host "=== Git Push Complete! ===" -ForegroundColor Green
Write-Host "You can now proceed to SSH into your VPS."
