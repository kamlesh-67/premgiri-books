$ProjectDir = "C:\apps\my-next-app"

Set-Location $ProjectDir

Write-Host "Updating code..."
git fetch origin
git reset --hard origin/main

Write-Host "Installing packages..."
npm install

Write-Host "Building..."
npm run build

Write-Host "Starting production server..."

Start-Process powershell -ArgumentList `
"-NoExit", `
"-Command", `
"cd '$ProjectDir'; npm run start"

Start-Sleep -Seconds 15

Start-Process "http://localhost:3000"