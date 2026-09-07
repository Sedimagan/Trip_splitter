# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 4000
# Applies any pending migrations, then starts the API. Run this as the
# container's start command in production (Render/Railway/Fly/ECS/etc. all
# support a custom start/release command).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
