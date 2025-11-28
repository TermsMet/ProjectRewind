# ProjectRewind Final Fixes - PowerShell Script
# Run this script to apply the remaining manual updates

Write-Host "Applying final ProjectRewind fixes..." -ForegroundColor Green

$mainJsPath = "frontend\main.js"
$content = Get-Content $mainJsPath -Raw

# Fix 1: Update toggleChatPanel function
Write-Host "1. Updating toggleChatPanel function..." -ForegroundColor Yellow
$oldToggle = @"
// Chat functions
function toggleChatPanel() {
  if (chatPanel.style.display === 'none' || chatPanel.style.display === '') {
    chatPanel.style.display = 'flex';
  } else {
    chatPanel.style.display = 'none';
  }
}
"@

$newToggle = @"
// Chat functions
function toggleChatPanel() {
  chatPanel.classList.toggle('chat-open');
  // Auto-focus input when opening
  if (chatPanel.classList.contains('chat-open')) {
    chatInput.focus();
  }
}
"@

$content = $content -replace [regex]::Escape($oldToggle), $newToggle

# Fix 2: Update appendChatMessage to allow HTML for emojis
Write-Host "2. Updating appendChatMessage for HTML emoji support..." -ForegroundColor Yellow
$content = $content -replace "textSpan\.textContent = `: \`\${text}\`;", "textSpan.innerHTML = ``: `${text.replace(/<(?!\\/?(img)\\b)[^>]+>/g, '')}``;"

# Fix 3: Add joinChannelRoom to playChannel
Write-Host "3. Adding joinChannelRoom call to playChannel..." -ForegroundColor Yellow
$oldPlayChannel = @"
  // Update displayed programme info immediately
  updatePlayerInfo();
}

function showPlayer()
"@

$newPlayChannel = @"
  // Update displayed programme info immediately
  updatePlayerInfo();
  
  // Join the chat room for this channel
  joinChannelRoom(index);
}

function showPlayer()
"@

$content = $content -replace [regex]::Escape($oldPlayChannel), $newPlayChannel

# Fix 4: Initialize chat after authentication
Write-Host "4. Adding chat initialization..." -ForegroundColor Yellow
$oldInit = "initAuth();`r`nstartClock();"
$newInit = @"
initAuth();
startClock();

// Initialize Socket.IO chat after authentication
setTimeout(() => {
  if (getCurrentUser()) {
    initializeChat();
  }
}, 1000);
"@

$content = $content -replace [regex]::Escape($oldInit), $newInit

# Save the updated file
Set-Content $mainJsPath -Value $content -NoNewline

Write-Host "`nAll fixes applied successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Run 'npm install' in the backend directory"
Write-Host "2. Replace placeholder emoji PNGs with actual Cartoon Network images"
Write-Host "3. Run 'docker-compose down && docker-compose up --build'"
Write-Host "`nDone!" -ForegroundColor Green
