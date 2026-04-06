# syntax=docker/dockerfile:1
# Multi-platform build compatible: linux/amd64, linux/arm64

FROM node:22-alpine

WORKDIR /app

# Dependencias nativas para compilar better-sqlite3
RUN apk add --no-cache python3 make g++

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Rebuild better-sqlite3 para la arquitectura del container
RUN npm rebuild better-sqlite3

# Exponer puerto
EXPOSE 3000

# Comando por defecto (puede ser sobrescrito en docker-compose)
CMD ["npm", "run", "dev"]
