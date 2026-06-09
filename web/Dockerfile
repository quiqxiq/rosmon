# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package configurations
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy project files
COPY . .

# Set dynamic API URL argument
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL

# Build web assets
RUN pnpm build

# Serve stage
FROM nginx:alpine

# Copy built SPA static files into Nginx public directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration to support SPA routing (avoid 404s on refresh)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
