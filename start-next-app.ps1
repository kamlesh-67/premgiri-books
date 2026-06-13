$ProjectDir = "F:\Premgiri-books\premgiri-books"
$AppName = "premgiri-books"

Set-Location $ProjectDir

# 1. Remove running pm2 task for the project
Write-Host "Stopping and removing existing PM2 process: $AppName..."
pm2 delete $AppName 2>$null

# 2. Start the pm2 task
Write-Host "Starting PM2 task..."
# Using absolute path to pnpm.cmd to fix Windows "Script not found" error
pm2 start ecosystem.config.js
pm2 save

# 3. Get the port from pm2 (Defaulting to 3000 for Next.js)
$Port = 3000
Write-Host "App is starting on port: $Port"

# 4 & 5. Open browser to localhost:port
Write-Host "Opening browser..."
Start-Sleep -Seconds 5
Start-Process "http://localhost:$Port"
