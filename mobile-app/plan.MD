# Plan Maestro - App Mobile Finanzas

Documento ejecutivo del proyecto: vision, alcance, arquitectura, guia de ejecucion y bitacora paso a paso.

---

## 1. Vision del producto

Crear una app mobile de finanzas personales (Expo + React Native + TypeScript) que permita a cualquier usuario:

- entrar de forma segura,
- entender rapidamente su salud financiera,
- registrar y corregir movimientos,
- planificar metas de ahorro,
- analizar tendencias en reportes.

### Objetivo de experiencia
- Interfaz limpia, moderna y rapida.
- Navegacion simple en 5 secciones clave.
- Informacion financiera accionable desde la pantalla principal.

---

## 2. Alcance funcional

## 2.1 Acceso y seguridad
- Login y registro manual obligatorio.
- Recuperacion de contrasena.
- Sesion persistente (`accessToken` + `refreshToken`).
- Renovacion silenciosa de token ante `401`.
- Bloqueo biometrico al abrir la app.

> Estado actual: el login con Google fue removido completamente por decision de producto.

## 2.2 Navegacion principal
- Barra inferior con tabs:
  - `Inicio`
  - `Movimientos`
  - `Agregar`
  - `Metas`
  - `Reportes`

## 2.3 Inicio (Dashboard)
- Saludo contextual segun horario.
- Fecha actual completa en cabecera (ej: `24 de abril 2026`).
- Balance disponible.
- KPI de ingresos, egresos y ahorro.
- Porcentaje gastado del mes.
- Bloque de gastos fijos.
- Comparativa vs mes anterior.
- Ultimos movimientos.

## 2.4 Movimientos
- Listado de transacciones.
- Edicion y eliminacion.
- Filtro por mes y otras dimensiones.

## 2.5 Agregar
- Alta de ingreso o egreso.
- Seleccion de categoria.
- Marca de movimiento recurrente.

## 2.6 Metas
- Crear metas de ahorro.
- Aportar monto a metas.
- Editar y eliminar metas.

## 2.7 Reportes
- Resumen mensual.
- Comparativo historico.
- Gasto por categoria.
- Visualizacion de presupuestos.

---

## 3. Arquitectura implementada

### Frontend mobile
- `App.tsx`: orquestador de autenticacion, carga inicial, tabs y refresco global.
- `src/mobile/screens/`: pantallas por dominio (`Auth`, `Dashboard`, `Transactions`, `Add`, `Goals`, `Reports`, `Onboarding`).
- `src/mobile/components/`: componentes reutilizables (`DonutChart`, `PuduFinanciero`, etc.).
- `src/mobile/theme/colors.ts`: paleta centralizada.

### Capa de datos
- `src/mobile/api/client.ts`:
  - endpoints de auth,
  - categorias/transacciones,
  - metas/presupuestos/reportes,
  - manejo de tokens en `AsyncStorage`,
  - retry via refresh token.

---

## 4. Guia para ejecutar todo

## 4.1 Requisitos previos
- Node.js 18 o superior.
- npm.
- Expo CLI via scripts (`npm start`, `npm run android`, etc.).
- Backend API corriendo localmente.

## 4.2 Levantar backend (API)
Ubicate en el backend (por ejemplo `backend-api`) y ejecuta:

```bash
npm install
npm run dev
```

Referencia esperada: `http://localhost:4000`.

## 4.3 Levantar app mobile
Ubicate en `mobile-app` y ejecuta:

```bash
npm install
npm start
```

Alternativas:

```bash
npm run android
npm run ios
```

## 4.4 Configurar API para dispositivo fisico (opcional)
En PowerShell:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://TU_IP_LOCAL:4000"
npm start
```

## 4.5 URLs utiles segun entorno
- iOS simulador: `http://localhost:4000`
- Android emulador: `http://10.0.2.2:4000`
- Celular fisico: `http://<IP_LOCAL_PC>:4000`

## 4.6 Validacion tecnica recomendada

```bash
npm run typecheck
```

---

## 5. Bitacora de implementacion (paso a paso)

## Fase 1 - Fundacion de la app
1. Se reemplazo el `App.tsx` inicial por una aplicacion multi-modulo.
2. Se definio estructura por capas en `src/mobile/` (`api`, `screens`, `components`, `theme`).
3. Se construyo navegacion principal con tab bar personalizada.

## Fase 2 - Datos y autenticacion
4. Se implemento cliente API con tipado para todos los modulos.
5. Se habilito persistencia de sesion con `AsyncStorage`.
6. Se implemento refresh de token automatico en errores `401`.

## Fase 3 - UX, carga y seguridad
7. Se agrego splash animado de entrada.
8. Se agregaron skeleton loaders para dashboard.
9. Se implemento bloqueo biometrico (`expo-local-authentication`).
10. Se agrego feedback haptico (`expo-haptics`).

## Fase 4 - Pantallas de negocio
11. Se construyo flujo completo de autenticacion (login/registro/recuperacion).
12. Se construyo dashboard con indicadores principales.
13. Se construyo pantalla de movimientos con CRUD.
14. Se construyo pantalla de alta de movimientos.
15. Se construyo modulo de metas con aportes y mantenimiento.
16. Se construyo modulo de reportes con comparativos.

## Fase 5 - Cambios solicitados en esta sesion
17. Se elimino por completo el inicio con Google:
   - UI,
   - handler de autenticacion,
   - cliente `loginGoogle`,
   - dependencias `expo-auth-session` y `expo-web-browser`.
18. Se cambio la fecha de cabecera en `Inicio` a formato con dia exacto (`24 de abril 2026`).

## Fase 6 - Preparacion para GitHub
19. Se ajusto `.gitignore` para ignorar `.env`.
20. Se consolidaron cambios y se dejo el proyecto listo para push.

---

## 6. Estado actual

### Completado
- Autenticacion manual + seguridad biometrica.
- Dashboard con KPIs, comparativas y fecha completa.
- Modulos `Movimientos`, `Agregar`, `Metas` y `Reportes`.
- Login con Google eliminado.
- Typecheck validado.

### Listo para publicacion
- Repo local con commit generado.
- Pendiente: conectar remoto y hacer `git push`.

---

## 7. Proximos pasos recomendados

1. Actualizar `README.md` para alinearlo 100% con el estado actual (sin Google).
2. Subir a GitHub (`main` + remoto + push).
3. Definir roadmap corto de mejoras:
   - alertas/notificaciones,
   - presupuestos inteligentes,
   - exportacion de reportes.

