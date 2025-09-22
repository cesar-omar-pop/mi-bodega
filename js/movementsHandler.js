// movementsHandler.js
import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Export nombrado de la función logMovement
export async function logMovement({
    userEmail = null,
    action,
    mapId = null,
    positionId = null,
    productId = null,
    productName = null,
    productBrand = null,
    lot = null,
    quantity = null,
    details = null
}) {
    try {
        await addDoc(collection(db, 'movimientos'), {
            userEmail,
            action,
            mapId,
            positionId,
            productId,
            productName,
            productBrand,
            lot,
            quantity,
            details,
            createdAt: serverTimestamp()
        });
        console.log('Movimiento registrado:', action, productName);
    } catch (err) {
        console.error('Error registrando movimiento:', err);
    }
}
