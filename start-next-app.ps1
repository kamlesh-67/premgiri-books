$ProjectDir = "F:\Premgiri-books\premgiri-books"
$AppName = "premgiri-books"

Set-Location $ProjectDir

Write-Host "Updating code..."
git fetch origin

$LocalCommit = git rev-parse HEAD
$RemoteCommit = git rev-parse origin/main

if ($LocalCommit -eq $RemoteCommit) {
    Write-Host "No updates found."

    # Ensure app is running
    pm2 start npm --name $AppName -- start 2>$null

    Start-Sleep -Seconds 10
    Start-Process "http://localhost:3000"
    exit
}

Write-Host "New update found. Deploying..."

git reset --hard origin/main

Write-Host "Installing packages..."
npm install

Write-Host "Building..."
npm run build

Write-Host "Checking PM2 process..."

$Exists = pm2 jlist | ConvertFrom-Json | Where-Object { $_.name -eq $AppName }

if ($Exists) {
    Write-Host "Restarting PM2 app..."
    pm2 restart $AppName
}
else {
    Write-Host "Starting PM2 app..."
    pm2 start npm --name $AppName -- start
}

pm2 save

Start-Sleep -Seconds 10

Start-Process "http://localhost:3000"