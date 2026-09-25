/**
 * NAILBOOK — Documentação OpenAPI da API
 * Pode ser servida via Swagger UI em produção
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'NailBook API',
    description: 'API para plataforma de marcações online de unhas e manicure',
    version: '1.0.0',
    contact: {
      name: 'NailBook Support',
      email: 'support@nailbook.com'
    }
  },
  servers: [
    {
      url: process.env.API_URL || 'http://localhost:3000/api',
      description: process.env.NODE_ENV === 'production' ? 'Servidor de produção' : 'Servidor de desenvolvimento'
    }
  ],
  tags: [
    { name: 'Health', description: 'Verificação de saúde do servidor' },
    { name: 'Services', description: 'Serviços de manicure' },
    { name: 'Availability', description: 'Disponibilidade de horários' },
    { name: 'Appointments', description: 'Marcações' },
    { name: 'Auth', description: 'Autenticação administrativa' },
    { name: 'Admin', description: 'Painel administrativo' }
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'Servidor operacional',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/services': {
      get: {
        summary: 'Listar serviços ativos',
        tags: ['Services'],
        security: [],
        responses: {
          '200': {
            description: 'Lista de serviços ativos',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          name: { type: 'string' },
                          description: { type: 'string' },
                          price: { type: 'number', example: 25.00 },
                          duration_minutes: { type: 'integer', example: 60 },
                          active: { type: 'boolean' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/settings': {
      get: {
        summary: 'Obter configurações do negócio',
        tags: ['Services'],
        security: []
      }
    },
    '/availability': {
      get: {
        summary: 'Consultar horários disponíveis',
        tags: ['Availability'],
        parameters: [
          { name: 'date', in: 'query', required: true, schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
          { name: 'service_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          '200': {
            description: 'Horários disponíveis',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        date: { type: 'string' },
                        is_today: { type: 'boolean' },
                        is_available: { type: 'boolean' },
                        service: { type: 'object' },
                        timezone: { type: 'string' },
                        business_hours: { type: 'array' },
                        breaks: { type: 'array' },
                        blocked_periods: { type: 'array' },
                        available_slots: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              start: { type: 'string', example: '09:00' },
                              end: { type: 'string', example: '10:00' }
                            }
                          }
                        },
                        rules: {
                          type: 'object',
                          properties: {
                            buffer_minutes: { type: 'integer', example: 15 },
                            minimum_advance_hours: { type: 'integer', example: 0 },
                            maximum_booking_days: { type: 'integer', example: 30 }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/availability/check': {
      get: {
        summary: 'Verificar se horário específico está disponível',
        tags: ['Availability'],
        parameters: [
          { name: 'date', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'service_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'time', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Disponibilidade do slot'
          }
        }
      }
    },
    '/availability/validate': {
      post: {
        summary: 'Validar tentativa de reserva',
        tags: ['Availability'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  service_id: { type: 'string', format: 'uuid' },
                  time: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Resultado da validação'
          }
        }
      }
    },
    '/appointments': {
      post: {
        summary: 'Criar nova marcação',
        tags: ['Appointments'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  serviceId: { type: 'string', format: 'uuid' },
                  date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                  startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                  customer: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      phone: { type: 'string' },
                      email: { type: 'string', format: 'email' }
                    }
                  },
                  notes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Marcação criada com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    appointment: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        service: { type: 'string' },
                        date: { type: 'string' },
                        startTime: { type: 'string' },
                        endTime: { type: 'string' },
                        status: { type: 'string', example: 'confirmed' }
                      }
                    },
                    managementToken: { type: 'string' }
                  }
                }
              }
            }
          },
          '409': {
            description: 'Horário não disponível'
          }
        }
      }
    },
    '/appointments/{token}': {
      get: {
        summary: 'Consultar marcação por token',
        tags: ['Appointments'],
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          '200': {
            description: 'Detalhes da marcação'
          },
          '404': {
            description: 'Marcação não encontrada'
          }
        }
      }
    },
    '/appointments/{token}/cancel': {
      post: {
        summary: 'Cancelar marcação por token',
        tags: ['Appointments'],
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          '200': {
            description: 'Marcação cancelada'
          },
          '400': {
            description: 'Estado inválido para cancelamento'
          }
        }
      }
    },
    '/admin/auth/login': {
      post: {
        summary: 'Login administrativo',
        tags: ['Auth'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login bem-sucedido',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { type: 'object' },
                        accessToken: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Credenciais inválidas'
          }
        }
      }
    },
    '/admin/appointments': {
      get: {
        summary: 'Listar todas as marcações',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['confirmed', 'cancelled', 'completed', 'no_show'] } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Lista de marcações'
          }
        }
      }
    },
    '/admin/services': {
      get: {
        summary: 'Listar serviços',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }]
      },
      post: {
        summary: 'Criar serviço',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }]
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  }
};

/**
 * Servir documentação JSON
 */
export function serveDocs(req, res) {
  res.json(openApiSpec);
}
