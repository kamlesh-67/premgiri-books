$ProjectDir = "D:\My\BPG\design-inspirations-main"
$AppName = "premgiri-books"

Set-Location $ProjectDir

Write-Host "Updating code..."
git fetch origin

$LocalCommit = git rev-parse HEAD
$RemoteCommit = git rev-parse origin/main

if ($LocalCommit -eq $RemoteCommit) {
    Write-Host "No updates found."

    # Ensure app is running
    $Exists = pm2 jlist | ConvertFrom-Json | Where-Object { $_.name -eq $AppName }
    if ($Exists) {
        pm2 start $AppName 2>$null
    } else {
        pm2 start pnpm --name $AppName -- start
    }

    Start-Sleep -Seconds 10
    Start-Process "http://localhost:3000"
    exit
}

Write-Host "New update found. Deploying..."

git reset --hard origin/main

Write-Host "Installing packages..."
pnpm install

Write-Host "Building..."
pnpm run build

Write-Host "Checking PM2 process..."

$Exists = pm2 jlist | ConvertFrom-Json | Where-Object { $_.name -eq $AppName }

if ($Exists) {
    Write-Host "Restarting PM2 app..."
    pm2 restart $AppName
} else {
    Write-Host "Starting PM2 app..."
    pm2 start pnpm --name $AppName -- start
}

pm2 save

Start-Sleep -Seconds 10

Start-Process "http://localhost:3000"
