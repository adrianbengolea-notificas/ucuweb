# UCU — Next.js + Firebase

Sitio nuevo para [ucu.org.ar](https://ucu.org.ar), migrado desde WordPress.

## Desarrollo local

```bash
cp .env.example .env.local
# Completar credenciales Firebase
npm install
npm run dev
```

Puerto local: **9005** (`http://localhost:9005`)

## Migración desde WordPress

1. Exportar desde el WordPress actual: Herramientas → Exportar → Todo el contenido
2. Guardar el XML en `imports/ucu.WordPress.2026-07-02.xml`
3. Crear proyecto Firebase (staging) y habilitar Firestore + Storage
4. Completar `.env.local` con credenciales Admin SDK
5. Ejecutar:

```bash
npm run migrate:wordpress:dry      # solo resumen
npm run migrate:wordpress:no-images  # sin subir imágenes (más rápido)
npm run migrate:wordpress            # migración completa
```

## Panel admin

URL: **http://localhost:9005/admin/login**

Variables en `.env.local`:

- `ADMIN_PANEL_EMAIL=abengolea1@gmail.com` (cuenta Google autorizada)
- `ADMIN_SESSION_SECRET=` (secreto largo aleatorio)
- `ADMIN_PANEL_PASSWORD=` (opcional, para ingreso con contraseña)

**Login con Google:** en [Firebase Console](https://console.firebase.google.com/) → Authentication → Sign-in method → activar **Google**. Agregar `localhost` en dominios autorizados para desarrollo.

Desde el panel podés:

- Ver y buscar notas existentes
- Crear y editar notas (título, slug, contenido, categorías, etiquetas, imagen, fecha, estado)
- Gestionar fallos del observatorio en `/admin/fallos` (misma sesión de admin)

## Migración del observatorio

Importar fallos y catálogos desde la API actual:

```bash
npm run migrate:observatorio:dry     # solo resumen
npm run migrate:observatorio           # importación completa (catálogos + fallos)
npm run migrate:observatorio:repair    # reimportar fallos con detalle completo
```

Variable opcional: `OBSERVATORIO_API_URL` (por defecto usa el VPS actual).

Tras la migración, `/observatorio` lee los datos desde Firestore.

## Reclamos (Usuarios Protegidos)

Sección migrada desde [consumidoresprotegidos.com.ar](https://consumidoresprotegidos.com.ar/).

Rutas públicas:

- `/reclamos` — landing
- `/reclamos/nuevo` — formulario de reclamo
- `/reclamos/consultar` — seguimiento por número + documento

Admin (misma sesión que notas y fallos):

- `/admin/reclamos` — listado
- `/admin/reclamos/[id]` — detalle y cambio de estado

### Catálogos iniciales

1. Copiar el SQL de setup a `imports/reclamos/ucu.sql`
2. Ejecutar:

```bash
npm run migrate:reclamos:catalogs:dry     # resumen
npm run migrate:reclamos:catalogs         # estados, provincias, ciudades, rubros
npm run migrate:reclamos:empresas         # incluye ~2700 empresas desde el sitio actual
```

Cuando consigas el backup de `v0021348_ucu_v2`, se podrá migrar el historial de reclamos.

### Migración directa desde SQL Server (opción B)

1. En **DonWeb → Bases de datos → `v0021348_ucu_v2`**, buscá credenciales y **acceso remoto** (habilitar + whitelist de tu IP pública).
2. Completar en `.env.local`:

```env
RECLAMOS_SQL_SERVER=...      # host externo que indique DonWeb
RECLAMOS_SQL_PASSWORD=...
```

3. Probar conexión:

```bash
npm run probe:reclamos:sql
```

4. Migrar los 6356 reclamos:

```bash
npm run migrate:reclamos:dry      # simulación
npm run migrate:reclamos:sample   # prueba 10 registros
npm run migrate:reclamos          # importación completa
```

Si el puerto 1433 no responde desde tu PC, DonWeb bloquea conexiones externas → pedir backup `.bak` y restaurar en SQL Server local, apuntando las mismas variables a `localhost`.

## Deploy staging (Firebase App Hosting)

```bash
firebase use ucu-web-staging
firebase deploy --only firestore:rules,storage:rules,firestore:indexes
# App Hosting: conectar repo y backend ucu-staging desde Firebase Console
```

## Archivos legacy

La configuración del WordPress anterior está en `legacy/` (no usar en producción).
