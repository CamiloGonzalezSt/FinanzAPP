# Mobile App Scaffold

App React Native (Expo + TypeScript) con base dark premium y secciones del plan maestro.

## Pantallas iniciales
- Login/Registro obligatorio (manual o Google)
- Inicio (KPI + boton sincronizar + comparativo)
- Movimientos
- Agregar
- Metas
- Reportes

## Ejecutar
- `npm start`
- `npm run android`
- `npm run ios`

## API local
- iOS simulator: `http://localhost:4000`
- Android emulator: `http://10.0.2.2:4000`
- iPhone fisico (Expo Go): define `EXPO_PUBLIC_API_BASE_URL` con la IP de tu PC.

Ejemplo PowerShell:
`$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.4.148:4000"; npm run dev:mobile`

## Nota de Google Sign-In
- El flujo `Continuar con Google` ya esta integrado end-to-end a API.
- Para validacion real de `idToken` de Google en produccion se debe conectar Google OAuth oficial (credenciales y consent screen).
