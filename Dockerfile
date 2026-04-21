# Use Node.js base image
FROM node:20-alpine

# Install build dependencies for better-sqlite3 and other native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend assets
RUN npm run build

# Expose the orchestrator port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
