# Use an official Node runtime as a base image
FROM node:18-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package.json ./backend/package.json
RUN npm install --prefix ./backend

# Copy source files
COPY backend ./backend
COPY frontend ./frontend

# Expose the port used by the server
ENV PORT=3000
EXPOSE 3000

# Optional: specify a default M3U playlist URL via environment variable
ENV M3U_URL=""

# Run the server
CMD ["node", "backend/index.js"]