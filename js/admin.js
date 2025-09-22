// js/admin.js
import { db } from './firebase-config.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Selecciones
const filterUser = document.getElementById('filterUser');
const filterMap = document.getElementById('filterMap');
const filterFrom = document.getElementById('filterFrom');
const filterTo = document.getElementById('filterTo');
const btnFilter = document.getElementById('btnFilter');
const tableBody = document.getElementById('movements-table-body');
const buttonsDiv = document.querySelector('.buttons');

// Paginación
let allMovements = [];
let filteredMovements = [];
let currentPage = 1;
const pageSize = 25;

// 🔹 Cargar movimientos desde Firestore
async function loadMovements() {
  const movimientosCol = collection(db, 'movimientos');
  const q = query(movimientosCol, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);

  allMovements = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  populateFilters(allMovements);
  applyFilters();
}

// 🔹 Llenar filtros dinámicamente
function populateFilters(data) {
  const users = [...new Set(data.map(d => d.userName).filter(Boolean))];
  const maps = [...new Set(data.map(d => d.mapId).filter(Boolean))];

  filterUser.innerHTML = '<option value="">Todos los usuarios</option>';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    filterUser.appendChild(opt);
  });

  filterMap.innerHTML = '<option value="">Todos los mapas</option>';
  maps.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    filterMap.appendChild(opt);
  });
}

// 🔹 Aplicar filtros y renderizar tabla
function applyFilters() {
  const userVal = filterUser.value;
  const mapVal = filterMap.value;
  const fromDate = filterFrom.value ? new Date(filterFrom.value) : null;
  const toDate = filterTo.value ? new Date(filterTo.value) : null;

  filteredMovements = allMovements.filter(m => {
    const mDate = m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000) : null;
    return (!userVal || m.userName === userVal) &&
           (!mapVal || m.mapId === mapVal) &&
           (!fromDate || (mDate && mDate >= fromDate)) &&
           (!toDate || (mDate && mDate <= toDate));
  });

  currentPage = 1;
  renderTable();
}

// 🔹 Renderizar tabla con paginación
function renderTable() {
  tableBody.innerHTML = '';
  if (!filteredMovements.length) {
    tableBody.innerHTML = "<tr><td colspan='6'>No hay movimientos</td></tr>";
    return;
  }

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredMovements.slice(start, end);

  pageItems.forEach(mov => {
    const tr = document.createElement('tr');
    const fecha = mov.createdAt?.seconds ? new Date(mov.createdAt.seconds * 1000).toLocaleString('es-MX') : '-';
    const actionClass = mov.action === "entrada" ? "bg-green-600" : mov.action === "salida" ? "bg-red-600" : "bg-gray-600";

    tr.innerHTML = `
      <td>${mov.userName || '-'}</td>
      <td><span class="action-tag ${actionClass}">${mov.action}</span></td>
      <td><span class="product-tag">${mov.productName || '-'}</span></td>
      <td>${mov.quantity || '-'}</td>
      <td>${mov.mapId || '-'} / ${mov.positionId || '-'}</td>
      <td>${fecha}</td>
    `;
    tableBody.appendChild(tr);
  });

  renderPaginationButtons();
}

// 🔹 Botones de paginación
function renderPaginationButtons() {
  let pagDiv = document.querySelector('.pagination-buttons');
  if (!pagDiv) {
    pagDiv = document.createElement('div');
    pagDiv.classList.add('pagination-buttons');
    buttonsDiv.after(pagDiv);
  }

  pagDiv.innerHTML = `
    <button ${currentPage === 1 ? 'disabled' : ''} id="prevPage">Anterior</button>
    <span>Página ${currentPage} / ${Math.ceil(filteredMovements.length / pageSize)}</span>
    <button ${currentPage >= Math.ceil(filteredMovements.length / pageSize) ? 'disabled' : ''} id="nextPage">Siguiente</button>
  `;

  document.getElementById('prevPage').addEventListener('click', () => { currentPage--; renderTable(); });
  document.getElementById('nextPage').addEventListener('click', () => { currentPage++; renderTable(); });
}

// 🔹 Eventos filtros
btnFilter.addEventListener('click', applyFilters);
filterUser.addEventListener('change', applyFilters);
filterMap.addEventListener('change', applyFilters);

// 🔹 Búsqueda en tiempo real
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = 'Buscar por producto o usuario';
searchInput.style.marginLeft = '10px';
document.querySelector('.filters').appendChild(searchInput);

searchInput.addEventListener('input', () => {
  const term = searchInput.value.toLowerCase();
  filteredMovements = allMovements.filter(m =>
    m.userName?.toLowerCase().includes(term) ||
    m.productName?.toLowerCase().includes(term)
  );
  currentPage = 1;
  renderTable();
});


document.getElementById('btnPrint').addEventListener('click', async () => {
  const element = document.querySelector("table");
  if (!element) { alert("No se encontró la tabla"); return; }

  try {
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.");
      return;
    }

    printWindow.document.write(`
      <html>
      <head>
        <title>Imprimir Movimientos</title>
        <style>
          body { font-family: Arial; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
          th { background: #1e3a8a; color: white; }
        </style>
      </head>
      <body>
        <h2>Reporte de Movimientos</h2>
        <p>Generado: ${new Date().toLocaleString()}</p>
        <img src="${imgData}" style="width:95%;"/>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    // No cerrar automáticamente, para que el usuario vea la ventana
    // printWindow.close();
  } catch (err) {
    console.error("Error al imprimir:", err);
    alert("Error al imprimir. Revisa la consola.");
  }
});




async function cargarMetrics() {
  const snap = await getDocs(collection(db, 'movimientos'));
  const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));

  // Entradas vs Salidas
  const entradas = data.filter(d => d.action === 'entrada').length;
  const salidas = data.filter(d => d.action === 'salida').length;

  const ctx = document.getElementById('chartEntradasSalidas').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Entradas', 'Salidas'],
      datasets: [{
        label: 'Movimientos',
        data: [entradas, salidas],
        backgroundColor: ['#16a34a','#dc2626']
      }]
    },
    options: { responsive: true }
  });

  // Productos más movidos
  const counts = {};
  data.forEach(d => { counts[d.productName] = (counts[d.productName] || 0) + 1; });
  const prodCtx = document.getElementById('chartProductos').getContext('2d');
  new Chart(prodCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(counts),
      datasets: [{ label: 'Cantidad', data: Object.values(counts), backgroundColor: '#2563eb' }]
    }
  });

  // Actividad por usuario
  const userCounts = {};
  data.forEach(d => { userCounts[d.userName] = (userCounts[d.userName] || 0) + 1; });
  const userCtx = document.getElementById('chartUsuarios').getContext('2d');
  new Chart(userCtx, {
    type: 'pie',
    data: {
      labels: Object.keys(userCounts),
      datasets: [{ label: 'Movimientos', data: Object.values(userCounts), backgroundColor: ['#16a34a','#2563eb','#dc2626','#f59e0b','#8b5cf6'] }]
    }
  });
}

cargarMetrics();


// 🔹 Exportar PDF con jsPDF + html2canvas
document.getElementById("exportPdfBtn").addEventListener("click", async () => {
  const element = document.querySelector("table");
  if (!element) { alert("No se encontró la tabla"); return; }

  try {
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 190;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 10;

    pdf.setFontSize(14);
    pdf.text("Reporte de Movimientos", 105, 10, { align: "center" });
    pdf.setFontSize(10);
    pdf.text(`Generado: ${new Date().toLocaleString("es-MX")}`, 200, 15, { align: "right" });

    position = 25;
    while (heightLeft > 0) {
      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      if (heightLeft > 0) { pdf.addPage(); position = 10; }
    }

    pdf.save("movimientos.pdf");
  } catch (err) {
    console.error("Error exportando PDF:", err);
    alert("Error exportando PDF. Revisa consola.");
  }
});


// 🔹 Exportar Excel con SheetJS
const exportExcelBtn = document.createElement('button');
exportExcelBtn.id = 'exportExcelBtn';
exportExcelBtn.textContent = 'Exportar Excel';
exportExcelBtn.className = 'btn-login';
buttonsDiv.appendChild(exportExcelBtn);

exportExcelBtn.addEventListener('click', () => {
  console.log('Movimientos a exportar:', filteredMovements);
  if (!filteredMovements.length) {
    alert('No hay datos para exportar');
    return;
  }

  const ws = XLSX.utils.json_to_sheet(
    filteredMovements.map(m => ({
      Usuario: m.userName,
      Acción: m.action,
      Producto: m.productName,
      Cantidad: m.quantity,
      Ubicación: `${m.mapId || '-'} / ${m.positionId || '-'}`,
      Fecha: m.createdAt?.seconds ? new Date(m.createdAt.seconds*1000).toLocaleString() : '-'
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  XLSX.writeFile(wb, 'movimientos.xlsx');
});


// 🔹 Inicializar
loadMovements();
