# Chamba Fácil — Deploy completo (Render/Railway)

## Variables (.env)
MP_ACCESS_TOKEN=TEST-...
PUBLIC_URL=https://TU_SUBDOMINIO.onrender.com
CLOUDINARY_CLOUD_NAME=tu_cloud
CLOUDINARY_KEY=tu_api_key
CLOUDINARY_SECRET=tu_api_secret

## Ejecutar local
npm install
npm run start
http://localhost:3000

## Producción (Render)
- Conecta el repo y usa `render.yaml`.
- Agrega variables en Environment.
- La app sirve `/public` y el API (`/api/create-preference`, `/api/signature`).
