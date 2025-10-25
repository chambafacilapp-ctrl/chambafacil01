// Seed para Firestore Emulator (escribe como Admin, ignora reglas)
// Requisitos:
//  - Emulador de Firestore corriendo en 127.0.0.1:8080
//  - Node 18+
// Ejecuta: npm run seed

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

import admin from 'firebase-admin';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'chambafacil-dev';

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function main() {
  console.log('Usando proyecto:', projectId);
  // Usuarios de ejemplo
  const users = [
    { uid: 'demoPaid', email: 'paid@example.com', paid: true },
    { uid: 'demoNoPaid', email: 'nopaid@example.com', paid: false }
  ];

  for (const u of users) {
    await db.doc(`users/${u.uid}`).set({
      email: u.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      paid: u.paid
    }, { merge: true });
  }

  // Perfil solo para el usuario con pago (para probar lecturas públicas)
  await db.doc('profiles/demoPaid').set({
    ownerUid: 'demoPaid',
    name: 'Juan Pérez',
    oficio: 'Plomería',
    ciudad: 'Morelia, Mich.',
    descripcion: 'Instalaciones y reparaciones',
    phone: '4431234567',
    photos: ['sample','sample2'],
    location: { lat: 19.7008, lng: -101.1844 },
    public: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log('Seed completado ✅');
  process.exit(0);
}

main().catch(err => {
  console.error('Error en seed:', err);
  process.exit(1);
});
