// movements.js
import { getMovements } from './movementsHandler.js'; // ← ya no se importa a sí mismo

const movementsTableBody = document.getElementById('movements-table-body');

async function cargarMovimientos() {
  movementsTableBody.innerHTML = '<tr><td colspan="8">Cargando...</td></tr>';
  const movimientos = await getMovements();

  if (!movimientos.length) {
    movementsTableBody.innerHTML = '<tr><td colspan="8">No hay movimientos registrados</td></tr>';
    return;
  }

  movementsTableBody.innerHTML = '';
  movimientos.forEach(mov => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${mov.createdAt?.toDate ? mov.createdAt.toDate().toLocaleString() : ''}</td>
      <td>${mov.userEmail || ''}</td>
      <td>${mov.action || ''}</td>
      <td>${mov.mapId || ''}</td>
      <td>${mov.positionId || ''}</td>
      <td>${mov.productName || ''}</td>
      <td>${mov.quantity || ''}</td>
      <td>${mov.details || ''}</td>
    `;
    movementsTableBody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', cargarMovimientos);
