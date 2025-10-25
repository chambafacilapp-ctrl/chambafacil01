# Seed del emulador

## Prerrequisitos
- Node.js 18+
- `firebase-tools` (se instala con `npm i` en este repo)
- Firestore Emulator en 127.0.0.1:8080

## Pasos
1) Instala dependencias:
   ```bash
   npm install
   ```

2) Inicia los emuladores en otra terminal:
   ```bash
   npm run emulators
   ```

3) Ejecuta el seed:
   ```bash
   npm run seed
   ```

Se crearán:
- `/users/demoPaid` (paid=true) y `/users/demoNoPaid` (paid=false)
- `/profiles/demoPaid` (perfil de prueba visible en lecturas públicas)
