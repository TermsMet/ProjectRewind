📺 ProjectRewind

A personal IPTV web app styled after the 2009 DirecTV guide.

ProjectRewind started as a private hobby project to recreate the classic DirecTV grid UI. It supports M3U playlists, XMLTV EPG, fullscreen playback, a mini-guide, and optional chat.

🚀 Features (Brief)

Classic DirecTV-style program guide

M3U playlist + XMLTV EPG support

Matches channels using tvg-id (ErsatzTV compatible)

Fullscreen video player + mini-guide lock

User roles: Admin / Moderator / User

Admin-only user management

Optional chat with custom emoji reactions

Docker-ready

🔐 About the Default Password

ProjectRewind uses a secure password-hashing system.

If you set ADMIN_PASSWORD in your environment:
→ That becomes the admin password (hashed only, never stored in plain text)

If you do not set ADMIN_PASSWORD:
→ A secure random password is generated on startup
→ It prints one time in the backend console
→ Only its hashed form is saved

Admin username: RewindAdmin
Admin password: printed or set via env var

🆓 Free Use Notice

ProjectRewind is released as a free, personal-use IPTV interface.
You may:

Self-host it

Modify it

Study the code

Re-theme or personalize it

You may not:

Sell the software

Bundle it into paid IPTV services

Claim you created the original source

Use it to bypass copyright-protected streams

This project is intended for private, legal, self-hosted IPTV setups only.

🐳 Quick Docker Run
docker build -t projectrewind .
docker run -d \
  -p 3000:3000 \
  -e M3U_URL="http://yourserver/playlist.m3u" \
  -e EPG_URL="http://yourserver/xmltv.xml" \
  -e ADMIN_PASSWORD="YourStrongPass" \
  projectrewind

📂 Structure
backend/     Node server, auth, M3U + XMLTV parsing
frontend/    HTML, CSS, Vanilla JS
data/        User database

📄 License

Free for personal use. MIT license recommended (optional).
