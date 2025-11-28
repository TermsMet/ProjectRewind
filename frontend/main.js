/*
 * main.js
 *
 * This script powers the frontend for the ersatzrv DirecTV‑inspired IPTV guide. It fetches
 * channel data from the backend, renders an interactive list of channels, and
 * manages video playback with a DirecTV‑style control bar and mini guide. Keyboard
 * navigation and mouse interactions are implemented to make the UI feel similar
 * to the classic set‑top box experience.
 */

// Elements for the new guide layout
const wrapper = document.getElementById('wrapper');
const guideContainer = document.getElementById('guide-container');
const headerEl = document.getElementById('header');
const showTitleEl = document.getElementById('show-title');
const currentDateEl = document.getElementById('current-date');
const timeRangeEl = document.getElementById('time-range');
const ratingEl = document.getElementById('rating');
const descriptionEl = document.getElementById('description-text');
const descriptionBar = document.getElementById('description');
const timelineEl = document.getElementById('timeline');
const gridEl = document.getElementById('program-grid');
const legendLeftEl = document.querySelector('#legend .legend-left');

// ---------------------------------------------------------------------------
// Default admin configuration
//
// Precomputed SHA‑256 hash for the default admin password. A new random
// password matching this hash will be provided separately.
// Default admin password hash.  The password corresponding to this hash
// will be provided alongside the application package.  To change the
// default admin password simply compute a new SHA‑256 hash and replace
// the string below.  See README for details.
const DEFAULT_ADMIN_HASH = '31cd856f8bc51882f801f67748fa91cab1ef3b8f8fa5780faacbb81f0001e53a';

// Options modal button
const optionsBtn = document.getElementById('open-options');

const playerOverlay = document.getElementById('player-overlay');
const video = document.getElementById('player');
const playPauseBtn = document.getElementById('play-pause-btn');
// Elements for the dynamic DVR overlay (replaces the static image)
const dvrOverlay = document.getElementById('dvr-overlay');
const dvrStartEl = document.getElementById('dvr-start');
const dvrTitleEl = document.getElementById('dvr-title');
const dvrEndEl = document.getElementById('dvr-end');

// Image element inside the DVR controls used to display the channel logo when
// watching a programme. This element lives in the left side of the DVR
// controls next to the elapsed timer. A fallback logo is used if no
// programme or channel icon is available.
const dvrLogoImg = document.querySelector('#dvr-controls .dvr-left img');

// Elements for the options modal
const optionsModal = document.getElementById('options-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const m3uInput = document.getElementById('m3u-input');
const epgInput = document.getElementById('epg-input');
const optionsSaveBtn = document.getElementById('options-save');
const optionsCancelBtn = document.getElementById('options-cancel');
const showNameEl = document.getElementById('show-name');
const elapsedEl = document.getElementById('elapsed-time');
const progressBar = document.getElementById('progress-bar');
const currentPositionEl = document.getElementById('current-position');
const durationEl = document.getElementById('duration');

const miniGuide = document.getElementById('mini-guide');
const miniChannelsEl = document.getElementById('mini-channels');
const muteBtn = document.getElementById('mute-btn');
const messageBtn = document.getElementById('message-btn');
const lockBtn = document.getElementById('lock-btn');
const prevChannelBtn = document.getElementById('prev-channel');
const nextChannelBtn = document.getElementById('next-channel');
const optionsMiniBtn = document.getElementById('options-mini');
const miniGuideBtn = document.getElementById('mini-guide-btn');
const miniMessage = document.getElementById('mini-message');

// Elements for authentication, user management and chat
const loginScreen = document.getElementById('login-screen');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-button');
const loginErrorEl = document.getElementById('login-error');
const manageUsersBtn = document.getElementById('manage-users-btn');
const userModal = document.getElementById('user-modal');
const userListEl = document.getElementById('user-list');
const newUsernameInput = document.getElementById('new-username');
const newPasswordInput = document.getElementById('new-password');
const newRoleSelect = document.getElementById('new-role');
const userCancelBtn = document.getElementById('user-cancel');
const userSaveBtn = document.getElementById('user-save');
const chatPanel = document.getElementById('chat-panel');
const chatMessagesEl = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send');

// Simple emoji picker: a small row of buttons that insert emojis into the chat input.
const emojiBar = document.getElementById('chat-emoji-bar');
if (emojiBar && chatInput) {
  const emojis = [
    { name: 'courage-scream', file: 'courage-scream.png' },
    { name: 'dexter-omelette', file: 'dexter-omelette.png' },
    { name: 'plank-cry', file: 'plank-cry.png' },
    { name: 'him-evil', file: 'him-evil.png' },
    { name: 'grim-billy', file: 'grim-billy.png' },
    { name: 'father-silhouette', file: 'father-silhouette.png' },
    { name: 'johnny-bravo', file: 'johnny-bravo.png' },
    { name: 'mojo-jojo', file: 'mojo-jojo.png' },
    { name: 'chicken-cow', file: 'chicken-cow.png' },
    { name: 'scooby-scared', file: 'scooby-scared.png' },
    { name: 'powerpuff-fight', file: 'powerpuff-fight.png' },
    { name: 'ed-eddy-roll', file: 'ed-eddy-roll.png' }
  ];
  emojis.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn';
    const img = document.createElement('img');
    img.src = `/assets/emojis/${emoji.file}`;
    img.alt = emoji.name;
    img.style.width = '36px';
    img.style.height = '36px';
    img.style.display = 'block';
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      chatInput.value = chatInput.value + ` <img src="/assets/emojis/${emoji.file}" alt="${emoji.name}" class="chat-emoji"> `;
      chatInput.focus();
    });
    emojiBar.appendChild(btn);
  });
}

// Socket.IO client for per-channel chat
let socket = null;
let currentChatRoom = null;
let userMuteStatus = { muted: false, until: 0, room: null };

// Initialize Socket.IO connection
function initializeChat() {
  if (socket) return; // Already initialized
  
  console.log('[Chat] Initializing Socket.IO connection...');
  socket = io();
  
  socket.on('connect', () => {
    console.log('[Chat] Socket.IO connected, socket.id:', socket.id);
    // Join current channel room if there is one
    if (currentChannelIndex !== null) {
      joinChannelRoom(currentChannelIndex);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('[Chat] Socket.IO disconnected');
  });
  
  socket.on('connect_error', (error) => {
    console.error('[Chat] Socket.IO connection error:', error);
  });
  
  socket.on('chat-history', (history) => {
    console.log('[Chat] Received chat history:', history.length, 'messages');
    chatMessagesEl.innerHTML = '';
    history.forEach(msg => {
      appendChatMessage(msg.user, msg.text, msg.id, msg.timestamp);
    });
  });
  
  socket.on('chat-message', (msg) => {
    appendChatMessage(msg.user, msg.text, msg.id, msg.timestamp);
  });
  
  socket.on('mute-status', (status) => {
    userMuteStatus = status;
    if (status.muted) {
      const remaining = Math.ceil((status.until - Date.now()) / 60000);
      showSystemMessage(`You are muted for ${remaining} more minute(s)`);
    }
  });
  
  socket.on('mute-error', (data) => {
    const remaining = Math.ceil((data.until - Date.now()) / 60000);
    showSystemMessage(`You are muted for ${remaining} more minute(s)`);
  });
  
  socket.on('user-muted', (data) => {
    const duration = Math.ceil((data.until - Date.now()) / 60000);
    showSystemMessage(`${data.username} has been muted for ${duration} minute(s) by ${data.moderator}`);
  });
  
  socket.on('user-unmuted', (data) => {
    showSystemMessage(`${data.username} has been unmuted by ${data.moderator}`);
    if (getCurrentUser()?.username === data.username) {
      userMuteStatus = { muted: false, until: 0, room: null };
    }
  });
  
  socket.on('message-deleted', (data) => {
    const msgEl = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (msgEl) {
      msgEl.remove();
    }
  });
}

function showSystemMessage(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message system';
  msgDiv.textContent = text;
  chatMessagesEl.appendChild(msgDiv);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// Join a channel's chat room based on channel index
function joinChannelRoom(channelIndex) {
  if (!socket || !socket.connected) {
    console.warn('[Chat] Cannot join room - socket not connected');
    return;
  }
  
  const channel = channels[channelIndex];
  if (!channel) return;
  
  // Generate room name from tvg-id or sanitized channel name
  let roomName = channel.tvgId || channel.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  // Don't rejoin if already in this room
  if (currentChatRoom === roomName) return;
  
  const user = getCurrentUser();
  if (!user) {
    console.warn('[Chat] Cannot join room - no user');
    return;
  }
  
  console.log('[Chat] Joining room:', roomName, 'as user:', user.username);
  
  // Leave old room and join new room
  currentChatRoom = roomName;
  socket.emit('join-room', { 
    room: roomName, 
    user: user.username 
  });
}

// Join a channel's chat room based on channel index
// successfully calling the backend /api/auth/me or /api/auth/login.
let currentUser = null;

// ---------------------------------------------------------------------------
// Authentication helpers

/**
 * Initialise the authentication system. This function queries the backend
 * /api/auth/me endpoint to determine whether the user already has a valid
 * session. If authenticated the user object is stored in the global
 * `currentUser` and the guide is loaded; otherwise the login screen is shown.
 */
async function initAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      currentUser = await res.json();
      hideLoginScreen();
      applyRoleVisibility(currentUser);
      loadChannels();
    } else {
      showLoginScreen();
    }
  } catch (err) {
    showLoginScreen();
  }
}

/**
 * Get the currently authenticated user. Returns the global `currentUser`
 * object which is populated during authentication. This helper replaces
 * the old localStorage based user retrieval.
 */
function getCurrentUser() {
  return currentUser;
}

/**
 * Set the current user. Assigns to the global variable. When logging out
 * this should be called with null.
 *
 * @param {Object|null} user
 */
function setCurrentUser(user) {
  currentUser = user;
}

/**
 * Fetch the list of users from the backend. Only users with the admin or
 * moderator role can call this endpoint successfully. Returns an array of
 * user objects on success; otherwise an empty array.
 *
 * @returns {Promise<Array<{id:string,username:string,role:string,created:number}>>}
 */
async function fetchUsers() {
  try {
    const res = await fetch('/api/users', { credentials: 'include' });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch users', err);
  }
  return [];
}

/**
 * Create a new user via the backend API. Only admins may create users.
 * On success the returned user object is returned; otherwise null.
 *
 * @param {string} username
 * @param {string} password
 * @param {string} role
 * @returns {Promise<Object|null>}
 */
async function apiCreateUser(username, password, role) {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, role })
    });
    if (res.ok) {
      return await res.json();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to create user');
    }
  } catch (err) {
    alert('Failed to create user');
  }
  return null;
}

/**
 * Change a user\'s password via the backend API. Moderators may change
 * passwords for non‑admin users. Admins can change any password.
 *
 * @param {string} userId
 * @param {string} newPassword
 * @returns {Promise<boolean>}
 */
async function apiChangePassword(userId, newPassword) {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password: newPassword })
    });
    if (res.ok) {
      return true;
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to change password');
    }
  } catch (err) {
    alert('Failed to change password');
  }
  return false;
}

/**
 * Change a user\'s role via the backend API. Only admins may perform
 * this action. Returns true on success.
 *
 * @param {string} userId
 * @param {string} role
 */
async function apiChangeRole(userId, role) {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role })
    });
    if (res.ok) return true;
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Failed to change role');
  } catch (err) {
    alert('Failed to change role');
  }
  return false;
}

/**
 * Delete a user via the backend API. Only admins may perform this action.
 * Returns true on success.
 *
 * @param {string} userId
 */
async function apiDeleteUser(userId) {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (res.ok) return true;
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Failed to delete user');
  } catch (err) {
    alert('Failed to delete user');
  }
  return false;
}

function showLoginScreen() {
  loginScreen.style.display = 'flex';
  wrapper.style.display = 'none';
  loginUsernameInput.focus();
}

function hideLoginScreen() {
  loginScreen.style.display = 'none';
  wrapper.style.display = '';
}

function applyRoleVisibility(user) {
  // Show or hide the manage users button based on the user's role
  // Moderators no longer have access; this panel is admin-only.
  if (user && user.role === 'admin') {
    manageUsersBtn.style.display = 'flex';
  } else {
    manageUsersBtn.style.display = 'none';
  }
}

async function handleLogin() {
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;
  if (!username || !password) {
    loginErrorEl.textContent = 'Please enter username and password';
    loginErrorEl.style.display = 'block';
    return;
  }
  loginErrorEl.style.display = 'none';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data && data.success) {
      currentUser = data.user;
      hideLoginScreen();
      applyRoleVisibility(currentUser);
      loadChannels();
    } else {
      loginErrorEl.textContent = 'Invalid username or password';
      loginErrorEl.style.display = 'block';
    }
  } catch (err) {
    loginErrorEl.textContent = 'Login failed';
    loginErrorEl.style.display = 'block';
  }
}

function showUserModal() {
  // Populate the user list each time the modal is shown. Because
  // renderUserList is asynchronous it returns a promise. The modal is
  // displayed regardless of success to allow the creation of new users.
  renderUserList();
  userModal.style.display = 'block';
}

function hideUserModal() {
  userModal.style.display = 'none';
  newUsernameInput.value = '';
  newPasswordInput.value = '';
  newRoleSelect.value = 'user';
}

async function renderUserList() {
  // Clear current list
  userListEl.innerHTML = '';
  const users = await fetchUsers();
  users.forEach((u) => {
    const entry = document.createElement('div');
    entry.className = 'user-entry';
    // Username label
    const nameSpan = document.createElement('span');
    nameSpan.textContent = u.username;
    nameSpan.style.marginRight = '8px';
    entry.appendChild(nameSpan);
    // Role selector
    const roleSelect = document.createElement('select');
    ['user', 'moderator', 'admin'].forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      if (u.role === r) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    roleSelect.addEventListener('change', async () => {
      if (await apiChangeRole(u.id, roleSelect.value)) {
        // If the current user changed role update the local currentUser
        if (currentUser && currentUser.id === u.id) {
          currentUser.role = roleSelect.value;
          applyRoleVisibility(currentUser);
        }
      } else {
        // Revert selection on failure
        roleSelect.value = u.role;
      }
    });
    entry.appendChild(roleSelect);
    // Change password button
    const pwdBtn = document.createElement('button');
    pwdBtn.textContent = 'Change Password';
    pwdBtn.style.marginLeft = '8px';
    pwdBtn.addEventListener('click', async () => {
      const newPass = prompt(`Enter new password for ${u.username}`);
      if (!newPass) return;
      await apiChangePassword(u.id, newPass);
    });
    entry.appendChild(pwdBtn);
    // Delete button (except default admin)
    if (u.username.toLowerCase() !== 'rewindadmin') {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.style.marginLeft = '8px';
      delBtn.addEventListener('click', async () => {
        if (confirm(`Delete user ${u.username}?`)) {
          const success = await apiDeleteUser(u.id);
          if (success) {
            renderUserList();
          }
        }
      });
      entry.appendChild(delBtn);
    }
    userListEl.appendChild(entry);
  });
}

async function createUser() {
  const username = newUsernameInput.value.trim();
  const password = newPasswordInput.value;
  const role = newRoleSelect.value;
  if (!username || !password) return;
  const result = await apiCreateUser(username, password, role);
  if (result) {
    newUsernameInput.value = '';
    newPasswordInput.value = '';
    newRoleSelect.value = 'user';
    renderUserList();
  }
}

// Chat functions
function toggleChatPanel() {
  chatPanel.classList.toggle('chat-open');
  if (chatPanel.classList.contains('chat-open')) {
    chatInput.focus();
  }
}

function appendChatMessage(user, text, messageId, timestamp) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message';
  if (messageId) {
    msgDiv.dataset.messageId = messageId;
  }
  // Assign a random colour to the username if not already assigned
  if (!user.color) {
    const colors = ['#f9719b','#ffd166','#06d6a0','#6792e3','#f9844a','#8e99f3'];
    user.color = colors[Math.floor(Math.random()*colors.length)];
  }
  const nameSpan = document.createElement('span');
  nameSpan.className = 'name';
  nameSpan.style.color = user.color;
  nameSpan.textContent = user.username;
  msgDiv.appendChild(nameSpan);
  // Role badge for admin or moderator
  if (user.role && user.role !== 'user') {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = user.role;
    msgDiv.appendChild(badge);
  }
  const textSpan = document.createElement('span');
  // Allow HTML for emoji images but sanitize other content
  textSpan.innerHTML = `: ${text.replace(/<(?!\/?(img)\b)[^>]+>/g, '')}`;
  msgDiv.appendChild(textSpan);
  
  // Add delete button for moderators/admin
  const current = getCurrentUser();
  if (current && (current.role === 'admin' || current.role === 'moderator') && messageId) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-msg-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete message';
    deleteBtn.addEventListener('click', () => {
      if (socket && currentChatRoom) {
        socket.emit('delete-message', {
          room: currentChatRoom,
          messageId: messageId,
          moderator: { username: current.username }
        });
      }
    });
    msgDiv.appendChild(deleteBtn);
  }
  
  chatMessagesEl.appendChild(msgDiv);
  // Scroll to bottom
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function handleChatSend() {
  const text = chatInput.value.trim();
  if (!text) return;
  const current = getCurrentUser();
  if (!current) {
    console.warn('[Chat] Cannot send message - no user');
    return;
  }

  chatInput.value = '';
  
  // Check for commands
  if (text.startsWith('/')) {
    handleChatCommand(text, current);
    return;
  }
  
  console.log('[Chat] Sending message to room:', currentChatRoom);
  
  // Send message via Socket.IO to current room
  if (socket && currentChatRoom) {
    const userForMessage = { 
      username: current.username, 
      role: current.role, 
      color: current.color 
    };
    socket.emit('chat-message', {
      room: currentChatRoom,
      user: userForMessage,
      text: text
    });
  } else {
    console.warn('[Chat] Cannot send - socket or room not ready. Socket:', !!socket, 'Room:', currentChatRoom);
  }
}

function handleChatCommand(cmd, user) {
  const parts = cmd.split(/\s+/);
  const base = parts[0].toLowerCase();
  
  if (base === '/clear') {
    if (user.role === 'admin' || user.role === 'moderator') {
      chatMessagesEl.innerHTML = '';
    }
  } else if (base === '/mute' && parts[1]) {
    if (user.role === 'admin' || user.role === 'moderator') {
      const target = parts[1];
      const duration = parseInt(parts[2]) || 5; // Default 5 minutes
      if (socket && currentChatRoom) {
        socket.emit('mute-user', {
          room: currentChatRoom,
          targetUser: target,
          duration: duration,
          moderator: { username: user.username }
        });
      }
    }
  } else if (base === '/unmute' && parts[1]) {
    if (user.role === 'admin' || user.role === 'moderator') {
      const target = parts[1];
      if (socket && currentChatRoom) {
        socket.emit('unmute-user', {
          room: currentChatRoom,
          targetUser: target,
          moderator: { username: user.username }
        });
      }
    }
  }
}

// Volume popup and slider
const volumePopup = document.getElementById('volume-popup');
const volumeRange = document.getElementById('volume-range');

// Bottom legend buttons for horizontal guide navigation. In this version
// they adjust the time window by ±12 hours.
const scrollBackBtn = document.getElementById('scroll-back');
const scrollForwardBtn = document.getElementById('scroll-forward');
const scrollBackHourBtn = document.getElementById('scroll-back-hour');
const scrollForwardHourBtn = document.getElementById('scroll-forward-hour');

// State
let channels = [];
let currentChannelIndex = null;
let miniVisible = false;
let miniLocked = false;
let miniHideTimeout = null;

// EPG state
let epgSchedule = {}; // channel name -> programme list
let epgScheduleNormalized = {}; // normalized channel name -> programme list
let epgScheduleByTvgId = {}; // tvg-id -> programme list

// Time window settings: number of hours shown in the grid and slot length (30 mins)
const windowHours = 2;
const halfHourMinutes = 30;
let timeWindowStart = null; // Date aligned to half hour
let numCols = windowHours * 60 / halfHourMinutes;

// Fetch channels from backend and build UI
async function loadChannels() {
  try {
    // Optionally accept a custom M3U URL via query param
    const params = new URLSearchParams(window.location.search);
    const m3uParam = params.get('m3u');
    const url = m3uParam ? `/api/channels?url=${encodeURIComponent(m3uParam)}` : '/api/channels';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load channels');
    channels = await res.json();
    // Load EPG after channels are loaded, which will trigger rendering the guide
    await loadEpg();
  } catch (err) {
    console.error(err);
    channelListEl.innerHTML = '<div style="padding:16px;color:red;">Failed to load channels</div>';
  }
}

function buildChannelList() {
  channelListEl.innerHTML = '';
  channels.forEach((channel, index) => {
    const row = document.createElement('div');
    row.classList.add('channel-row');
    row.dataset.index = index;
    const nameEl = document.createElement('div');
    nameEl.classList.add('channel-name');
    // Add channel logo if available
    if (channel.logo) {
      const logoImg = document.createElement('img');
      logoImg.src = channel.logo;
      logoImg.alt = channel.name;
      logoImg.style.width = '32px';
      logoImg.style.height = '32px';
      logoImg.style.marginRight = '8px';
      logoImg.style.verticalAlign = 'middle';
      nameEl.appendChild(logoImg);
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = channel.name;
    nameEl.appendChild(nameSpan);
    row.appendChild(nameEl);
    // Placeholder element for programme info (title/episode)
    const infoEl = document.createElement('div');
    infoEl.classList.add('show-info');
    row.appendChild(infoEl);
    row.addEventListener('mouseenter', () => {
      highlightGridRow(index);
    });
    row.addEventListener('click', () => {
      playChannel(index);
    });
    channelListEl.appendChild(row);
  });
}

function buildMiniChannels() {
  miniChannelsEl.innerHTML = '';
  channels.forEach((channel, index) => {
    const row = document.createElement('div');
    row.classList.add('mini-channel-row');
    row.dataset.index = index;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'mini-channel-name';
    nameSpan.textContent = channel.name;
    row.appendChild(nameSpan);
    // Show current programme title if available
    const infoSpan = document.createElement('span');
    infoSpan.className = 'mini-show-info';
    const now = new Date();
    const prog = findProgrammeForSlot(channel, now, new Date(now.getTime() + 1));
    if (prog) {
      let text = prog.title;
      if (prog.subtitle) text += ` (${prog.subtitle})`;
      infoSpan.textContent = text;
    }
    row.appendChild(infoSpan);
    row.addEventListener('click', () => {
      playChannel(index);
      openMiniGuide();
    });
    miniChannelsEl.appendChild(row);
  });
  updateMiniActive();
}

// Highlight a row in the grid list
function highlightGridRow(index) {
  // Update displayed info to show channel name when hovering over left column
  updateInfoDisplay(index, null);
}

// Update active channel highlight in mini guide
function updateMiniActive() {
  const rows = miniChannelsEl.querySelectorAll('.mini-channel-row');
  rows.forEach((row) => {
    const i = parseInt(row.dataset.index, 10);
    row.classList.toggle('active', i === currentChannelIndex);
  });
}

// Format seconds to mm:ss
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === Infinity) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a Date object to a human readable time (HH:MM). Uses the local
 * timezone. Pads minutes with a leading zero. If the date is invalid
 * returns an empty string.
 * @param {Date} date
 * @returns {string}
 */
function formatTimeOfDay(date) {
  if (!date || isNaN(date.getTime())) return '';
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Parse an XMLTV XML string and return a mapping of channel display names to
 * an array of programme objects sorted by start time. Each programme
 * object contains title, episode, description, rating, start Date and end
 * Date. Programmes that lack a stop time are ignored.
 *
 * @param {string} xmlString
 * @returns {Object<string, Array<{title:string, episode:string, desc:string, rating:string, start:Date, end:Date}>>}
 */
function parseEpgXml(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
  const channelNodes = xmlDoc.getElementsByTagName('channel');
  const channelIdToName = {};
  const channelIdToIcon = {};
  for (let i = 0; i < channelNodes.length; i++) {
    const node = channelNodes[i];
    const id = node.getAttribute('id');
    const displayNode = node.getElementsByTagName('display-name')[0];
    const displayName = displayNode ? displayNode.textContent.trim() : id;
    channelIdToName[id] = displayName;
    // Extract channel icon if present
    const iconNode = node.getElementsByTagName('icon')[0];
    let iconSrc = null;
    if (iconNode) {
      // Some icons use the src attribute, others include a child element <url> or similar
      if (iconNode.getAttribute('src')) {
        iconSrc = iconNode.getAttribute('src');
      } else if (iconNode.textContent) {
        iconSrc = iconNode.textContent.trim();
      }
    }
    channelIdToIcon[id] = iconSrc;
  }
  const schedule = {};
  const scheduleByTvgId = {}; // Map tvg-id to programme list
  // Helper to parse times of the form YYYYMMDDHHMMSS +0000
  function parseTimeStr(str) {
    if (!str) return new Date(NaN);
    const digits = str.substring(0, 14);
    const year = parseInt(digits.slice(0, 4));
    const month = parseInt(digits.slice(4, 6)) - 1;
    const day = parseInt(digits.slice(6, 8));
    const hour = parseInt(digits.slice(8, 10));
    const minute = parseInt(digits.slice(10, 12));
    const second = parseInt(digits.slice(12, 14));
    
    // Parse timezone offset (e.g., "+0000", "-0600")
    let timezoneOffset = 0;
    const tzMatch = str.match(/([+-])(\d{2})(\d{2})/);
    if (tzMatch) {
      const sign = tzMatch[1] === '+' ? 1 : -1;
      const hours = parseInt(tzMatch[2]);
      const minutes = parseInt(tzMatch[3]);
      timezoneOffset = sign * (hours * 60 + minutes); // offset in minutes
    }
    
    // Create date in UTC, then adjust for timezone offset
    const utcDate = Date.UTC(year, month, day, hour, minute, second);
    // Convert timezone offset to milliseconds and adjust
    const localOffset = new Date().getTimezoneOffset(); // local timezone offset in minutes
    const adjustedTime = utcDate - (timezoneOffset * 60000) + (localOffset * 60000);
    return new Date(adjustedTime);
  }
  const programmes = xmlDoc.getElementsByTagName('programme');
  for (let i = 0; i < programmes.length; i++) {
    const p = programmes[i];
    const channelId = p.getAttribute('channel');
    const startStr = p.getAttribute('start') || '';
    const stopStr = p.getAttribute('stop') || '';
    const start = parseTimeStr(startStr);
    const end = parseTimeStr(stopStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
    const displayName = channelIdToName[channelId] || channelId;
    const titleNode = p.getElementsByTagName('title')[0];
    const title = titleNode ? titleNode.textContent.trim() : '';
    // Subtitle/episode title
    let subtitle = '';
    const subTitleNode = p.getElementsByTagName('sub-title')[0];
    if (subTitleNode) {
      subtitle = subTitleNode.textContent.trim();
    }
    // Season and episode numbers from <episode-num>
    let season = null;
    let episodeNumber = null;
    const episodeNodes = p.getElementsByTagName('episode-num');
    if (episodeNodes.length > 0) {
      // Use the first node; try to extract S/E pattern
      const epText = episodeNodes[0].textContent.trim();
      // Match patterns like S1E3 or S01 E05 or 1.2 or 1/2 etc
      let m = epText.match(/S?(\d+)[ .:-]?[Ee]?(\d+)/);
      if (m) {
        season = parseInt(m[1], 10);
        episodeNumber = parseInt(m[2], 10);
      } else {
        // Fallback: split on non-digits
        const nums = epText.split(/[^0-9]+/).filter(Boolean);
        if (nums.length >= 2) {
          season = parseInt(nums[0], 10);
          episodeNumber = parseInt(nums[1], 10);
        }
      }
    }
    // Description
    let desc = '';
    const descNode = p.getElementsByTagName('desc')[0];
    if (descNode) desc = descNode.textContent.trim();
    // Rating
    let rating = '';
    const ratingNodes = p.getElementsByTagName('rating');
    if (ratingNodes.length > 0) {
      const valueNode = ratingNodes[0].getElementsByTagName('value')[0];
      if (valueNode) rating = valueNode.textContent.trim();
    }
    // Channel icon from channel definition
    const icon = channelIdToIcon[channelId] || null;
    if (!schedule[displayName]) schedule[displayName] = [];
    schedule[displayName].push({
      title,
      subtitle,
      desc,
      rating,
      season,
      episodeNumber,
      start,
      end,
      icon
    });
    // Also store by channel ID for tvg-id matching
    if (!scheduleByTvgId[channelId]) scheduleByTvgId[channelId] = [];
    scheduleByTvgId[channelId].push({
      title,
      subtitle,
      desc,
      rating,
      season,
      episodeNumber,
      start,
      end,
      icon
    });
  }
  // Sort each channel's programmes by start time
  for (const name in schedule) {
    schedule[name].sort((a, b) => a.start - b.start);
  }
  for (const id in scheduleByTvgId) {
    scheduleByTvgId[id].sort((a, b) => a.start - b.start);
  }
  // Return both schedule maps
  return { schedule, scheduleByTvgId };
}

/**
 * Load EPG data from the backend and update the global `epgMap`. If
 * successful, the UI is updated to display programme titles and episode
 * information.
 */
async function loadEpg() {
  const params = new URLSearchParams(window.location.search);
  const epgParam = params.get('epg');
  const url = epgParam ? `/api/epg?url=${encodeURIComponent(epgParam)}` : '/api/epg';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load EPG');
    const xml = await res.text();
    // Parse full schedule
    const parsed = parseEpgXml(xml);
    epgSchedule = parsed.schedule;
    epgScheduleByTvgId = parsed.scheduleByTvgId;
    // Build a normalised lookup (lower‑case channel names → programmes)
    epgScheduleNormalized = {};
    Object.keys(epgSchedule).forEach((name) => {
      epgScheduleNormalized[name.toLowerCase()] = epgSchedule[name];
    });
    // After EPG is loaded, render guide and mini guide
    renderGuide();
    buildMiniChannels();
    // Update player info if channel selected
    if (currentChannelIndex !== null) updatePlayerInfo();
  } catch (err) {
    console.warn('EPG load failed', err);
    epgSchedule = {};
    epgScheduleNormalized = {};
    epgScheduleByTvgId = {};
    renderGuide();
    buildMiniChannels();
  }
}

/**
 * Align a date to the nearest previous half‑hour boundary. For example,
 * 10:37 becomes 10:30, 12:00 stays 12:00. If a specific date is
 * provided it is cloned; otherwise the current time is used.
 *
 * @param {Date} [date]
 * @returns {Date}
 */
function alignTimeToHalfHour(date = new Date()) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  const half = Math.floor(mins / halfHourMinutes) * halfHourMinutes;
  d.setMinutes(half);
  return d;
}

/**
 * Format a date into a string like "Fri 9/24" (weekday abbrev + month/day)
 * using the user's locale.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatDateLabel(date) {
  const opts = { weekday: 'short', month: 'numeric', day: 'numeric' };
  return date.toLocaleDateString(undefined, opts);
}

/**
 * Format a time into a 12‑hour label with am/pm indicator, e.g. 4:00a.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatTimeLabel(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'p' : 'a';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')}${ampm}`;
}

/**
 * Render the entire guide: timeline and programme grid. Called whenever
 * channels or EPG data are available or when the time window changes.
 */
function renderGuide() {
  if (!channels || channels.length === 0) return;
  // Align the time window to the nearest half‑hour on initial render
  if (!timeWindowStart) {
    timeWindowStart = alignTimeToHalfHour(new Date());
  }
  // Render timeline and grid
  renderTimeline();
  renderGrid();
  // Display info for the first channel by default
  if (channels.length > 0) updateInfoDisplay(0, null);
}

/**
 * Render the timeline row based on the current time window. The first cell
 * shows the date; the remaining cells show half‑hour increments.
 */
function renderTimeline() {
  timelineEl.innerHTML = '';
  // Build grid template: first column fixed width, rest equal fractions
  timelineEl.style.gridTemplateColumns = `200px repeat(${numCols}, 1fr)`;
  // Date cell
  const dateCell = document.createElement('div');
  dateCell.className = 'date-cell';
  dateCell.textContent = formatDateLabel(timeWindowStart);
  timelineEl.appendChild(dateCell);
  // Time cells
  for (let i = 0; i < numCols; i++) {
    const cell = document.createElement('div');
    cell.className = 'time-cell';
    const t = new Date(timeWindowStart.getTime() + i * halfHourMinutes * 60000);
    cell.textContent = formatTimeLabel(t);
    timelineEl.appendChild(cell);
  }
}

/**
 * Find the programme airing on a channel during a specific slot.
 * Returns the programme object or null if none.
 * Matches by tvg-id first, then falls back to channel name.
 *
 * @param {Object} channel - Channel object with tvgId and name properties
 * @param {Date} slotStart
 * @param {Date} slotEnd
 * @returns {Object|null}
 */
function findProgrammeForSlot(channel, slotStart, slotEnd) {
  let list = [];
  
  // Try matching by tvg-id first
  if (channel.tvgId && epgScheduleByTvgId[channel.tvgId]) {
    list = epgScheduleByTvgId[channel.tvgId];
  } else {
    // Fallback to channel name matching (case-insensitive)
    const nameKey = (channel.name && channel.name.toLowerCase) ? channel.name.toLowerCase() : channel.name;
    list = epgScheduleNormalized[nameKey] || epgSchedule[channel.name] || [];
  }
  
  for (const prog of list) {
    if (prog.start < slotEnd && prog.end > slotStart) {
      return prog;
    }
  }
  return null;
}

/**
 * Render the programme grid. Each row represents a channel and each column
 * represents a half‑hour slot in the current time window. Programme
 * titles are repeated across slots if they span multiple half hours.
 */
function renderGrid() {
  gridEl.innerHTML = '';
  // Set grid template columns
  gridEl.style.gridTemplateColumns = `200px repeat(${numCols}, 1fr)`;
  // Build rows
  channels.forEach((channel, index) => {
    // Channel cell
    const chCell = document.createElement('div');
    chCell.className = 'channel-cell';
    chCell.textContent = channel.name;
    gridEl.appendChild(chCell);
    // Programme cells for each timeslot
    for (let i = 0; i < numCols; i++) {
      const slotStart = new Date(timeWindowStart.getTime() + i * halfHourMinutes * 60000);
      const slotEnd = new Date(slotStart.getTime() + halfHourMinutes * 60000);
      const prog = findProgrammeForSlot(channel, slotStart, slotEnd);
      const cell = document.createElement('div');
      cell.className = 'program-cell';
      if (prog) {
        cell.textContent = prog.title || '';
        cell.title = prog.title + (prog.subtitle ? ` (${prog.subtitle})` : '');
        // Attach data for later
        cell.dataset.channelIndex = index;
        cell.dataset.progStart = prog.start.getTime();
        cell.dataset.progEnd = prog.end.getTime();
        cell.dataset.progTitle = prog.title;
        cell.dataset.progSubtitle = prog.subtitle;
        cell.dataset.progDesc = prog.desc;
        cell.dataset.progRating = prog.rating;
        // Additional metadata for season and episode number
        if (prog.season !== null && prog.season !== undefined) {
          cell.dataset.progSeason = prog.season;
        }
        if (prog.episodeNumber !== null && prog.episodeNumber !== undefined) {
          cell.dataset.progEpisodeNumber = prog.episodeNumber;
        }
        cell.addEventListener('mouseenter', () => {
          // Update header and description on hover
          updateInfoDisplay(index, prog);
        });
        cell.addEventListener('click', () => {
          playChannel(index);
        });
      } else {
        cell.textContent = '';
        cell.dataset.channelIndex = index;
        cell.addEventListener('mouseenter', () => {
          updateInfoDisplay(index, null);
        });
        cell.addEventListener('click', () => {
          playChannel(index);
        });
      }
      gridEl.appendChild(cell);
    }
  });
  // Update the legend label for number of channels
  legendLeftEl.textContent = 'All Channels';
}

/**
 * Update the header and description areas based on a highlighted programme
 * or channel. If a programme object is provided it populates the show title,
 * date, time range, rating and description; otherwise it resets to the
 * channel name only.
 *
 * @param {number} channelIndex
 * @param {Object|null} prog
 */
function updateInfoDisplay(channelIndex, prog) {
  const channel = channels[channelIndex];
  if (!channel) return;
  if (prog) {
    // Show programme title (channel name + title)
    const title = prog.title || '';
    showTitleEl.textContent = `${channel.name}: ${title}`;
    // Date (weekday month/day)
    currentDateEl.textContent = formatDateLabel(prog.start);
    // Time range
    const startLabel = formatTimeLabel(prog.start);
    const endLabel = formatTimeLabel(prog.end);
    timeRangeEl.textContent = `${startLabel} - ${endLabel}`;
    // Build rating text including season/episode numbers if available
    let ratingText = '';
    if (prog.season !== null && prog.season !== undefined && prog.episodeNumber !== null && prog.episodeNumber !== undefined) {
      ratingText += `S${prog.season}E${prog.episodeNumber}`;
    }
    if (prog.rating) {
      if (ratingText) ratingText += ' ';
      ratingText += prog.rating;
    }
    ratingEl.textContent = ratingText;
    // Description: include subtitle (episode title) followed by description
    let desc = '';
    if (prog.subtitle) {
      desc += prog.subtitle;
      if (prog.desc) desc += ' - ' + prog.desc;
    } else {
      desc = prog.desc || '';
    }
    descriptionEl.textContent = desc;
  } else {
    // If there is no programme in the current slot, still display the
    // channel name and indicate that no EPG data is available.
    showTitleEl.textContent = channel.name;
    currentDateEl.textContent = formatDateLabel(timeWindowStart);
    const endSlot = new Date(timeWindowStart.getTime() + windowHours * 60 * 60000);
    timeRangeEl.textContent = `${formatTimeLabel(timeWindowStart)} - ${formatTimeLabel(endSlot)}`;
    ratingEl.textContent = '';
    // Determine if any schedule exists for this channel
    if (epgSchedule[channel.name] && epgSchedule[channel.name].length > 0) {
      descriptionEl.textContent = 'No programme information for this slot';
    } else {
      descriptionEl.textContent = 'No EPG data available';
    }
  }
}

/**
 * Update the guide and mini guide to show the current programme title and
 * episode for each channel if available.
 */
function updateShowInfoUI() {
  channels.forEach((channel, index) => {
    const info = epgSchedule[channel.name] && epgSchedule[channel.name][0] ? epgSchedule[channel.name][0] : null;
    // Update guide row
    const row = channelListEl.querySelector(`.channel-row[data-index='${index}']`);
    if (row) {
      let infoEl = row.querySelector('.show-info');
      if (!infoEl) {
        infoEl = document.createElement('div');
        infoEl.className = 'show-info';
        row.appendChild(infoEl);
      }
      if (info) {
        let text = info.title;
        if (info.subtitle) text += ` (${info.subtitle})`;
        infoEl.textContent = text;
      } else {
        infoEl.textContent = '';
      }
    }
    // Update mini guide row
    const miniRow = miniChannelsEl.querySelector(`.mini-channel-row[data-index='${index}']`);
    if (miniRow) {
      let infoSpan = miniRow.querySelector('.mini-show-info');
      if (!infoSpan) {
        infoSpan = document.createElement('span');
        infoSpan.className = 'mini-show-info';
        miniRow.appendChild(infoSpan);
      }
      if (info) {
        let text = info.title;
        if (info.subtitle) text += ` (${info.subtitle})`;
        infoSpan.textContent = text;
      } else {
        infoSpan.textContent = '';
      }
    }
  });
}

/**
 * Update the player UI (bottom bar and DVR overlay) with programme title
 * and start/end times. Called whenever a new channel begins playback or
 * when EPG information becomes available.
 */
function updatePlayerInfo() {
  if (currentChannelIndex === null) return;
  const channel = channels[currentChannelIndex];
  // Find current programme for now
  const now = new Date();
  const prog = findProgrammeForSlot(channel, now, new Date(now.getTime() + 1));
  
  // Update DVR logo to match channel logo
  let logoSrc = (channel && channel.logo) || 'assets/rewind_logo.png';
  if (dvrLogoImg) {
    dvrLogoImg.src = logoSrc;
  }
  
  if (prog) {
    // Build a display title including subtitle if present
    let displayTitle = prog.title || '';
    if (prog.subtitle) displayTitle += ` (${prog.subtitle})`;
    // Append season/episode numbers if available
    if (prog.season !== null && prog.season !== undefined && prog.episodeNumber !== null && prog.episodeNumber !== undefined) {
      displayTitle += ` — S${prog.season}E${prog.episodeNumber}`;
    }
    showNameEl.textContent = displayTitle;
    dvrTitleEl.textContent = displayTitle;
    dvrStartEl.textContent = formatTimeLabel(prog.start);
    dvrEndEl.textContent = formatTimeLabel(prog.end);
  } else {
    // No programme: show channel name and fallback values
    showNameEl.textContent = channel.name;
    dvrTitleEl.textContent = channel.name;
    dvrStartEl.textContent = '';
    dvrEndEl.textContent = '';
  }
}

// Play a specific channel by index
function playChannel(index) {
  if (index < 0 || index >= channels.length) return;
  currentChannelIndex = index;
  const channel = channels[index];
  showNameEl.textContent = channel.name;
  updateMiniActive();
  // If video is already playing, destroy previous hls instance
  if (video.hls) {
    video.hls.destroy();
    video.hls = null;
  }
  // Determine source: we proxy all streams to avoid CORS issues
  const streamUrl = `/proxy?url=${encodeURIComponent(channel.url)}`;
  // Use hls.js if necessary
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamUrl;
  } else if (window.Hls) {
    const hls = new Hls({
      enableWorker: true,
      debug: false
    });
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    video.hls = hls;
  } else {
    video.src = streamUrl;
  }
  // Play automatically when metadata is loaded
  video.addEventListener('loadedmetadata', () => {
    video.play().catch(() => {});
    updatePlayPauseButton();
  }, { once: true });
  // Show the player overlay if not visible
  showPlayer();

  // Update displayed programme info immediately
  updatePlayerInfo();
  
  // Join the chat room for this channel
  joinChannelRoom(index);
}

function showPlayer() {
  playerOverlay.style.display = 'flex';
  // Hide the description bar when player is active
  if (descriptionBar) descriptionBar.style.display = 'none';
  // Reset progress bar
  progressBar.style.width = '0%';
  elapsedEl.textContent = '0:00';
  currentPositionEl.textContent = '0:00';
  durationEl.textContent = '0:00';
  // Start updating progress
  startProgressUpdater();
  // Update player information with programme details if available
  updatePlayerInfo();
}

function hidePlayer() {
  playerOverlay.style.display = 'none';
  // Restore description bar
  if (descriptionBar) descriptionBar.style.display = 'flex';
  if (!video.paused) video.pause();
  if (video.hls) {
    video.hls.destroy();
    video.hls = null;
  }
}

// Toggle play/pause and show overlay graphic
function togglePlayPause() {
  if (video.paused) {
    video.play().catch(() => {});
    showPauseOverlay();
  } else {
    video.pause();
    showPauseOverlay();
  }
  updatePlayPauseButton();
}

function updatePlayPauseButton() {
  // Use more traditional play/pause icons for clarity
  playPauseBtn.textContent = video.paused ? '▶︎' : '⏸';
}

function showPauseOverlay() {
  // Display the DVR overlay (showing timestamps and title) briefly
  dvrOverlay.classList.add('show');
  setTimeout(() => {
    dvrOverlay.classList.remove('show');
  }, 1200);
}

// Update progress bar and time labels periodically
let progressInterval = null;
function startProgressUpdater() {
  clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    if (!video) return;
    // If EPG schedule is available for the current channel use it for progress
    if (currentChannelIndex !== null) {
      const channel = channels[currentChannelIndex];
      const now = new Date();
      const prog = findProgrammeForSlot(channel, now, new Date(now.getTime() + 1));
      if (prog) {
        const total = (prog.end.getTime() - prog.start.getTime()) / 1000;
        const elapsed = (now.getTime() - prog.start.getTime()) / 1000;
        const percent = Math.max(0, Math.min(100, (elapsed / total) * 100));
        progressBar.style.width = `${percent}%`;
        elapsedEl.textContent = formatTime(elapsed);
        currentPositionEl.textContent = formatTime(elapsed);
        durationEl.textContent = formatTime(total);
        return;
      }
    }
    // Fallback: show video progress
    if (video.readyState < 1) return;
    const duration = video.duration || 0;
    const current = video.currentTime || 0;
    if (duration > 0) {
      const percent = (current / duration) * 100;
      progressBar.style.width = `${percent}%`;
    }
    elapsedEl.textContent = formatTime(current);
    currentPositionEl.textContent = formatTime(current);
    durationEl.textContent = formatTime(duration);
  }, 500);
}

// Mini guide functions
function openMiniGuide() {
  miniGuide.style.display = 'flex';
  miniVisible = true;
  if (!miniLocked) scheduleHideMiniGuide();
}

function closeMiniGuide() {
  miniGuide.style.display = 'none';
  miniVisible = false;
}

function toggleMiniGuide() {
  if (miniVisible) closeMiniGuide();
  else openMiniGuide();
}

function scheduleHideMiniGuide() {
  clearTimeout(miniHideTimeout);
  miniHideTimeout = setTimeout(() => {
    if (!miniLocked) closeMiniGuide();
  }, 5000);
}

// Event listeners
playPauseBtn.addEventListener('click', () => {
  togglePlayPause();
});

video.addEventListener('click', (e) => {
  // Single click toggles mini guide
  openMiniGuide();
});

video.addEventListener('dblclick', (e) => {
  // Double click toggles fullscreen
  toggleFullscreen();
});

function toggleFullscreen() {
  const elem = playerOverlay;
  if (!document.fullscreenElement) {
    elem.requestFullscreen().catch(() => {});
    elem.classList.add('fullscreen');
  } else {
    document.exitFullscreen().catch(() => {});
    elem.classList.remove('fullscreen');
  }
}

// Space bar toggles play/pause when player overlay is visible
document.addEventListener('keydown', (e) => {
  if (playerOverlay.style.display === 'flex') {
    // When the video player is open
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
      return;
    }
    // Determine if we are in fullscreen to decide how to handle arrow keys
    const inFullscreen = !!document.fullscreenElement;
    if (inFullscreen) {
      // In fullscreen: up/down control volume, left/right channel surf
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        // Increase volume by 5%
        video.volume = Math.min(1, video.volume + 0.05);
        showMiniMessage(`Volume: ${Math.round(video.volume * 100)}%`);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.05);
        showMiniMessage(`Volume: ${Math.round(video.volume * 100)}%`);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (currentChannelIndex !== null) {
          playChannel((currentChannelIndex - 1 + channels.length) % channels.length);
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (currentChannelIndex !== null) {
          playChannel((currentChannelIndex + 1) % channels.length);
        }
      }
    } else {
      // Not fullscreen: up/down channel surf (consistent with mini guide) and left/right unused
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (currentChannelIndex !== null) {
          playChannel((currentChannelIndex - 1 + channels.length) % channels.length);
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (currentChannelIndex !== null) {
          playChannel((currentChannelIndex + 1) % channels.length);
        }
      }
    }
  } else {
    // Guide navigation when player is closed
    const rows = channelListEl.querySelectorAll('.channel-row');
    if (e.code === 'ArrowUp') {
      gridHighlightIndex = (gridHighlightIndex - 1 + rows.length) % rows.length;
      highlightGridRow(gridHighlightIndex);
      e.preventDefault();
    } else if (e.code === 'ArrowDown') {
      gridHighlightIndex = (gridHighlightIndex + 1) % rows.length;
      highlightGridRow(gridHighlightIndex);
      e.preventDefault();
    } else if (e.code === 'Enter') {
      playChannel(gridHighlightIndex);
      e.preventDefault();
    } else if (e.code === 'ArrowRight') {
      // Future: horizontal guide scrolling; stub for infinite scroll
      e.preventDefault();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
    }
  }
});

// Volume button toggles volume slider popup rather than muting directly
muteBtn.addEventListener('click', () => {
  if (volumePopup.style.display === 'block') {
    volumePopup.style.display = 'none';
  } else {
    volumePopup.style.display = 'block';
  }
});

// Message button toggles the chat panel instead of showing a placeholder
messageBtn.addEventListener('click', () => {
  toggleChatPanel();
});

// Lock button toggles locking the mini guide on screen.
// When locked, the mini guide remains visible until unlocked, and the
// button shows a distinct locked style.
lockBtn.addEventListener('click', () => {
  miniLocked = !miniLocked;
  if (miniLocked) {
    lockBtn.classList.add('locked');
    // Cancel any pending hide so the mini guide remains visible
    if (hideMiniGuideTimeout) {
      clearTimeout(hideMiniGuideTimeout);
      hideMiniGuideTimeout = null;
    }
    miniGuide.style.display = 'block';
  } else {
    lockBtn.classList.remove('locked');
    scheduleHideMiniGuide();
  }
});

prevChannelBtn.addEventListener('click', () => {
  if (currentChannelIndex !== null) {
    playChannel((currentChannelIndex - 1 + channels.length) % channels.length);
  }
});

nextChannelBtn.addEventListener('click', () => {
  if (currentChannelIndex !== null) {
    playChannel((currentChannelIndex + 1) % channels.length);
  }
});

// Adjust video volume when the range slider changes
if (volumeRange) {
  volumeRange.addEventListener('input', () => {
    const val = parseFloat(volumeRange.value);
    video.volume = val;
    if (val === 0) {
      muteBtn.textContent = '🔇';
    } else {
      muteBtn.textContent = '🔊';
    }
  });
}

// Hide mini guide automatically on mouse move after some delay
miniGuide.addEventListener('mousemove', () => {
  if (!miniLocked) scheduleHideMiniGuide();
});

// Option buttons (currently open only placeholder)
optionsBtn.addEventListener('click', () => {
  // Open the guide options modal
  openOptionsModal();
});
optionsMiniBtn.addEventListener('click', () => {
  openOptionsModal();
});

// Authentication and user management event handlers
if (loginBtn) {
  loginBtn.addEventListener('click', handleLogin);
}
if (loginPasswordInput) {
  // Submit form on Enter
  loginPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}
if (manageUsersBtn) {
  manageUsersBtn.addEventListener('click', () => {
    showUserModal();
  });
}
if (userCancelBtn) {
  userCancelBtn.addEventListener('click', () => {
    hideUserModal();
  });
}
if (userSaveBtn) {
  userSaveBtn.addEventListener('click', () => {
    createUser();
  });
}

// Chat events
if (chatSendBtn) {
  chatSendBtn.addEventListener('click', handleChatSend);
}
if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChatSend();
  });
}
miniGuideBtn.addEventListener('click', () => {
  // When the mini guide button is clicked in fullscreen, return to the main guide
  hidePlayer();
  miniGuide.style.display = 'none';
});

// Show messages when scrolling the guide forwards or backwards. These
// functions could later manipulate the EPG time window.
if (scrollBackBtn) {
  scrollBackBtn.addEventListener('click', () => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newTime = new Date(timeWindowStart.getTime() - 12 * 60 * 60 * 1000);
    
    // Don't go back more than 1 week
    if (newTime < oneWeekAgo) {
      showMiniMessage('Cannot go back more than 1 week');
      return;
    }
    
    timeWindowStart = newTime;
    renderGuide();
    showMiniMessage('Scrolled -12 hours');
  });
}
if (scrollForwardBtn) {
  scrollForwardBtn.addEventListener('click', () => {
    const now = new Date();
    const oneWeekForward = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const newTime = new Date(timeWindowStart.getTime() + 12 * 60 * 60 * 1000);
    
    // Don't go forward more than 1 week
    if (newTime > oneWeekForward) {
      showMiniMessage('Cannot go forward more than 1 week');
      return;
    }
    
    timeWindowStart = newTime;
    renderGuide();
    showMiniMessage('Scrolled +12 hours');
  });
}

// 1-hour navigation buttons
if (scrollBackHourBtn) {
  scrollBackHourBtn.addEventListener('click', () => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newTime = new Date(timeWindowStart.getTime() - 1 * 60 * 60 * 1000);
    
    // Don't go back more than 1 week
    if (newTime < oneWeekAgo) {
      showMiniMessage('Cannot go back more than 1 week');
      return;
    }
    
    timeWindowStart = newTime;
    renderGuide();
    showMiniMessage('Scrolled -1 hour');
  });
}

if (scrollForwardHourBtn) {
  scrollForwardHourBtn.addEventListener('click', () => {
    const now = new Date();
    const oneWeekForward = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const newTime = new Date(timeWindowStart.getTime() + 1 * 60 * 60 * 1000);
    
    // Don't go forward more than 1 week
    if (newTime > oneWeekForward) {
      showMiniMessage('Cannot go forward more than 1 week');
      return;
    }
    
    timeWindowStart = newTime;
    renderGuide();
    showMiniMessage('Scrolled +1 hour');
  });
}

function showMiniMessage(message) {
  miniMessage.textContent = message;
  miniMessage.style.display = 'block';
  setTimeout(() => {
    miniMessage.style.display = 'none';
  }, 2000);
}

// Update the clock in the guide header every second
function startClock() {
  setInterval(() => {
    const now = new Date();
    const options = {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };
    // Update the header date/time if the elements exist. Fallback gracefully
    if (currentDateEl) {
      currentDateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
    }
  }, 1000);
}

// -----------------------------------------------------------------------------
// Guide Options Modal
//
// The modal allows the user to customise the M3U playlist and EPG URL used by
// the guide. When the user saves, the page is reloaded with updated query
// parameters. When cancelled, the modal simply closes.

function openOptionsModal() {
  // Populate input fields with current values from the query string
  const params = new URLSearchParams(window.location.search);
  m3uInput.value = params.get('m3u') || '';
  epgInput.value = params.get('epg') || '';
  optionsModal.style.display = 'block';
  modalBackdrop.style.display = 'block';
}

function closeOptionsModal() {
  optionsModal.style.display = 'none';
  modalBackdrop.style.display = 'none';
}

optionsSaveBtn.addEventListener('click', () => {
  // Build a new query string from the inputs
  const params = new URLSearchParams();
  const m3uVal = m3uInput.value.trim();
  const epgVal = epgInput.value.trim();
  if (m3uVal) params.set('m3u', m3uVal);
  if (epgVal) params.set('epg', epgVal);
  // Reload the page with the new query string
  window.location.search = params.toString();
});

optionsCancelBtn.addEventListener('click', () => {
  closeOptionsModal();
});

modalBackdrop.addEventListener('click', () => {
  closeOptionsModal();
});


// Initialise authentication, then start the clock. Authentication will
// determine whether to show the login screen or load the guide immediately.
initAuth();
startClock();

// Initialize Socket.IO chat after authentication
setTimeout(() => {
  if (getCurrentUser()) {
    initializeChat();
  }
}, 1000);