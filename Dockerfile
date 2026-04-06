# Dockerfile para Chat Backend
FROM node:18-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 3000

# Comando por defecto (puede ser sobrescrito en docker-compose)
CMD ["npm", "run", "dev"]
