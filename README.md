# Chat Backend

Servidor Node.js con Socket.io para chat en tiempo real. Para instrucciones completas de setup con Docker, ver el [README principal](../../README.md).

## Stack

- Node.js 22 + TypeScript 5 (ES Modules, strict mode)
- Express + Socket.io 4
- Drizzle ORM + better-sqlite3
- Zod para validación
- Jest 30 (93 tests, 92% coverage)

## Estructura

```
src/
├── config/
│   ├── env.ts              # Variables de entorno
│   ├── socket.ts           # Configuración Socket.io
│   └── database/           # Drizzle ORM schema + client
├── modules/
│   ├── chat/               # Mensajes, rate limiting, typing
│   ├── rooms/              # CRUD salas, repository pattern
│   └── users/              # Join/leave/kick, bans temporales
├── shared/
│   ├── types/              # Interfaces Socket.io tipadas
│   └── schemas/            # Zod schemas para validación
├── app.ts                  # Express app factory
└── server.ts               # Entry point, Socket.io init
```

## Setup Local (Sin Docker)

```bash
# Instalar dependencias
npm install

# Desarrollo (watch mode)
npm run dev

# Build
npm run build

# Producción
npm start

# Tests
npm test
npm run test:coverage

# Drizzle ORM
npm run db:generate   # Generar migraciones
npm run db:migrate    # Aplicar migraciones
npm run db:studio     # GUI para explorar DB
```

## Variables de Entorno

```env
PORT=3000
NODE_ENV=development
DB_PATH=./rooms.db
CORS_ORIGIN=*
```

## Testing

93 tests en 8 suites:
- `app.test.ts` - Express app
- `config.test.ts` - Validación env
- `schemas.test.ts` - Zod schemas
- `chat.service.test.ts` - Lógica de mensajes
- `chat.gateway.test.ts` - Socket.io handlers
- `rooms.repository.test.ts` - Queries Drizzle
- `rooms.service.test.ts` - Lógica de salas
- `users.service.test.ts` - Lógica de usuarios

**Coverage**: 92% statements, 75% branches, 92% functions, 95% lines

## Arquitectura

```
Gateway (chat.gateway.ts)
    ↓ Valida con Zod schemas
Service (*.service.ts)
    ↓ Lógica de negocio
Repository (rooms.repository.ts)
    ↓ Drizzle queries
SQLite (better-sqlite3)
```

## Features

- Rate limiting: mensajes (2s), typing (1s)
- Bans temporales (10 min)
- Validación estricta de todos los eventos
- Códigos de sala únicos (6 chars alfanuméricos)
- Alias únicos por sala
- Max 1000 caracteres por mensaje

## Documentación

Ver instrucciones de arquitectura en `.github/instructions/nodejs-architecture.instructions.md` del proyecto principal.
npm start
```

## Testing

```bash
# Ejecutar tests
npm test

# Tests con coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Configuración

Variables de entorno disponibles:

```env
PORT=3000
NODE_ENV=development
```

Crea un archivo `.env` en la raíz del servidor si necesitas sobrescribir valores.

## Scripts Disponibles

- `npm run dev` - Desarrollo con tsx watch
- `npm run build` - Compila TypeScript a JavaScript
- `npm start` - Ejecuta build de producción
- `npm test` - Ejecuta tests con Jest
- `npm run test:coverage` - Tests con reporte de cobertura
- `npm run test:watch` - Tests en modo watch

## Arquitectura

Este proyecto sigue una arquitectura modular:

- **Modules por feature**: chat, rooms, users
- **Validación con Zod**: schemas reutilizables
- **Servicios independientes**: lógica de negocio aislada
- **Gateway centralizado**: manejo de eventos Socket.io

## API (Socket.io)

### Eventos del Cliente

- `user:join` - Usuario se une a una sala
- `user:leave` - Usuario abandona sala
- `message:send` - Enviar mensaje
- `typing:start` - Iniciar indicador de escritura
- `typing:stop` - Detener indicador de escritura

### Eventos del Servidor

- `rooms:list` - Lista de salas disponibles
- `room:joined` - Confirmación de unión a sala
- `message:new` - Nuevo mensaje recibido
- `user:joined` - Usuario se unió a sala
- `user:left` - Usuario abandonó sala
- `typing:update` - Actualización de usuarios escribiendo

## Notas

- Persistencia híbrida: metadata de salas en SQLite, estado runtime (usuarios, aliases, bans) en memoria
- Sin autenticación formal (solo alias)
- Diseñado como POC/demo
- Coverage objetivo: >80%
