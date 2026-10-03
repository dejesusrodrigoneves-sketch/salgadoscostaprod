const SENSITIVE = ['cliente', 'entregador', 'pedido', 'empresa', 'usuario', 'platformConnection', 'whatsAppInstance', 'auditLog', 'termoConsent'];
const RAW = ['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe', '$transaction'];

// Allowlist EXPLÍCITA (legado grandfathered; sem allowlist silenciosa).
// Cada entrada = justificativa; remover à medida que a tarefa de migração esvaziar o arquivo.
// Migração real: Task 6 (repositórios de PII) + tasks seguintes. Estes 40 arquivos são
// o legado pré-existente apontado no spec (acesso direto a models sensíveis via prisma):
const ALLOWLIST = [
  // controllers
  'src/app.js',
  'src/controllers/adminController.js',
  'src/controllers/driverController.js',
  'src/controllers/entregaController.js',
  'src/controllers/entregadorAppController.js',
  'src/controllers/financeiroController.js',
  'src/controllers/lojaController.js',
  'src/controllers/publicController.js',
  'src/controllers/subscriptionController.js',
  // cron/jobs
  'src/cron/filialBillingCron.js',
  'src/cron/subscriptionCron.js',
  'src/jobs/deferredDeleteWorker.js',
  'src/jobs/pixExpirationJob.js',
  // middleware
  'src/middleware/authenticatePublic.js',
  'src/middleware/context.js',
  'src/middleware/errorHandler.js',
  'src/middleware/filialSuspended.js',
  'src/middleware/resolveEmpresa.js',
  'src/middleware/subscriptionGuard.js',
  'src/middleware/validateEntregadorEmpresa.js',
  // routes
  'src/routes/filialPricingRoutes.js',
  'src/routes/paymentRoutes.js',
  'src/routes/publicRoutes.js',
  // services
  'src/services/authService.js',
  'src/services/clientService.js',
  'src/services/entregaService.js',
  'src/services/entregadorAppService.js',
  'src/services/fcmService.js',
  'src/services/filialBillingService.js',
  'src/services/financialDashboardService.js',
  'src/services/financialSyncService.js',
  'src/services/orderService.js',
  'src/services/paymentService.js',
  'src/services/platformConnectionService.js',
  'src/services/pricingFilialConfigService.js',
  'src/services/pricingService.js',
  'src/services/subscriptionService.js',
  'src/services/subscriptionPaymentService.js',
  'src/services/superadminDashboardService.js',
  'src/services/userService.js',
  'src/services/whatsappNotifyService.js',
];

module.exports = [
  {
    files: ['src/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: '../config/prisma', message: 'Acesso a Prisma apenas via src/repositories/*' },
          { name: './config/prisma', message: 'Acesso a Prisma apenas via src/repositories/*' },
        ],
      }],
      'no-restricted-properties': ['error', ...SENSITIVE.map((m) => ({ property: m, message: 'Model sensível: use repositórios' }))],
      'no-restricted-syntax': ['error', ...RAW.map((m) => ({ selector: `MemberExpression[property.name='${m}']`, message: 'Raw/transação Prisma proibido fora de repositórios' }))],
    },
  },
  {
    files: [
      'src/repositories/**/*.js',
      'src/config/**/*.js',
      'scripts/**/*.js',
      'tests/**/*.js',
      ...ALLOWLIST,
    ],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
    },
  },
];
