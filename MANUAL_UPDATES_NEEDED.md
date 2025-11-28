# ProjectRewind Final Manual Updates

## Remaining JavaScript Updates Needed in frontend/main.js

### 1. Update toggleChatPanel function (around line 504)

Replace:
```javascript
function toggleChatPanel() {
  if (chatPanel.style.display === 'none' || chatPanel.style.display === '') {
    chatPanel.style.display = 'flex';
  } else {
    chatPanel.style.display = 'none';
  }
}
```

With:
```javascript
function toggleChatPanel() {
  chatPanel.classList.toggle('chat-open');
  // Auto-focus input when opening
  if (chatPanel.classList.contains('chat-open')) {
    chatInput.focus();
  }
}
```

### 2. Update appendChatMessage to allow HTML for emoji images (around line 533)

Change this line:
```javascript
textSpan.textContent = `: ${text}`;
```

To:
```javascript
// Allow HTML for emoji images but sanitize other content
textSpan.innerHTML = `: ${text.replace(/<(?!\\/?(img)\\b)[^>]+>/g, '')}`;
```

### 3. Add joinChannelRoom call to playChannel function (around line 1319)

After:
```javascript
  // Update displayed programme info immediately
  updatePlayerInfo();
}
```

Add before the closing brace:
```javascript
  // Join the chat room for this channel
  joinChannelRoom(index);
```

### 4. Initialize chat after authentication (around line 1728, end of file)

After:
```javascript
initAuth();
startClock();
```

Add:
```javascript
// Initialize Socket.IO chat after authentication
setTimeout(() => {
  if (getCurrentUser()) {
    initializeChat();
  }\n}, 1000);
```

### 5. Remove renderChatMessages function calls

The `renderChatMessages()` function is no longer needed. If there are any calls to it in the code (check lines with mute/unmute), you can remove those calls as Socket.IO handles message rendering automatically.

## CSS Manual Fix (if needed)

### Update mini-top .icon styling for SVG support (around line 898-909)

Replace:
```css
.mini-top .icon {
  margin-left: 16px;
  cursor: pointer;
  /* When using image icons, font-size doesn't apply */
  font-size: 0;
}

/* Style for image icons used in the mini-guide top bar */
.icon-img {
  width: 20px;
  height: 20px;
  display: block;
}
```

With:
```css
.mini-top .icon {
  margin-left: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-dark);
  transition: color 0.2s;
}

.mini-top .icon:hover {
  opacity: 0.7;
}

.mini-top .icon svg {
  display: block;
}
```

## Testing Checklist

1. **Install Dependencies**: Run `npm install` in the `backend` directory to install Socket.IO
2. **Replace Emoji Images**: Replace the placeholder PNG files in `frontend/assets/emojis/` with actual Cartoon Network emoji images
3. **Test EPG Matching**: Verify that channels with tvg-id attributes match EPG data correctly
4. **Test Timezone Parsing**: Check that EPG times display correctly for your timezone
5. **Test Chat**: 
   - Verify chat is hidden by default
   - Click message icon to open/close chat with smooth animation
   - Send messages and verify they appear in real-time
   - Switch channels and verify chat history changes per channel
   - Test local emoji picker with image-based emojis
6. **Test Icons**: Verify SVG icons display correctly in fullscreen mode and adapt to dark theme
7. **Restart Docker**: Run `docker-compose down && docker-compose up --build` to rebuild with new dependencies

## Known Issues / Notes

- Placeholder emoji images are SVG text representations - replace with actual PNG images
- Chat history is stored in memory per server restart (ephemeral)
- Mute/unmute functionality is client-side only in current implementation
- renderChatMessages() function still exists but should no longer be called (check for any remaining calls)
