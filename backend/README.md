# NAILBOOK — Backend README

## Visão Geral

Backend API REST para a plataforma NailBook de marcações online de unhas e manicure.

## Tecnologias

- **Node.js** 18+
- **Express** 4.x
- **PostgreSQL** 15+
- **bcrypt** para hashing de passwords
- **JWT** para autenticação administrativa
- **Joi** para validação de inputs

## Instalação

### Pré-requisitos

```bash
node >= 18.0.0
postgres >= 15
npm >= 9.0.0
```

### 1. Clonar o repositório

```bash
cd backend
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Editar .env com os seus valores
```

### 4. Criar a base de dados

```bash
createdb nailbook
```

### 5. Executar migrações

```bash
npm run migrate
```

### 6. Seed de dados de desenvolvimento

```bash
npm run seed
```

### 7. Iniciar servidor

```bash
npm start
# ou
npm run dev
```

## Comandos

```bash
# Iniciar servidor de produção
npm start

# Iniciar com auto-reload (desenvolvimento)
npm run dev

# Executar migrações
npm run migrate

# Seed de dados
npm run seed

# Executar testes
npm test

# Testes em watch
npm run test:watch
```

## Estrutura de Pastas

```
backend/
├── server.js                  # Entry point
├── package.json
├── .env.example
├── jest.config.js
├── config/
│   └── database.js            # Pool de conexões PostgreSQL
├── controllers/
│   ├── availabilityController.js
│   ├── appointmentController.js
│   ├── adminController.js
│   ├── settingsController.js
│   └── .gitkeep
├── routes/
│   ├── index.js               # Router principal
│   ├── public.js              # Rotas públicas
│   ├── admin.js               # Rotas administrativas
│   ├── auth.js                # Autenticação
│   └── appointments.js        # Rotas de marcações
├── middleware/
│   ├── auth.js                # JWT authentication
│   ├── cors.js                # CORS configuration
│   ├── rateLimiter.js         # Rate limiting
│   ├── security.js            # Headers de segurança
│   ├── errorHandler.js        # Error handler centralizado
│   ├── requestId.js           # Request ID tracking
│   ├── csrf.js                # CSRF protection
│   ├── idempotency.js         # Idempotency keys
│   └── .gitkeep
├── models/
│   └── index.js               # 10 modelos de dados
├── services/
│   ├── doubleBookingService.js
│   ├── emailService.js
│   ├── icsService.js
│   └── .gitkeep
├── repositories/
│   ├── notificationRepository.js
│   └── .gitkeep
├── jobs/
│   ├── notificationJobs.js
│   └── .gitkeep
├── validators/
│   ├── bookingValidator.js
│   └── adminValidator.js
├── utils/
│   ├── logger.js              # Winston logger
│   └── .gitkeep
├── database/
│   ├── migrate.js             # Migration runner
│   ├── seed.js                # Seed de dados
│   └── migrations/
│       ├── 001_create_tables.sql
│       └── 002_add_indexes.sql
├── docs/
│   └── openapi.js             # Documentação OpenAPI 3.0.3
├── tests/
│   ├── auth.test.js
│   ├── availability.test.js
│   ├── booking.test.js
│   ├── doubleBooking.test.js
│   └── .gitkeep
└── .gitkeep
```

## Endpoints da API

### Públicos

```http
GET  /health                    # Health check
GET  /health/db                 # Health check com DB
GET  /api/services              # Listar serviços ativos
GET  /api/settings              # Configurações do negócio
GET  /api/availability          # Horários disponíveis
POST /api/appointments          # Criar marcação
GET  /api/appointments/:token   # Consultar marcação
POST /api/appointments/:token/cancel  # Cancelar marcação
```

### Administrativos (requerem autenticação)

```http
POST /api/admin/auth/login      # Login
POST /api/admin/auth/logout     # Logout
GET  /api/admin/auth/me         # Perfil

GET  /api/admin/appointments    # Listar marcações
GET  /api/admin/appointments/:id # Ver marcação
PATCH /api/admin/appointments/:id # Atualizar estado

GET  /api/admin/customers       # Listar clientes
GET  /api/admin/customers/:id   # Ver cliente
PATCH /api/admin/customers/:id  # Atualizar cliente

GET  /api/admin/services        # Listar serviços
POST /api/admin/services        # Criar serviço
GET  /api/admin/services/:id    # Ver serviço
PATCH /api/admin/services/:id   # Atualizar serviço
DELETE /api/admin/services/:id  # Remover serviço

GET/PATCH /api/admin/business-hours

GET/POST /api/admin/blocked-periods
DELETE /api/admin/blocked-periods/:id

GET/PATCH /api/admin/settings
```

## Segurança

- JWT em cookies httpOnly
- CSRF protection
- Rate limiting
- CORS estrito
- bcrypt (custo 12) para passwords
- Parameterized queries (SQL injection prevention)
- EXCLUDE constraint para double booking
- Helmet.js para headers de segurança

## Logging

Winston com logging estruturado:
- Desenvolvimento: console colorido
- Produção: JSON files (`logs/error.log`, `logs/combined.log`)

## Testes

```bash
npm test
```

Testes cobrem:
- Autenticação
- Disponibilidade
- Criação de marcações
- Double booking
- Timezone
- Segurança

## Deployment

### Render

1. Criar Web Service no Render
2. Configurar `DATABASE_URL`, `JWT_SECRET`, etc.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Criar PostgreSQL Database no Render

### Cloudflare Pages (Frontend)

Configurar `API_URL` para apontar para o backend.

## Ambiente de Desenvolvimento

```bash
# Iniciar tudo localmente
cd backend && npm run dev

# O servidor estará disponível em http://localhost:3000
# Health check: http://localhost:3000/health
# API docs: http://localhost:3000/api/docs
```
