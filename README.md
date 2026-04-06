# Chat Backend

Servidor Node.js con Socket.io para chat en tiempo real.

## Stack Tecnológico

- **Node.js** con TypeScript
- **Express** como framework HTTP
- **Socket.io** para comunicación real-time
- **Zod** para validación de schemas
- **Jest** para testing
- **Arquitectura modular** por features

## Estructura

```
src/
├── config/           # Configuración (env, socket)
├── modules/          # Módulos de negocio
│   ├── chat/        # Gestión de mensajes
│   ├── rooms/       # Gestión de salas
│   └── users/       # Gestión de usuarios
└── shared/          # Tipos compartidos
```

## Setup

### Instalación

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

### Build

```bash
npm run build
```

### Producción

```bash
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
