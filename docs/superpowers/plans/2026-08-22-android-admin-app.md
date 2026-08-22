# Android Admin App - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Kotlin native Android admin app (11 screens) consuming the existing SIC-ia REST API, with MD3 dark/light theme, FCM push, Bluetooth thermal printing, and biometric auth.

**Architecture:** Single-Activity Compose app with MVVM + Repository. Hilt DI. Retrofit HTTP. Navigation Component routing. Each feature = Screen + ViewModel + Repository.

**Tech Stack:** Kotlin, Jetpack Compose, Material Design 3, Hilt, Retrofit + Gson, Coil, Firebase FCM, Navigation Component, EncryptedSharedPreferences, BiometricPrompt, BluetoothSocket ESC/POS, Mapbox SDK

## Global Constraints

- Min SDK: 26 (Android 8.0), Target SDK: 34 (Android 14)
- Backend URL: same Vercel deployment (no environment toggle)
- Language: pt-BR only
- No offline/sync - internet required
- No camera
- Theme colors: Dark #191919, Primary #F26D3D, Secondary #1FA58D
- Branch: create `feat/android-admin` from current `feat/pix-asaas`

## File Map

| Task | Files Created |
|------|--------------|
| 1. Scaffolding | `sic-ia-android/` gradle, manifest, resources, .gitignore |
| 2. Theme | `core/theme/Color.kt`, `Type.kt`, `Theme.kt` |
| 3. Utils | `core/util/Constants.kt`, `Extensions.kt` |
| 4. Network | `core/network/ApiService.kt`, `AuthInterceptor.kt`, `NetworkModule.kt` |
| 5. Auth | `core/auth/AuthManager.kt`, `AuthRepository.kt`, `BiometricHelper.kt` |
| 6. DI | `app/SICApplication.kt`, `core/di/AppModule.kt` |
| 7. Navigation | `core/navigation/AppNavigation.kt`, `BottomBar.kt`, `DrawerMenu.kt` |
| 8. MainActivity | `app/MainActivity.kt` |
| 9. Shared Components | `shared/components/OrderCard.kt`, `StatusChip.kt`, `SearchBar.kt`, `LoadingScreen.kt` |
| 10. Login | `features/auth/LoginScreen.kt`, `LoginViewModel.kt`, `LoginRepository.kt` |
| 11. Dashboard | `features/dashboard/DashboardScreen.kt`, `DashboardViewModel.kt` |
| 12. Orders | `features/orders/OrdersScreen.kt`, `OrdersViewModel.kt`, `OrderDetailSheet.kt` |
| 13. PDV | `features/pdv/PDVScreen.kt`, `PDVViewModel.kt` |
| 14. Reports | `features/reports/ReportsScreen.kt`, `ReportsViewModel.kt` |
| 15. Cashier | `features/cashier/CashierScreen.kt`, `CashierViewModel.kt` |
| 16. Drivers | `features/drivers/DriversScreen.kt`, `DriversViewModel.kt` |
| 17. Driver Reports | `features/driverreports/DriverReportsScreen.kt`, `DriverReportsViewModel.kt` |
| 18. Settings | `features/settings/SettingsScreen.kt`, `SettingsViewModel.kt` |
| 19. WhatsApp | `features/whatsapp/WhatsAppScreen.kt`, `WhatsAppViewModel.kt` |
| 20. SuperAdmin | `features/superadmin/SuperAdminScreen.kt`, `SuperAdminViewModel.kt` |
| 21. Change Password | `features/auth/ChangePasswordScreen.kt`, `ChangePasswordViewModel.kt` |
| 22. Printer | `shared/printer/ThermalPrinter.kt`, `PrintFormatter.kt` |
| 23. Push | `shared/notification/PushService.kt` |
| 24. Splash | `app/SplashActivity.kt` |

---

## Phase 1: Foundation (Tasks 1-8)

### Task 1: Create Android Project Structure

**Files:**
- Create: `sic-ia-android/settings.gradle.kts`
- Create: `sic-ia-android/build.gradle.kts`
- Create: `sic-ia-android/app/build.gradle.kts`
- Create: `sic-ia-android/app/src/main/AndroidManifest.xml`
- Create: `sic-ia-android/app/src/main/res/values/strings.xml`
- Create: `sic-ia-android/app/src/main/res/values/themes.xml`
- Create: `sic-ia-android/.gitignore`

**Interfaces:** None - standalone scaffolding.

- [ ] **Step 1: Create project root files**

`sic-ia-android/settings.gradle.kts`:
```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "SIC-ia"
include(":app")
```

`sic-ia-android/build.gradle.kts`:
```kotlin
plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
    id("com.google.dagger.hilt.android") version "2.50" apply false
    id("com.google.gms.google-services") version "4.4.0" apply false
}
```

- [ ] **Step 2: Create app/build.gradle.kts**

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("kotlin-kapt")
    id("com.google.dagger.hilt.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.costa.sic"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.costa.sic"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    composeOptions { kotlinCompilerExtensionVersion = "1.5.8" }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.01.00")
    implementation(composeBom)
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.navigation:navigation-compose:2.7.6")
    implementation("com.google.dagger:hilt-android:2.50")
    kapt("com.google.dagger:hilt-android-compiler:2.50")
    implementation("androidx.hilt:hilt-navigation-compose:1.1.0")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.auth0:java-jwt:4.4.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("io.coil-kt:coil-compose:2.5.0")
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("androidx.core:core-splashscreen:1.0.1")
}
```

- [ ] **Step 3: Create AndroidManifest.xml**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <application
        android:name=".app.SICApplication"
        android:allowBackup="false"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.SICIA">
        <activity android:name=".app.MainActivity" android:exported="true" android:theme="@style/Theme.SICIA">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <service android:name=".shared.notification.PushService" android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>
</manifest>
```

- [ ] **Step 4: Create resource files**

`res/values/strings.xml`:
```xml
<resources>
    <string name="app_name">SIC-ia</string>
    <string name="login">Entrar</string>
    <string name="username">Usuário</string>
    <string name="password">Senha</string>
    <string name="use_biometric">Usar Digital</string>
    <string name="dashboard">Dashboard</string>
    <string name="orders">Pedidos</string>
    <string name="pdv">Lançar</string>
    <string name="reports">Relatórios</string>
    <string name="cashier">Caixa</string>
    <string name="drivers">Entregadores</string>
    <string name="driver_reports">Rel. Entregadores</string>
    <string name="settings">Painel Loja</string>
    <string name="whatsapp">WhatsApp</string>
    <string name="superadmin">Gerenciamento</string>
    <string name="change_password">Alterar Senha</string>
    <string name="logout">Sair</string>
</resources>
```

`res/values/themes.xml`:
```xml
<resources>
    <style name="Theme.SICIA" parent="android:Theme.Material.Light.NoActionBar" />
</resources>
```

- [ ] **Step 5: Commit**

```bash
git add sic-ia-android/
git commit -m "feat(android): scaffold project structure with gradle, manifest, resources"
```

---

### Task 2: Core Theme (Colors, Typography, Theme Toggle)

**Files:**
- Create: `app/src/main/java/com/costa/sic/core/theme/Color.kt`
- Create: `app/src/main/java/com/costa/sic/core/theme/Type.kt`
- Create: `app/src/main/java/com/costa/sic/core/theme/Theme.kt`

**Interfaces:** Consumes: Task 1. Produces: `SICTheme` composable, `ThemeMode` enum.

- [ ] **Step 1: Create Color.kt**

```kotlin
package com.costa.sic.core.theme
import androidx.compose.ui.graphics.Color

val LightPrimary = Color(0xFFF26D3D)
val LightOnPrimary = Color(0xFF000000)
val LightPrimaryContainer = Color(0xFFFFDBC9)
val LightSecondary = Color(0xFF1FA58D)
val LightBackground = Color(0xFFFAFAFA)
val LightSurface = Color(0xFFFFFFFF)
val LightOnBackground = Color(0xFF1C1B1F)
val LightOnSurface = Color(0xFF1C1B1F)
val LightError = Color(0xFFE53935)

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

- [ ] **Step 2: Create Type.kt**

```kotlin
package com.costa.sic.core.theme
import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val SICTypography = Typography(
    headlineLarge = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Bold),
    headlineMedium = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.SemiBold),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Medium),
    bodyLarge = TextStyle(fontSize = 16.sp),
    bodyMedium = TextStyle(fontSize = 14.sp),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium),
    labelMedium = TextStyle(fontSize = 12.sp),
)
```

- [ ] **Step 3: Create Theme.kt**

```kotlin
package com.costa.sic.core.theme
import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = DarkPrimary, onPrimary = DarkOnPrimary,
    primaryContainer = DarkPrimaryContainer, secondary = DarkSecondary,
    background = DarkBackground, surface = DarkSurface,
    surfaceVariant = DarkSurfaceVariant, onBackground = DarkOnBackground,
    onSurface = DarkOnSurface, error = DarkError,
)
private val LightColorScheme = lightColorScheme(
    primary = LightPrimary, onPrimary = LightOnPrimary,
    primaryContainer = LightPrimaryContainer, secondary = LightSecondary,
    background = LightBackground, surface = LightSurface,
    onBackground = LightOnBackground, onSurface = LightOnSurface, error = LightError,
)

enum class ThemeMode { SYSTEM, LIGHT, DARK }

@Composable
fun SICTheme(themeMode: ThemeMode = ThemeMode.SYSTEM, content: @Composable () -> Unit) {
    val isDark = when (themeMode) {
        ThemeMode.LIGHT -> false; ThemeMode.DARK -> true; ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }
    val colorScheme = if (isDark) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !isDark
        }
    }
    MaterialTheme(colorScheme = colorScheme, typography = SICTypography, content = content)
}
```

- [ ] **Step 4: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/core/theme/
git commit -m "feat(android): add MD3 theme with dark/light palettes and toggle"
```

---

### Task 3: Constants + Extensions

**Files:**
- Create: `app/src/main/java/com/costa/sic/core/util/Constants.kt`
- Create: `app/src/main/java/com/costa/sic/core/util/Extensions.kt`

**Interfaces:** Produces: `BASE_URL`, `String.toDateFormatted()`, `Double.toCurrencyBR()`

- [ ] **Step 1: Create Constants.kt**

```kotlin
package com.costa.sic.core.util

object Constants {
    const val BASE_URL = "https://salgadoscosta.vercel.app"
    const val PREFS_NAME = "sic_ia_prefs"
    const val TOKEN_KEY = "jwt_token"
    const val USER_ROLE_KEY = "user_role"
    const val USERNAME_KEY = "username"
    const val USER_ID_KEY = "user_id"
    const val THEME_MODE_KEY = "theme_mode"
}
```

- [ ] **Step 2: Create Extensions.kt**

```kotlin
package com.costa.sic.core.util
import java.text.SimpleDateFormat
import java.util.Locale

fun String.toDateFormatted(): String = try {
    val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
    val output = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
    output.format(input.parse(this) ?: return this)
} catch (e: Exception) { this }

fun Double.toCurrencyBR(): String = String.format(Locale("pt", "BR"), "R$ %.2f", this)
```

- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/core/util/
git commit -m "feat(android): add constants and string/date extensions"
```

---

### Task 4: Network Layer (Retrofit + Auth Interceptor)

**Files:**
- Create: `app/src/main/java/com/costa/sic/core/network/ApiService.kt`
- Create: `app/src/main/java/com/costa/sic/core/network/AuthInterceptor.kt`
- Create: `app/src/main/java/com/costa/sic/core/network/NetworkModule.kt`

**Interfaces:** Consumes: Task 3. Produces: `ApiService` interface, Hilt NetworkModule.

- [ ] **Step 1: Create ApiService.kt** - All data classes + Retrofit interface with all endpoints (auth, pedidos, produtos, categorias, caixa, entregadores, entregas, loja, whatsapp, usuarios, audit, clientes, upload). See spec section 9 for full endpoint list.

- [ ] **Step 2: Create AuthInterceptor.kt**

```kotlin
package com.costa.sic.core.network
import com.costa.sic.core.auth.AuthManager
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class AuthInterceptor @Inject constructor(private val authManager: AuthManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = authManager.getToken()
        val request = if (token != null) chain.request().newBuilder().addHeader("Authorization", "Bearer $token").build()
        else chain.request()
        return chain.proceed(request)
    }
}
```

- [ ] **Step 3: Create NetworkModule.kt** - Hilt `@Module` providing OkHttpClient (with AuthInterceptor + logging), Retrofit (BASE_URL + Gson), ApiService.

- [ ] **Step 4: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/core/network/
git commit -m "feat(android): add Retrofit API service, auth interceptor, network module"
```

---

### Task 5: Auth Manager + Auth Repository

**Files:**
- Create: `app/src/main/java/com/costa/sic/core/auth/AuthManager.kt`
- Create: `app/src/main/java/com/costa/sic/core/auth/AuthRepository.kt`
- Create: `app/src/main/java/com/costa/sic/core/auth/BiometricHelper.kt`

**Interfaces:** Consumes: Task 3, Task 4. Produces: `AuthManager.getToken()/.saveToken()/.clear()`, `AuthRepository.login()`, `BiometricHelper.canAuthenticate()/.authenticate()`

- [ ] **Step 1: Create AuthManager.kt** - EncryptedSharedPreferences wrapper with AES256_GCM, save/load/clear token + user data.
- [ ] **Step 2: Create AuthRepository.kt** - `login()` calls api.login(), saves token via AuthManager, returns `AuthResult`. `logout()` clears prefs.
- [ ] **Step 3: Create BiometricHelper.kt** - `canAuthenticate()` checks BiometricManager. `authenticate()` wraps BiometricPrompt.
- [ ] **Step 4: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/core/auth/
git commit -m "feat(android): add AuthManager, AuthRepository, BiometricHelper"
```

---

### Task 6: Hilt Application + DI Modules

**Files:**
- Create: `app/src/main/java/com/costa/sic/app/SICApplication.kt`
- Create: `app/src/main/java/com/costa/sic/core/di/AppModule.kt`

- [ ] **Step 1: Create SICApplication.kt** - `@HiltAndroidApp` Application class.
- [ ] **Step 2: Create AppModule.kt** - `@Module` providing AuthManager.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/app/ sic-ia-android/app/src/main/java/com/costa/sic/core/di/
git commit -m "feat(android): add Hilt application and DI modules"
```

---

### Task 7: Navigation Graph + Bottom Bar + Drawer

**Files:**
- Create: `app/src/main/java/com/costa/sic/core/navigation/AppNavigation.kt`
- Create: `app/src/main/java/com/costa/sic/core/navigation/BottomBar.kt`
- Create: `app/src/main/java/com/costa/sic/core/navigation/DrawerMenu.kt`

**Interfaces:** Produces: `Screen` sealed class (12 routes), `getBottomBarItems(role)`, `getDrawerItems(role)`, `AppBottomBar`, `DrawerMenu`

- [ ] **Step 1: Create AppNavigation.kt** - Sealed class with all 12 Screen routes (Login, Dashboard, Orders, PDV, Reports, Cashier, Drivers, DriverReports, Settings, WhatsApp, SuperAdmin, ChangePassword).
- [ ] **Step 2: Create BottomBar.kt** - Role-based items: superadmin/admin get Dashboard+Pedidos+Lancar+WhatsApp; user gets Pedidos+Lancar+WhatsApp. Overflow menu via icon.
- [ ] **Step 3: Create DrawerMenu.kt** - Role-based drawer: superadmin gets all 8 items; admin gets 7 (no Gerenciamento); user gets 2 (Alterar Senha + Sair).
- [ ] **Step 4: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/core/navigation/
git commit -m "feat(android): add navigation with role-based bottom bar and drawer"
```

---

### Task 8: MainActivity

**Files:**
- Create: `app/src/main/java/com/costa/sic/app/MainActivity.kt`

**Interfaces:** Consumes: Task 5 (AuthManager), Task 7 (Navigation). Produces: Single Activity hosting NavHost.

- [ ] **Step 1: Create MainActivity.kt** - `@AndroidEntryPoint`, Scaffold with BottomBar + DrawerState, NavHost with all 12 routes. Check token on launch -> route to Login or default screen based on role.
- [ ] **Step 2: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/app/MainActivity.kt
git commit -m "feat(android): add MainActivity with NavHost and auth routing"
```

---

## Phase 2: Shared Components + Auth (Tasks 9-10)

### Task 9: Shared UI Components

**Files:**
- Create: `app/src/main/java/com/costa/sic/shared/components/OrderCard.kt`
- Create: `app/src/main/java/com/costa/sic/shared/components/StatusChip.kt`
- Create: `app/src/main/java/com/costa/sic/shared/components/SearchBar.kt`
- Create: `app/src/main/java/com/costa/sic/shared/components/LoadingScreen.kt`

**Interfaces:** Produces: `OrderCard(pedido, onClick)`, `StatusChip(status)`, `SearchBar(query, onQueryChange)`, `LoadingScreen()`, `EmptyScreen(message)`

- [ ] **Step 1: Create StatusChip.kt** - Colored chip mapping status string to color (pendente=orange, preparando=blue, em_rota=green, pronto=green, cancelado=red).
- [ ] **Step 2: Create OrderCard.kt** - Card showing order ID, client name, total, status chip, time. Clickable.
- [ ] **Step 3: Create SearchBar.kt** - OutlinedTextField with search icon, debounce.
- [ ] **Step 4: Create LoadingScreen.kt** - Centered CircularProgressIndicator + optional message. Also `EmptyScreen` with icon + message.
- [ ] **Step 5: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/shared/components/
git commit -m "feat(android): add shared UI components (OrderCard, StatusChip, SearchBar, Loading)"
```

---

### Task 10: Login Screen

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/auth/LoginRepository.kt`
- Create: `app/src/main/java/com/costa/sic/features/auth/LoginViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/auth/LoginScreen.kt`

**Interfaces:** Consumes: Task 5 (AuthRepository, BiometricHelper), Task 2 (SICTheme). Produces: Login screen with user/pass fields + biometric button.

- [ ] **Step 1: Create LoginRepository.kt** - Wraps core AuthRepository with UI state (Loading/Success/Error).
- [ ] **Step 2: Create LoginViewModel.kt** - `login(username, password)` calls LoginRepository. `loginWithBiometric()` calls BiometricHelper. Exposes `uiState: StateFlow<LoginUiState>`.
- [ ] **Step 3: Create LoginScreen.kt** - Composable: logo, username field, password field, "Entrar" button, "Usar Digital" button (visible if biometric available + token saved). Shows loading/error states.
- [ ] **Step 4: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/auth/
git commit -m "feat(android): add login screen with biometric support"
```

---

## Phase 3: Core Screens (Tasks 11-15)

### Task 11: Dashboard Screen

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/dashboard/DashboardViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/dashboard/DashboardScreen.kt`

**Interfaces:** Consumes: Task 4 (ApiService). Produces: Dashboard with metrics cards + hourly chart.

- [ ] **Step 1: Create DashboardViewModel.kt** - Fetches `/api/pedidos`, computes: totalVendas, totalPedidos, ticketMedio, pedidosPendentes, pedidosPorHora (last 12h).
- [ ] **Step 2: Create DashboardScreen.kt** - 4 metric cards (Vendas Hoje, Pedidos Hoje, Ticket Medio, Pendentes) + LazyColumn with hourly bar chart.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/dashboard/
git commit -m "feat(android): add dashboard with sales metrics and hourly chart"
```

---

### Task 12: Orders Screen

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/orders/OrdersViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/orders/OrdersScreen.kt`
- Create: `app/src/main/java/com/costa/sic/features/orders/OrderDetailSheet.kt`

**Interfaces:** Consumes: Task 4 (ApiService), Task 9 (OrderCard, StatusChip, SearchBar). Produces: Orders list with filter chips + pull-to-refresh + bottom sheet detail.

- [ ] **Step 1: Create OrdersViewModel.kt** - `fetchOrders()`, `filterByStatus(status)`, `updateOrderStatus(id, status)`. `uiState: StateFlow` with orders list + filter + loading.
- [ ] **Step 2: Create OrdersScreen.kt** - FilterRow (Todos/Pendente/Preparando/Saiu Entrega/Pronto), LazyColumn of OrderCards, pull-to-refresh, FAB with pending count badge.
- [ ] **Step 3: Create OrderDetailSheet.kt** - BottomSheet: order items list, client info, status change buttons.
- [ ] **Step 4: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/orders/
git commit -m "feat(android): add orders list with filters, detail sheet, status change"
```

---

### Task 13: PDV Screen (Counter/POS)

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/pdv/PDVViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/pdv/PDVScreen.kt`

**Interfaces:** Consumes: Task 4 (ApiService), Task 22 (ThermalPrinter). Produces: POS with product search, cart, combo selection, order submission.

- [ ] **Step 1: Create PDVViewModel.kt** - Products list, cart (items + quantities), search filter, category filter. `addToCart()`, `removeFromCart()`, `submitOrder()` -> POST `/api/pedidos` + print.
- [ ] **Step 2: Create PDVScreen.kt** - SearchBar + category chips + product grid (name, price, +/- buttons) + cart bottom panel (items list, subtotal, "Finalizar" button). Combos open BottomSheet for flavor/acrescimo selection.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/pdv/
git commit -m "feat(android): add PDV counter with product search, cart, combo selection"
```

---

### Task 14: Reports Screen

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/reports/ReportsViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/reports/ReportsScreen.kt`

**Interfaces:** Consumes: Task 4 (ApiService). Produces: Date-filtered order report with totals.

- [ ] **Step 1: Create ReportsViewModel.kt** - `fetchReport(startDate, endDate)` -> GET `/api/pedidos` with date filter. Computes totalVendas, totalPedidos, ticketMedio.
- [ ] **Step 2: Create ReportsScreen.kt** - Date pickers (start/end), table (Data, Pedido, Cliente, Total, Status, Pagamento), footer totals.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/reports/
git commit -m "feat(android): add reports screen with date filters and sales summary"
```

---

### Task 15: Cashier Screen

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/cashier/CashierViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/cashier/CashierScreen.kt`

**Interfaces:** Consumes: Task 4 (ApiService), Task 22 (ThermalPrinter). Produces: Cashier control with open/close/sangria/suprimento.

- [ ] **Step 1: Create CashierViewModel.kt** - `fetchStatus()`, `abrirCaixa(valorInicial)`, `sangria(valor, desc)`, `suprimento(valor, desc)`, `fecharCaixa()` + print receipt.
- [ ] **Step 2: Create CashierScreen.kt** - Status card (aberto/fechado, saldo, vendas, sangrias, suprimentos). Action buttons: Abrir/Sangria/Suprimento/Fechar. Dialogs for value input.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/cashier/
git commit -m "feat(android): add cashier control with open/close/sangria/suprimento"
```

---

## Phase 4: Delivery + Store + Integrations (Tasks 16-21)

### Task 16: Drivers Screen

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/drivers/DriversViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/drivers/DriversScreen.kt`

- [ ] **Step 1: Create DriversViewModel.kt** - CRUD for entregadores: list, create, update, toggle active.
- [ ] **Step 2: Create DriversScreen.kt** - Searchable list with toggle active/inactive, FAB to add, dialog for name/phone form.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/drivers/
git commit -m "feat(android): add drivers management screen"
```

---

### Task 17: Driver Reports Screen

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/driverreports/DriverReportsViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/driverreports/DriverReportsScreen.kt`

- [ ] **Step 1: Create DriverReportsViewModel.kt** - `fetchReport(startDate, endDate, driverId)` -> GET `/api/entregas/resumo-periodo`.
- [ ] **Step 2: Create DriverReportsScreen.kt** - Date pickers + driver select + expandable cards per driver (deliveries count, totals, order details).
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/driverreports/
git commit -m "feat(android): add driver reports screen with period filter"
```

---

### Task 18: Settings Screen (5 tabs)

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/settings/SettingsViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/settings/SettingsScreen.kt`

**Interfaces:** Consumes: Task 4 (ApiService). Produces: 5-tab settings (Horarios, Produtos, Categorias, Config Loja, Personalizar).

- [ ] **Step 1: Create SettingsViewModel.kt** - State for all 5 tabs: horarios, products CRUD, categories CRUD, loja config, theme/sound.
- [ ] **Step 2: Create SettingsScreen.kt** - TabRow with 5 tabs. Each tab: Horarios=checkboxes+timepickers, Produtos=search+table+form, Categorias=list+form, Config=fields+upload, Personalizar=color pickers+toggle+sound upload.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/settings/
git commit -m "feat(android): add settings screen with 5 tabs (hours, products, categories, config, theme)"
```

---

### Task 19: WhatsApp Screen

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/whatsapp/WhatsAppViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/whatsapp/WhatsAppScreen.kt`

- [ ] **Step 1: Create WhatsAppViewModel.kt** - List instances, create, get QR code, poll status, delete.
- [ ] **Step 2: Create WhatsAppScreen.kt** - If empty: create form. If disconnected: QR code image + polling. If connected: green status + test button. Delete button always visible.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/whatsapp/
git commit -m "feat(android): add WhatsApp integration screen with QR code"
```

---

### Task 20: SuperAdmin Screen (4 tabs)

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/superadmin/SuperAdminViewModel.kt`
- Create: `app/src/main/java/com/costa/sic/features/superadmin/SuperAdminScreen.kt`

- [ ] **Step 1: Create SuperAdminViewModel.kt** - 4 tab states: users CRUD, password change, audit logs (paginated), clients CRUD.
- [ ] **Step 2: Create SuperAdminScreen.kt** - TabRow: Usuarios=table+create, Senhas=select+password form, Registros=filter+timeline, Clientes=table+edit modal+delete.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/superadmin/
git commit -m "feat(android): add superadmin management screen with 4 tabs"
```

---

### Task 21: Change Password Screen

**Files:**
- Create: `app/src/main/java/com/costa/sic/features/auth/ChangePasswordScreen.kt`
- Create: `app/src/main/java/com/costa/sic/features/auth/ChangePasswordViewModel.kt`

- [ ] **Step 1: Create ChangePasswordViewModel.kt** - `changePassword(current, new, confirm)` -> PUT `/api/usuarios/:id/password`.
- [ ] **Step 2: Create ChangePasswordScreen.kt** - 3 password fields + save button.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/features/auth/ChangePasswordScreen.kt sic-ia-android/app/src/main/java/com/costa/sic/features/auth/ChangePasswordViewModel.kt
git commit -m "feat(android): add change password screen"
```

---

## Phase 5: Integrations (Tasks 22-24)

### Task 22: Bluetooth Thermal Printer

**Files:**
- Create: `app/src/main/java/com/costa/sic/shared/printer/ThermalPrinter.kt`
- Create: `app/src/main/java/com/costa/sic/shared/printer/PrintFormatter.kt`

- [ ] **Step 1: Create ThermalPrinter.kt** - `connect()` discovers printer by name (POS/TM/THERMAL), opens BluetoothSocket with UUID `00001101-0000-1000-8000-00805F9B34FB`. `print(bytes)` writes ESC/POS commands. `disconnect()`.
- [ ] **Step 2: Create PrintFormatter.kt** - `formatComanda(pedido)`: logo + order# + date + client + items + total. `formatReciboCaixa(caixa)`: date + initial value + sales + sangrias + suprimentos + balance. Both return ByteArray with ESC/POS (INIT, CENTER, BOLD, CUT).
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/shared/printer/
git commit -m "feat(android): add Bluetooth thermal printer with ESC/POS formatting"
```

---

### Task 23: Push Notifications (FCM)

**Files:**
- Create: `app/src/main/java/com/costa/sic/shared/notification/PushService.kt`

- [ ] **Step 1: Create PushService.kt** - Extends `FirebaseMessagingService`. `onNewToken()` -> POST token to backend. `onMessageReceived()` -> show native notification with channel "pedidos" (HIGH importance, vibration). If foreground: emit event for order list refresh. Custom sound from `MediaPlayer` with fallback to `ToneGenerator`.
- [ ] **Step 2: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/shared/notification/PushService.kt
git commit -m "feat(android): add FCM push notification service"
```

---

### Task 24: Splash Screen

**Files:**
- Create: `app/src/main/java/com/costa/sic/app/SplashActivity.kt`

**Interfaces:** Consumes: Task 5 (AuthManager). Produces: Splash -> auto-route to Login or Main.

- [ ] **Step 1: Create SplashActivity.kt** - Uses `core-splashscreen` API. Shows logo on dark background (#191919). After 1.5s: check `AuthManager.isLoggedIn()` -> navigate to MainActivity (with role) or LoginScreen.
- [ ] **Step 2: Update AndroidManifest.xml** - Change launcher activity to SplashActivity, move intent-filter.
- [ ] **Step 3: Commit**

```bash
git add sic-ia-android/app/src/main/java/com/costa/sic/app/SplashActivity.kt sic-ia-android/app/src/main/AndroidManifest.xml
git commit -m "feat(android): add splash screen with auth routing"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Foundation | 1-8 | Project setup, theme, network, auth, DI, navigation, main activity |
| 2. Shared + Auth | 9-10 | Reusable components, login screen |
| 3. Core Screens | 11-15 | Dashboard, Orders, PDV, Reports, Cashier |
| 4. Delivery + Store | 16-21 | Drivers, Driver Reports, Settings, WhatsApp, SuperAdmin, Change Password |
| 5. Integrations | 22-24 | Printer, FCM, Splash |

**Total: 24 tasks, ~80 files**

**Verification:** Each task commits independently. After Task 8, app compiles and shows navigation. After Task 10, login works. After Task 12, orders display. Full feature parity after Task 21. Integrations (22-24) are additive.
