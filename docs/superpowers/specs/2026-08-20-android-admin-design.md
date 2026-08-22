# Android Admin App — Design Spec

**Data:** 2026-08-20
**Status:** Aprovado
**Branch:** feat/pix-asaas (sem commits)

## 1. Visão Geral

App Android nativo (Kotlin) para gerenciamento administrativo do sistema SIC-ia (Fábrica de Salgados Costa). O cardápio público permanece como web hospedado na Vercel. O app consome a mesma API REST do backend Node.js existente.

## 2. Escopo

### Telas Incluídas (11)

| # | Tela | Rota | Função |
|---|------|------|--------|
| 1 | Login | `login` | Autenticação JWT + Biometria |
| 2 | Dashboard | `dashboard` | Métricas gerais (pedidos/hora, resumo) |
| 3 | Principal > Pedidos | `orders` | Lista de pedidos com status |
| 4 | Principal > Lançar Pedido | `pdv` | PDV Balcão — busca, combos, envio |
| 5 | Financeiro > Relatórios | `reports` | Relatório de pedidos com filtros período |
| 6 | Financeiro > Controle de Caixa | `cashier` | Fechar caixa, sangria, suprimento |
| 7 | Entregas > Cadastro Entregadores | `drivers` | Cadastrar/editar entregadores |
| 8 | Entregas > Relatório Entregadores | `driver_reports` | Relatório por período |
| 9 | Painel > Painel Loja | `settings` | Config tema, horários, produtos, categorias |
| 10 | Integrações > WhatsApp | `whatsapp` | Conectar instância, QR Code, status |
| 11 | Administração > Gerenciamento | `superadmin` | Usuários, senhas, audit, clientes |

### Telas Excluídas
- **Entregador (motoboy)** — implementada depois
- **Cardápio público** — permanece web

## 3. Decisões Técnicas

| Decisão | Escolha |
|---------|---------|
| Tech | Kotlin nativo |
| Arquitetura | MVVM + Repository |
| UI | Jetpack Compose + Material Design 3 |
| Navegação | Híbrido (Bottom Bar + Drawer) |
| Tema | MD3 dark (#191919, #F26D3D, #1FA58D) + light + toggle manual |
| Push | Firebase Cloud Messaging |
| Offline | Não — internet obrigatória |
| Min SDK | API 26 (Android 8.0) |
| Target SDK | 34 (Android 14) |
| Mapas | Mapbox + Google Maps fallback |
| Biometria | Sim (BiometricPrompt) |
| Impressão | Bluetooth térmica (ESC/POS) |
| Câmera | Não |
| Splash | Logo + tema dark |
| Backend URL | Mesma Vercel (sem toggle) |

## 4. Bibliotecas

| Necessidade | Lib |
|-------------|-----|
| HTTP/REST | Retrofit + Gson |
| Imagens | Coil |
| Push notifications | Firebase FCM |
| Mapas | Mapbox SDK + Google Maps SDK |
| Navegação | Navigation Component |
| DI | Hilt (Dagger) |
| Token storage | EncryptedSharedPreferences |
| Biometria | BiometricPrompt (Jetpack Biometric) |
| Bluetooth | BluetoothSocket + ESC/POS |
| Crypto/JWT | com.auth0:java-jwt |

## 5. Estrutura do Projeto

```
sic-ia-android/
├── app/
│   ├── src/main/
│   │   ├── java/com/costa/sic/
│   │   │   ├── app/
│   │   │   │   ├── SICApplication.kt        ← Hilt Application
│   │   │   │   └── MainActivity.kt          ← Single Activity
│   │   │   │
│   │   │   ├── core/
│   │   │   │   ├── network/
│   │   │   │   │   ├── ApiService.kt
│   │   │   │   │   ├── AuthInterceptor.kt
│   │   │   │   │   └── NetworkModule.kt
│   │   │   │   ├── auth/
│   │   │   │   │   ├── AuthRepository.kt
│   │   │   │   │   ├── AuthManager.kt
│   │   │   │   │   └── BiometricHelper.kt
│   │   │   │   ├── theme/
│   │   │   │   │   ├── Color.kt
│   │   │   │   │   ├── Theme.kt
│   │   │   │   │   └── Type.kt
│   │   │   │   ├── di/
│   │   │   │   │   ├── AppModule.kt
│   │   │   │   │   └── NetworkModule.kt
│   │   │   │   ├── navigation/
│   │   │   │   │   ├── AppNavigation.kt
│   │   │   │   │   ├── BottomBar.kt
│   │   │   │   │   └── DrawerMenu.kt
│   │   │   │   └── util/
│   │   │   │       ├── Constants.kt
│   │   │   │       └── Extensions.kt
│   │   │   │
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── LoginScreen.kt
│   │   │   │   │   ├── LoginViewModel.kt
│   │   │   │   │   └── LoginRepository.kt
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── DashboardScreen.kt
│   │   │   │   │   └── DashboardViewModel.kt
│   │   │   │   ├── reports/
│   │   │   │   │   ├── ReportsScreen.kt
│   │   │   │   │   └── ReportsViewModel.kt
│   │   │   │   ├── pdv/
│   │   │   │   │   ├── PDVScreen.kt
│   │   │   │   │   └── PDVViewModel.kt
│   │   │   │   ├── orders/
│   │   │   │   │   ├── OrdersScreen.kt
│   │   │   │   │   ├── OrdersViewModel.kt
│   │   │   │   │   └── OrderDetailSheet.kt
│   │   │   │   ├── cashier/
│   │   │   │   │   ├── CashierScreen.kt
│   │   │   │   │   └── CashierViewModel.kt
│   │   │   │   ├── settings/
│   │   │   │   │   ├── SettingsScreen.kt
│   │   │   │   │   └── SettingsViewModel.kt
│   │   │   │   ├── drivers/
│   │   │   │   │   ├── DriversScreen.kt
│   │   │   │   │   └── DriversViewModel.kt
│   │   │   │   ├── driverreports/
│   │   │   │   │   ├── DriverReportsScreen.kt
│   │   │   │   │   └── DriverReportsViewModel.kt
│   │   │   │   ├── whatsapp/
│   │   │   │   │   ├── WhatsAppScreen.kt
│   │   │   │   │   └── WhatsAppViewModel.kt
│   │   │   │   └── superadmin/
│   │   │   │       ├── SuperAdminScreen.kt
│   │   │   │       └── SuperAdminViewModel.kt
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── components/
│   │   │       │   ├── OrderCard.kt
│   │   │       │   ├── ProductCard.kt
│   │   │       │   ├── StatusChip.kt
│   │   │       │   ├── SearchBar.kt
│   │   │       │   └── LoadingScreen.kt
│   │   │       ├── printer/
│   │   │       │   ├── ThermalPrinter.kt
│   │   │       │   └── PrintFormatter.kt
│   │   │       └── notification/
│   │   │           └── PushService.kt
│   │   │
│   │   ├── res/
│   │   │   ├── values/
│   │   │   │   ├── colors.xml
│   │   │   │   ├── themes.xml
│   │   │   │   └── strings.xml (pt-BR)
│   │   │   ├── drawable/
│   │   │   └── navigation/
│   │   │       └── nav_graph.xml
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts (project)
├── settings.gradle.kts
└── gradle/
```

## 6. Tema + Cores

### Paleta Light

```kotlin
val LightPrimary = Color(0xFFF26D3D)       // laranja
val LightOnPrimary = Color(0xFF000000)
val LightPrimaryContainer = Color(0xFFFFDBC9)
val LightSecondary = Color(0xFF1FA58D)     // verde
val LightBackground = Color(0xFFFAFAFA)
val LightSurface = Color(0xFFFFFFFF)
val LightOnBackground = Color(0xFF1C1B1F)
val LightOnSurface = Color(0xFF1C1B1F)
val LightError = Color(0xFFE53935)
```

### Paleta Dark

```kotlin
val DarkPrimary = Color(0xFFF26D3D)
val DarkOnPrimary = Color(0xFF000000)
val DarkPrimaryContainer = Color(0xFF8B3A1A)
val DarkSecondary = Color(0xFF1FA58D)
val DarkBackground = Color(0xFF191919)
val DarkSurface = Color(0xFF252525)
val DarkSurfaceVariant = Color(0xFF2A2A2A)
val DarkOnBackground = Color(0xFFFFFCE1)
val DarkOnSurface = Color(0xFFFFFCE1)
val DarkError = Color(0xFFE53935)
val DarkStatusBar = Color(0xFF0E100F)
```

### Toggle

- `ThemeMode.SYSTEM` — segue configuração do Android
- `ThemeMode.LIGHT` — força light
- `ThemeMode.DARK` — força dark
- Usuário escolhe via toggle em Settings

### Tipografia (MD3 padrão)

- headlineLarge: 28sp Bold
- headlineMedium: 24sp SemiBold
- titleLarge: 20sp SemiBold
- titleMedium: 16sp Medium
- bodyLarge: 16sp
- bodyMedium: 14sp
- labelLarge: 14sp Medium
- labelMedium: 12sp

### Splash Screen

- Logo: `drawable/ic_logo_costa`
- Background: `#191919` (DarkBackground)
- Accent: `#F26D3D`
- Duração: 1.5s com fade out

## 7. Navegação

### Padrão: Híbrido (Bottom Bar + Drawer)

**Bottom Bar (3-4 itens fixos):**

| Role | Bottom Bar |
|------|-----------|
| superadmin | Dashboard · Pedidos · Lançar · WhatsApp · ⋮ |
| admin | Dashboard · Pedidos · Lançar · WhatsApp · ⋮ |
| user | Pedidos · Lançar · WhatsApp · ⋮ |

**Drawer Menu (aberto via ⋮):**

| Role | Drawer |
|------|--------|
| superadmin | Relatórios · Caixa · Cadastro Entreg. · Rel. Entreg. · Painel Loja · Gerenciamento · Alterar Senha · Sair |
| admin | Relatórios · Caixa · Cadastro Entreg. · Rel. Entreg. · Painel Loja · Alterar Senha · Sair |
| user | Alterar Senha · Sair |

### Rotas

```kotlin
sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object Orders : Screen("orders")
    object PDV : Screen("pdv")
    object Reports : Screen("reports")
    object Cashier : Screen("cashier")
    object Drivers : Screen("drivers")
    object DriverReports : Screen("driver_reports")
    object Settings : Screen("settings")
    object WhatsApp : Screen("whatsapp")
    object SuperAdmin : Screen("superadmin")
    object ChangePassword : Screen("change_password")
}
```

### Fluxo

```
splash → (token) → main → dashboard (default, superadmin/admin)
                       → orders (default, user)
        → (sem)  → login → main
```

## 8. Telas Detalhadas

### 8.1 Login

- Campos: Usuário + Senha
- Botão "Entrar" → POST `/api/auth/login`
- Botão "Usar Digital" (se biométrica ativa + token válido)
- Splash com logo antes do login

### 8.2 Dashboard (superadmin/admin)

- Tela inicial para superadmin e admin
- GET `/api/pedidos` — métricas calculadas no frontend
- Métricas: pedidos/hora, total do dia, ticket médio, pedidos pendentes
- Cards: Vendas Hoje, Pedidos Hoje, Ticket Médio, Entregas
- Gráfico: pedidos por hora (últimas 12h)
- BottomBar: Dashboard · Pedidos · Lançar · WhatsApp · ⋮

### 8.3 Financeiro > Relatórios

- Filtros: Data Início, Data Fim
- GET `/api/pedidos` com filtros período
- Tabela: Data, Nº Pedido, Cliente, Total, Status, Forma Pagamento
- Totais: Total Vendas, Nº Pedidos, Ticket Médio
- Drawer: Relatórios (acesso via ⋮)

### 8.4 Principal > Pedidos

- GET `/api/pedidos` — pull-to-refresh
- Filtros: Todos, Pendente, Preparando, Saiu Entrega, Pronto
- Tap → BottomSheet com detalhes + mudar status
- Badge no 🔔 com contagem de pendentes
- Notificação sonora via FCM (foreground)

### 8.5 Principal > Lançar Pedido (PDV)

- GET `/api/produtos` — busca por nome, filtro categoria
- Botões +/- para quantidade
- Combos → BottomSheet de seleção (sabores, acrescimos)
- Carrinho: lista itens, subtotal, remove item
- Finalizar → POST `/api/pedidos` + impressão Bluetooth

### 8.6 Financeiro > Controle de Caixa

- GET `/api/caixa/status` — valor inicial, vendas, sangrias, suprimentos, saldo
- Botão "Abrir Caixa" → POST `/api/caixa/abrir`
- Botão "Sangria" → POST `/api/caixa/sangria`
- Botão "Suprimento" → POST `/api/caixa/suprimento`
- Botão "Fechar Caixa" → POST `/api/caixa/fechar` + impressão recibo

### 8.7 Entregas > Cadastro de Entregadores

- GET `/api/entregadores` — lista
- Busca por nome
- Toggle ativo/inativo
- Formulário: nome, telefone

### 8.8 Entregas > Relatório de Entregadores

- Filtros: Data Início, Data Fim, Entregador (select)
- GET `/api/entregas/resumo-periodo`
- Tabela: Entregador, Nº Entregas, Total Pedidos, Valor Entregas
- Expandível: pedidos por entregador (ID, data, cliente, bairro, pagamento, tipo entrega, itens, totais)
- Footer: TOTAL GERAL

### 8.9 Painel > Painel Loja (5 abas via TabRow)

**Horários:**
- Dias de funcionamento (checkbox por dia)
- Abertura/Fechamento (TimePicker)
- Override manual (Switch) + Status manual

**Produtos:**
- Busca + filtro status (Todos/Ativos/Pausados/Sem Estoque)
- Tabela: ID, Nome, Preço, Status, Ações
- Form CRUD: ID numérico, Nome, Preço, Descrição, Foto upload, Tipo (Simples/Combo Salgado/Combo Açaí), Status, Categoria
- Avançado: Congelado, Controlar Estoque (atual + mínimo), Ocultar quando esgotado

**Categorias:**
- Lista + form CRUD (nome)

**Config. Loja:**
- Nome, WhatsApp, Descrição
- Endereço: Logradouro, Número, Bairro, Cidade, Estado, CEP, Latitude, Longitude
- Logo upload, Banner upload
- Bairros atendidos + taxa de entrega

**Personalizar:**
- Cores: Primária, Fundo, Superfície, Texto (ColorPicker)
- Modo Escuro (Switch)
- Notificação Sonora: upload MP3/WAV/OGG (máx 500KB)

### 8.10 Integrações > WhatsApp

- GET `/api/whatsapp` — lista instâncias
- Se vazio: botão "Criar Instância" (nome + número)
- Se desconectado: QR Code + código de pareamento + polling status
- Se conectado: status 🟢, botões Teste/Atualizar
- Botão Deletar em todas

### 8.11 Administração > Gerenciamento (4 abas via TabRow)

**Usuários:**
- Tabela: Usuário, Papel, Loja, Criado em, Ações (excluir)
- Form: username, password, role (user/admin/superadmin)

**Senhas:**
- Select usuário → nova senha + confirmar → Salvar

**Registros (Audit):**
- Filtros: Usuário, Módulo (cliente/whatsapp/auth/pedido/geral), Severidade (info/warning/critical), Período
- Timeline de logs
- "Carregar mais" (paginação)

**Clientes:**
- Tabela: Nome, Telefone, Bairro, Criado em, Ações
- Modal Editar: nome, telefone, endereço, número, bairro, CEP, ponto referência
- Modal Trocar Senha
- Excluir

### 8.12 Alterar Senha

- Senha Atual + Nova Senha + Confirmar
- PUT `/api/usuarios/:id/password`

## 9. Data Layer

### API Client

Retrofit interface com todas as rotas do backend Node.js:
- Auth: login
- Pedidos: GET, GET/:id, POST, PUT/:id/status
- Produtos: GET
- Categorias: GET, POST, DELETE/:id
- Caixa: GET/status, POST/abrir, POST/sangria, POST/suprimento, POST/fechar
- Entregadores: GET, POST, PUT/:id
- Entregas: GET/resumo-periodo
- Loja: GET, PUT
- WhatsApp: GET, POST/criar, POST/:id/qrcode, GET/:id/status, POST/:id/teste, POST/:id/reconectar, DELETE/:id
- Usuarios: GET, POST, DELETE/:id, PUT/:id/password
- Audit: GET (com query params)
- Admin Clientes: GET, PUT/:id, DELETE/:id, PUT/:id/password
- Upload: POST (multipart)

### Models

Data classes Kotlin correspondentes a cada response do backend.

### Repository Pattern

Cada feature tem seu Repository que abstrai a chamada API e retorna `Result<T>`.

## 10. Push Notifications (FCM)

- `PushService` extends `FirebaseMessagingService`
- `onNewToken` → POST `/api/loja` com fcmToken
- `onMessageReceived` → mostrar notificação nativa + emitir evento se foreground
- Canal "pedidos" comImportance HIGH + vibração
- Som custom: MediaPlayer com URL do som da loja, fallback ToneGenerator

## 11. Bluetooth Thermal Printer

- Conexão: BluetoothSocket + UUID `00001101-0000-1000-8000-00805F9B34FB`
- Detecta impressora por nome (POS, TM, THERMAL)
- ESC/POS: INIT, CENTER, LEFT, BOLD_ON/OFF, CUT
- printComanda(pedido): logo, nº pedido, data, cliente, itens, total
- printReciboCaixa(caixa): data, valor inicial, vendas, sangrias, suprimentos, saldo
- Integração: PDV após enviar pedido, Caixa após fechar

## 12. Biometria + Auth Flow

- `AuthManager`: EncryptedSharedPreferences com AES256_GCM
- Token JWT salvo no login
- `BiometricHelper`: BiometricPrompt wrapper
- Login: tela com botão "Usar Digital" se biométrica ativa + token válido
- Splash: checa token → válido vai direto pra main (sem login)
- Logout: limpa prefs → volta pro login

## 13. Permissões AndroidManifest

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## 14. Fluxo de Dados

```
UI (Compose) ←→ ViewModel ←→ Repository ←→ ApiService ←→ Backend Node.js
                                            ↕
                                     AuthManager (token)
```

## 15. Fora do Escopo

- Cardápio público (permanece web)
- Tela Entregador (implementação futura)
- Offline/sync
- Câmera/QR Code scanning
- Multi-idioma (só pt-BR)
