# NAILBOOK — Documentação da API

## Base URL

```
https://api.meudominio.pt
```

## Endpoints Públicos

### Health Check
```
GET /health
```
Responds:
```json
{ "status": "ok", "timestamp": "2026-09-25T00:00:00.000Z" }
```

### Listar Serviços
```
GET /api/services
```
Responds:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Manicure Gel",
      "description": "Descrição...",
      "price": "30.00",
      "duration_minutes": 60,
      "active": true
    }
  ]
}
```

### Obter Settings
```
GET /api/settings
```
Responds:
```json
{
  "success": true,
  "data": {
    "business_name": "NailBook",
    "business_phone": "+351912345678",
    "business_email": "contacto@exemplo.com",
    "timezone": "Europe/Lisbon",
    "minimum_advance_hours": 0,
    "maximum_booking_days": 30,
    "cancellation_deadline_hours": 24,
    "buffer_minutes": 15
  }
}
```

### Disponibilidade
```
GET /api/availability?date=2026-10-15&service_id=uuid
```
Responds:
```json
{
  "success": true,
  "data": {
    "availableSlots": ["09:00", "09:30", "10:00"],
    "unavailableSlots": []
  }
}
```

### Criar Marcação
```
POST /api/appointments
Content-Type: application/json

{
  "service_id": "uuid",
  "date": "2026-10-15",
  "time": "14:30",
  "customer_name": "Maria Silva",综述",
  "customer_phone": "+351912345678",
  "customer_email": "maria@email.com",
  "notes": "Tenho uma unha partida"
}
```
Responds:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "token": "secure-token",
    "status": "confirmed",
    "start_at": "2026-10-15T14:30:00Z",
    "end_at": "2026-10-15T15:30:00Z",
    "price": "30.00",
    "duration_snapshot_minutes": 60
  }
}
```

### Consultar Marcação por Token
```
GET /api/appointments/:token
```

### Cancelar Marcação por Token
```
POST /api/appointments/:token/cancel
```

### ICS Calendar
```
GET /api/appointments/:token/calendar.ics
```
Download do ficheiro `.ics`.

### Google Calendar URL
```
GET /api/appointments/:token/calendar
```
Responds:
```json
{ "success": true, "data": { "url": "https://calendar.google.com/..." } }
```

### Redirecionar Google Calendar
```
GET /api/appointments/:token/google-calendar
```
Redirect para Google Calendar.

## Endpoints Administrativos (Requerem Autenticação)

### Login
```
POST /api/admin/auth/login
{
  "email": "admin@exemplo.com",
  "password": "password"
}
```

### Logout
```
POST /api/admin/auth/logout
```

### Perfil
```
GET /api/admin/me
```

### Listar Marcações
```
GET /api/admin/appointments?status=confirmed&date=2026-10-15&limit=50
```

### Atualizar Marcação
```
PATCH /api/admin/appointments/:id
{
  "status": "completed"
}
```

### Listar Serviços
```
GET /api/admin/services
POST /api/admin/services
```

### Atualizar Serviço
```
PATCH /api/admin/services/:id
DELETE /api/admin/services/:id
```

### Clientes
```
GET /api/admin/customers
GET /api/admin/customers/:id
PATCH /api/admin/customers/:id
```

### Horários
```
GET /api/admin/business-hours
PATCH /api/admin/business-hours
```

### Períodos Bloqueados
```
GET /api/admin/blocked-periods
POST /api/admin/blocked-periods
DELETE /api/admin/blocked-periods/:id
```

### Definições
```
GET /api/admin/settings
PATCH /api/admin/settings
```

### Notificações (Admin)
```
GET /api/admin/notifications
GET /api/admin/notifications/stats
```

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 400 | Pedido inválido (validação) |
| 401 | Autenticação necessária |
| 403 | Acesso proibido |
| 404 | Recurso não encontrado |
| 409 | Conflito (double booking, horário ocupado) |
| 422 | Dados inválidos |
| 429 | Too Many Requests |
| 500 | Erro interno do servidor |

## Rate Limiting

| Endpoint | Limite | Janela |
|----------|--------|--------|
| Geral | 100 | 15 min |
| Login | 5 | 15 min |
| Booking | 20 | 1 hora |
| Disponibilidade | 30 | 15 min |
| Cancelamento | 10 | 1 hora |
