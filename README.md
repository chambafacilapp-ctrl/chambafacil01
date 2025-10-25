# Reglas de Firestore para Chamba Fácil

Este paquete incluye:
- `firestore.rules` con seguridad y validaciones.
- `firebase.json`, `.firebaserc`, `firestore.indexes.json` (config local).
- Scripts para emulador y seed.

## Contenido
- **Lectura pública** de `/profiles/{uid}`.
- **Escritura** de `/profiles/{uid}` solo por el dueño autenticado **y con pago activo** (`/users/{uid}.paid=true`).
- Validaciones de campos: nombre, ciudad, oficio permitido, teléfono numérico, hasta 3 fotos, ubicación válida, timestamps.
- `/users/{uid}`: el cliente crea su doc con `paid=false`; no puede cambiar `paid`. (Lo cambia un admin/servidor).

## Uso local (Emulator)
1. Instala dependencias:
   ```bash
   npm install
   ```
2. Inicia emuladores:
   ```bash
   npm run emulators
   ```
   - UI del emulador: http://127.0.0.1:4000
3. (Opcional) Corre el **seed**:
   ```bash
   npm run seed
   ```
   Crea `/users/demoPaid` (paid=true) y un perfil `/profiles/demoPaid`.

## Despliegue de reglas a producción
- Verifica que tu `firebase.json` apunte a `firestore.rules`.
- Ejecuta:
  ```bash
  firebase deploy --only firestore:rules
  ```

## Notas
- Si quieres que un **admin** marque `paid=true`, usa **custom claims** y agrega una regla de admin en `/users/{uid}` para permitir ese cambio.
- Asegúrate en tu app de escribir el perfil **con docId = uid** en `/profiles/{uid}`.
