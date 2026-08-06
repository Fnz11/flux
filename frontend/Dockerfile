# Development Stage
FROM node:20-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host"]

# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# Production Stage
FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
# Using default nginx config, which is fine for static assets.
# For client-side routing (SPA), you may need a custom nginx.conf
# to rewrite paths to index.html.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
