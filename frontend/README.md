# NAILBOOK — Fase 5: Dashboard Administrativo

## Visão Geral

Dashboard administrativo privado para a profissional gerir o seu negócio de manicure.

Consume exclusivamente a API REST criada nas Fases 1–4.

## Páginas

| Página | URL | Descrição |
|--------|-----|-----------|
| Login | `/login.html` | Autenticação administrativa |
| Dashboard | `/dashboard.html` | Painel principal com estatísticas e agenda |
| Marcações | `/dashboard.html#appointments` | Listar, filtrar, cancelar, concluir marcações |
| Serviços | `/dashboard.html#services` | CRUD de serviços |
| Clientes | `/dashboard.html#customers` | Gestão de clientes e histórico |
| Horários | `/dashboard.html#business-hours` | Configurar horário de funcionamento |
| Bloqueados | `/dashboard.html#blocked-periods` | Criar e gerir períodos bloqueados |
| Definições | `/dashboard.html#settings` | Configurações do negócio |

## Ficheiros Criados/Atualizados

### CSS
- `frontend/css/admin.css` — Estilos administrativos completos
- `frontend/css/style.css` — Adicionadas variáveis CSS para admin

### JavaScript
- `frontend/js/components.js` — Componentes reutilizáveis (modal, toast, badge, table, form)
- `frontend/js/admin-router.js` — Router client-side para navegação admin
- `frontend/js/api.js` — Atualizado com CSRF token e session expiry handling
- `frontend/js/auth.js` — Atualizado para novo sistema de login
- `frontend/js/dashboard.js` — Dashboard legacy (compatibilidade)
- `frontend/js/admin/layout.js` — Layout administrativo compartilhado
- `frontend/js/admin/index.js` — Ponto de entrada admin
- `frontend/js/admin/dashboard.js` — Dashboard page module
- `frontend/js/admin/appointments.js` — Gestão de marcações
- `frontend/js/admin/services.js` — Gestão de serviços
- `frontend/js/admin/customers.js` — Gestão de clientes
- `frontend/js/admin/business-hours.js` — Horários de funcionamento
- `frontend/js/admin/blocked-periods.js` — Períodos bloqueados
- `frontend/js/admin/settings.js` — Definições do negócio

### HTML
- `frontend/dashboard.html` — Redesignado com admin layout
- `frontend/login.html` — Atualizado com API integration

## Funcionalidades

### Login
- Autenticação via API (`POST /api/admin/auth/login`)
- Cookies httpOnly (segurança XSS)
- CSRF token protection
- Sessão expirada → redirecionamento automático

### Dashboard
- Estatísticas do dia (marcações, receita, clientes, serviços)
- Agenda do dia (visualização temporal)
- Próxima marcação
- Marcações recentes

### Gestão de Marcações
- Listar todas as marcações
- Filtrar por estado
- Ver detalhes
- Cancelar (com confirmação)
- Marcar como concluída
- Marcar como no-show

### Gestão de Serviços
- Criar novo serviço
- Editar serviço existente
- Ativar/desativar
- Preço e duração como histórico (não afeta marcações antigas)

### Gestão de Clientes
- Listar todos os clientes
- Pesquisar por nome, telefone ou email
- Ver perfil e histórico de marcações

### Horários de Funcionamento
- Configurar dias abertos/fechados
- Múltiplos períodos por dia
- Adicionar/remover períodos

### Períodos Bloqueados
- Criar bloqueios (datas/horas)
- Motivo (férias, consulta, etc.)
- Detetar conflitos com marcações existentes

### Definições
- Nome, telefone, email do negócio
- Antecedência mínima
- Limite máximo de marcação
- Prazo de cancelamento
- Buffer entre clientes

## Segurança

- **Cookies httpOnly**: JWT administrativo nunca acessível via JavaScript
- **CSRF Protection**: Token no cookie + header X-CSRF-Token
- **Sessão expirada**: Redirecionamento automático para login
- **Autenticação obrigatória**: Todas as páginas admin requerem login
- **Não armazenar secrets no frontend**: Apenas configurações públicas

## Responsividade

- Mobile-first design
- Sidebar recolhível em mobile
- Cards responsivos
- Tabelas adaptáveis
- Touch targets adequados

## Acessibilidade

- Labels em todos os inputs
- Foco visível
- Navegação por teclado
- `aria-label` em elementos interativos
- Mensagens de erro associadas aos campos
- Contraste adequado
- Não depender apenas de cor para estados

## Componentes Reutilizáveis

| Componente | Função |
|------------|--------|
| `badge(status)` | Badge de estado (confirmada, cancelada, etc.) |
| `showModal(title, message)` | Diálogo de confirmação modal |
| `showToast(message, type)` | Notificação temporária |
| `createTable(headers, rows, actions)` | Tabela de dados |
| `showLoading(container, msg)` | Estado de carregamento |
| `showEmpty(container, msg)` | Estado vazio |
| `showError(container, msg)` | Estado de erro |
| `formGroup(label, type, id)` | Input com label |
| `datePicker(id, value, label)` | Seletor de data |
| `timeInput(id, value, label)` | Seletor de hora |

## Instruções de Execução

### Pré-requisitos
- Backend funcional (Fases 1–4)
- Frontend servido pelo mesmo servidor ou CDN separado
- `API_URL` configurado no frontend

### Configuração
1. Certificar que o backend está a correr (`npm start` no backend)
2. Servir o frontend (`npx serve frontend/` ou similar)
3. Aceder a `http://localhost:3000/login.html`

### Testes
1. Fazer login com credenciais admin
2. Verificar dashboard carrega corretamente
3. Testar navegação entre páginas
4. Criar/Editar/Deletar serviços
5. Criar/Ver/Cancelar marcações
6. Gerir clientes, horários e bloqueios
7. Testar logout e sessão expirada
8. Testar em mobile (responsividade)

## Integração com API

Todas as operações usam endpoints existentes:

```
GET    /api/admin/me                    # Verificar autenticação
POST   /api/admin/auth/login            # Login
POST   /api/admin/auth/logout           # Logout
GET    /api/admin/appointments          # Listar marcações
GET    /api/admin/appointments/:id      # Ver marcação
PATCH  /api/admin/appointments/:id      # Atualizar estado
GET    /api/admin/services              # Listar serviços
POST   /api/admin/services              # Criar serviço
GET    /api/admin/services/:id          # Ver serviço
PATCH  /api/admin/services/:id          # Atualizar serviço
DELETE /api/admin/services/:id          # Remover serviço
GET    /api/admin/customers             # Listar clientes
GET    /api/admin/business-hours        # Obter horários
PATCH  /api/admin/business-hours        # Atualizar horários
GET    /api/admin/blocked-periods       # Listar bloqueios
POST   /api/admin/blocked-periods       # Criar bloqueio
DELETE /api/admin/blocked-periods/:id   # Remover bloqueio
GET    /api/admin/settings              # Obter definições
PATCH  /api/admin/settings              # Atualizar definições
```

## Decisões Arquiteturais

### Layout Compartilhado
Todas as páginas admin usam o mesmo layout (sidebar + header + content) para consistência.

### Módulos JS Separados
Cada página de gestão é um módulo separado (`js/admin/*.js`) para manter o código organizado.

### Componentes Reutilizáveis
O `js/components.js` centraliza todos os componentes UI para evitar duplicação.

### Router Client-Side
O `js/admin-router.js` gerencia a navegação entre páginas sem recarregar o servidor.

### CSRF Protection
O `js/api.js` gerencia automaticamente o token CSRF em todos os requests mutativos.

### Sessão Expirada
O `js/api.js` detecta respostas 401 e redireciona para login automaticamente.

## Não Implementado na V1

- WebSockets para atualização em tempo real
- Calendário mensal complexo
- Relatórios e gráficos avançados
- Exportação de dados
- Notificações push
- Multi-utilizador com diferentes permissões
- Backup e restauração de dados

## Próximos Passos (Fase 6)

- Otimização de performance
- PWA (Progressive Web App)
- Notificações push
- Integração com Google Calendar
- Relatórios financeiros
- Multi-salon support

## Critérios de Aceitação

- [x] Login funcional com API real
- [x] Logout funcional
- [x] Dashboard carrega estatísticas da API
- [x] Navegação entre páginas funciona
- [x] Gestão de marcações completa
- [x] Gestão de serviços completa
- [x] Gestão de clientes funcional
- [x] Horários configuráveis
- [x] Períodos bloqueados funcionais
- [x] Definições atualizáveis
- [x] Sessão expirada tratada
- [x] CSRF protection ativa
- [x] Responsivo (mobile-first)
- [x] Acessível
- [x] Sem dados mockados
- [x] Sem localStorage como base de dados
- [x] Componentes reutilizáveis
- [x] Erros tratados com mensagens úteis
- [x] Loading/empty/error states presentes
- [x] Confirmações em ações destrutivas
