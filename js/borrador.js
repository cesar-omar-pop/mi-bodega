import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, where, query, documentId, orderBy, onSnapshot, deleteDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
let productosMap = {}; // Productos consolidados para inventario

// ================= PESTAÑAS =================
const tabMovimientos = document.getElementById('tabMovimientos');
const tabInventario = document.getElementById('tabInventario');
const containerMovimientos = document.getElementById('containerMovimientos');
const containerInventario = document.getElementById('containerInventario');

tabMovimientos.addEventListener('click', () => {
  tabMovimientos.classList.add('active');
  tabInventario.classList.remove('active');
  containerMovimientos.style.display = 'block';
  containerInventario.style.display = 'none';
});

tabInventario.addEventListener('click', () => {
  tabInventario.classList.add('active');
  tabMovimientos.classList.remove('active');
  containerMovimientos.style.display = 'none';
  containerInventario.style.display = 'block';
});

// ================= MOVIMIENTOS =================
const tableMovBody = document.getElementById('movements-table-body');
const btnExportMovPdf = document.getElementById('exportMovPdf');
const btnPrintMov = document.getElementById('printMov');
const btnExportMovExcel = document.getElementById('exportMovExcel');

// Contenedor de pestañas por fecha
let tabsContainer = document.getElementById('movements-date-tabs');
if (!tabsContainer) {
  tabsContainer = document.createElement('div');
  tabsContainer.id = 'movements-date-tabs';
  tabsContainer.style.display = 'flex';
  tabsContainer.style.gap = '8px';
  tabsContainer.style.marginBottom = '10px';
  containerMovimientos.insertBefore(tabsContainer, tableMovBody.parentNode);
}

const movimientosCol = collection(db, 'movimientos');
const qMov = query(movimientosCol, orderBy('createdAt', 'desc'));
let movimientosPorDia = {}; // { 'YYYY-MM-DD': [movimientos] }

onSnapshot(qMov, snap => {
  movimientosPorDia = {};
  snap.forEach(doc => {
    const d = doc.data();
    const fecha = d.createdAt?.toDate ? d.createdAt.toDate().toISOString().split('T')[0] : 'Sin Fecha';
    if (!movimientosPorDia[fecha]) movimientosPorDia[fecha] = [];
    movimientosPorDia[fecha].push({ id: doc.id, ...d });
  });
// Crear pestañas por fecha
tabsContainer.innerHTML = '';
Object.keys(movimientosPorDia).sort((a,b)=>b.localeCompare(a)).forEach((fecha, index)=>{
  // Botón de la fecha
  const btn = document.createElement('button');
  btn.textContent = fecha;
  btn.classList.add('tab-button');
  if(index===0) btn.classList.add('active');
  btn.addEventListener('click', () => mostrarMovimientosPorDia(fecha, btn));

  // Botón eliminar día
  const btnDeleteDay = document.createElement('button');
  btnDeleteDay.textContent = 'Eliminar día';
  btnDeleteDay.classList.add('btn-delete-day');
  btnDeleteDay.addEventListener('click', async (e)=>{
    e.stopPropagation(); // Evita que se active la pestaña
    if(confirm(`¿Seguro que quieres eliminar todos los movimientos del día ${fecha}?`)){
      const batch = movimientosPorDia[fecha].map(d => deleteDoc(doc(db, 'movimientos', d.id)));
      await Promise.all(batch);
      alert(`Se eliminaron los movimientos del día ${fecha}`);
    }
  });

  // Contenedor de la pestaña + botón eliminar
  const container = document.createElement('div');
  container.classList.add('tab-container');
  container.style.display='inline-flex';
  container.style.alignItems='center';
  container.style.gap='4px';
  container.appendChild(btn);
  container.appendChild(btnDeleteDay);

  tabsContainer.appendChild(container);
});

// Mostrar el día más reciente por defecto
const fechas = Object.keys(movimientosPorDia).sort((a,b)=>b.localeCompare(a));
if(fechas.length) mostrarMovimientosPorDia(fechas[0], tabsContainer.firstChild.querySelector('button'));

function mostrarMovimientosPorDia(fecha, btnSeleccionado){
  // Marcar pestaña activa
  tabsContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  if(btnSeleccionado) btnSeleccionado.classList.add('active');

  tableMovBody.innerHTML = '';
  movimientosPorDia[fecha].forEach(d=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : ''}</td>
      <td>${d.userEmail || d.userName || ''}</td>
      <td>${d.action || ''}</td>
      <td>${d.mapId || ''}</td>
      <td>${d.positionId || ''}</td>
      <td>${d.productName || ''}</td>
      <td>${d.quantity ?? ''}</td>
      <td>${d.details || ''}</td>
      <td><button class="btn-delete" data-id="${d.id}">Eliminar</button></td>
    `;
    tableMovBody.appendChild(tr);
  });

  // Asignar evento eliminar
  tableMovBody.querySelectorAll('.btn-delete').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.dataset.id;
      if(confirm('¿Seguro que quieres eliminar este movimiento?')){
        await deleteDoc(doc(db, 'movimientos', id));
      }
    });
  });

  // Actualizar gráficas para ese día
  updateMovCharts(movimientosPorDia[fecha]);
}

// ================= GRAFICAS MOVIMIENTOS =================
function updateMovCharts(movimientos) {
  const entradas = movimientos.filter(m => m.action === 'entrada').length;
  const salidas = movimientos.filter(m => m.action === 'salida').length;

  const ctxAcc = document.getElementById('chartAcciones')?.getContext('2d');
  if (ctxAcc) {
    if (window.accChart) window.accChart.destroy();
    window.accChart = new Chart(ctxAcc, {
      type: 'doughnut',
      data: { labels: ['Entradas', 'Salidas'], datasets: [{ data: [entradas, salidas], backgroundColor: ['#16a34a', '#dc2626'] }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  const prodCounts = {};
  movimientos.forEach(m => { if (m.productName) prodCounts[m.productName] = (prodCounts[m.productName] || 0) + 1; });
  const ctxProd = document.getElementById('chartProductos')?.getContext('2d');
  if (ctxProd) {
    if (window.prodChart) window.prodChart.destroy();
    window.prodChart = new Chart(ctxProd, {
      type: 'bar',
      data: { labels: Object.keys(prodCounts), datasets: [{ label: 'Movimientos', data: Object.values(prodCounts), backgroundColor: '#2563eb' }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }
}
// ================= INVENTARIO =================
const tableInvBody = document.getElementById('inventory-table-body');
const filterProductInput = document.getElementById('filterProduct');
const btnExportInvPdf = document.getElementById('exportInvPdf');
const btnPrintInv = document.getElementById('printInv');
const btnExportInvExcel = document.getElementById('exportInvExcel');


async function cargarInventario() {
    tableInvBody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

    const mapas = [
        { id: 'mapa1', collection: 'celdas', type: 'celdas' },
        { id: 'mapa2', collection: 'posiciones', type: 'posiciones' },
        { id: 'mapa3', collection: 'celdas', type: 'celdas' }
    ];

    productosMap = {};

    for (const mapa of mapas) {
        const colRef = collection(db, `bodegas/${mapa.id}/${mapa.collection}`);
        let snapshot;

        // Condición para excluir el documento 'order' de mapa3
        if (mapa.id === 'mapa3') {
            const q = query(colRef, where(documentId(), '!=', 'order'));
            snapshot = await getDocs(q);
        } else {
            snapshot = await getDocs(colRef);
        }
        
        // ... (el resto del código de la función sigue igual)
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const docId = docSnap.id;
            let productosDeCelda = [];

            if (mapa.id === 'mapa3') {
                productosDeCelda.push({
                    productName: docId,
                    ...d,
                    ubicacionEspecifica: 'mapa3'
                });
            } else if (mapa.id === 'mapa2') {
                productosDeCelda = d.positions || [];
                productosDeCelda.forEach(p => p.ubicacionEspecifica = d.nombreCelda || docId);
            } else {
                productosDeCelda = d.products || [];
                productosDeCelda.forEach(p => p.ubicacionEspecifica = d.nombreCelda || docId);
            }

            productosDeCelda.forEach(prod => {
                const productName = prod.productName || '';
                const lot = prod.lot || prod.productBatch || '';
                const presentation = prod.presentation || prod.productPresentation || '';
                const brand = prod.brand || prod.productBrand || '';
                let fechaCad = '',
                    fechaObj = null;

                if (prod.date) {
                    fechaObj = new Date(prod.date);
                } else if (prod.productDateElaboration) {
                    fechaObj = new Date(prod.productDateElaboration);
                }
                if (fechaObj) {
                    let duration = prod.productDuration || 24;
                    let durationUnit = prod.productDurationUnit || 'months';
                    if (durationUnit === 'months') fechaObj.setMonth(fechaObj.getMonth() + Number(duration));
                    else if (durationUnit === 'years') fechaObj.setFullYear(fechaObj.getFullYear() + Number(duration));
                    fechaCad = fechaObj.toISOString().split('T')[0];
                }

                const key = `${productName}_${lot}_${presentation}`;

                if (!productosMap[key]) {
                    productosMap[key] = {
                        productName,
                        lot,
                        presentation,
                        caducidad: fechaCad,
                        fechaCaducidadObj: fechaObj,
                        brand,
                        cantidadTotal: prod.quantity ?? prod.productQuantity ?? 0,
                        ubicaciones: [prod.ubicacionEspecifica || '']
                    };
                } else {
                    productosMap[key].cantidadTotal += prod.quantity ?? prod.productQuantity ?? 0;
                    if (!productosMap[key].ubicaciones.includes(prod.ubicacionEspecifica)) {
                        productosMap[key].ubicaciones.push(prod.ubicacionEspecifica);
                    }
                }
            });
        });
    }

    // Generar tabla
    tableInvBody.innerHTML = '';
    Object.values(productosMap)
        .sort((a, b) => a.productName.localeCompare(b.productName) || a.presentation.localeCompare(b.presentation))
        .forEach(prod => {
            const tr = document.createElement('tr');
            let colorCad = '';
            if (prod.fechaCaducidadObj) {
                const diffMonths = (prod.fechaCaducidadObj.getFullYear() - new Date().getFullYear()) * 12 + (prod.fechaCaducidadObj.getMonth() - new Date().getMonth());
                colorCad = diffMonths < 12 ? 'red' : diffMonths < 24 ? 'orange' : 'green';
            }

            tr.innerHTML = `
                <td>${prod.productName} / ${prod.brand.toUpperCase()} / ${prod.presentation}</td>
                <td>${prod.lot}</td>
                <td style="color:${colorCad}; font-weight:600;">${prod.caducidad}</td>
                <td>${prod.cantidadTotal}</td>
                <td>${prod.ubicaciones.join(', ')}</td>
                <td class="qr-cell" id="qr-${prod.productName}-${prod.lot}-${prod.presentation}"></td>
            `;
            tableInvBody.appendChild(tr);

            const qrCell = document.getElementById(`qr-${prod.productName}-${prod.lot}-${prod.presentation}`);
            if (qrCell) {
                const canvas = document.createElement('canvas'); qrCell.appendChild(canvas);
                const qrText = `PRODUCTO: ${prod.productName}\nMARCA: ${prod.brand.toUpperCase()}\nPRESENTACIÓN: ${prod.presentation}\nLOTE: ${prod.lot}\nCADUCIDAD: ${prod.caducidad}\nCANTIDAD: ${prod.cantidadTotal}\nUBICACIONES: ${prod.ubicaciones.join(', ')}`;
                QRCode.toCanvas(canvas, qrText, { width: 120 }, err => { if (err) console.error(err); });

                const btnPrintQR = document.createElement('button');
                btnPrintQR.textContent = 'Imprimir QR';
                btnPrintQR.classList.add('btn-print');
                btnPrintQR.style.marginTop = '5px';
                btnPrintQR.addEventListener('click', () => imprimirEtiquetas([prod]));
                qrCell.appendChild(btnPrintQR);
            }
        });

    filterProductInput.addEventListener('input', () => {
        const term = filterProductInput.value.toLowerCase();
        tableInvBody.querySelectorAll('tr').forEach(tr => tr.style.display = tr.textContent.toLowerCase().includes(term) ? '' : 'none');
    });
}









// ================= IMPRIMIR ETIQUETAS =================
const imprimirEtiquetas = (productos) => {
  if(!productos?.length) return alert("No hay productos para imprimir");
  const tempDiv = document.createElement('div');
  tempDiv.style.display='flex'; tempDiv.style.flexWrap='wrap'; tempDiv.style.gap='15px'; tempDiv.style.padding='10px';

  productos.forEach(prod=>{
    const etiqueta = document.createElement('div');
    etiqueta.style.cssText='border:2px solid #333;border-radius:10px;width:200px;padding:10px;text-align:center;font-family:Arial;background:#fff;page-break-inside:avoid;box-shadow:2px 2px 6px rgba(0,0,0,0.15)';

    let colorCad = '';
    if(prod.fechaCaducidadObj){
      const diffMonths = (prod.fechaCaducidadObj.getFullYear() - new Date().getFullYear())*12 + (prod.fechaCaducidadObj.getMonth() - new Date().getMonth());
      colorCad = diffMonths < 12 ? 'red' : diffMonths < 24 ? 'orange' : 'green';
    }

    const qrCanvas = document.createElement('canvas'); etiqueta.appendChild(qrCanvas);
    const qrText = `PRODUCTO: ${prod.productName}\nMARCA: ${prod.brand.toUpperCase()}\nPRESENTACIÓN: ${prod.presentation}\nLOTE: ${prod.lot}\nCADUCIDAD: ${prod.caducidad}\nCANTIDAD: ${prod.cantidadTotal}\nUBICACIONES: ${prod.ubicaciones.join(', ')}`;
    QRCode.toCanvas(qrCanvas, qrText, { width: 150 });

    const infoDiv = document.createElement('div');
    infoDiv.style.cssText='margin-top:8px;font-size:12px;line-height:1.3';
    infoDiv.innerHTML = `
      <strong>${prod.productName}</strong><br>
      MARCA: ${prod.brand.toUpperCase()}<br>
      Presentación: ${prod.presentation}<br>
      Lote: ${prod.lot}<br>
      Caducidad: <span style="color:${colorCad}; font-weight:600">${prod.caducidad}</span><br>
      Cantidad: ${prod.cantidadTotal}<br>
      Ubicaciones: ${prod.ubicaciones.join(', ')}
    `;
    etiqueta.appendChild(infoDiv);
    tempDiv.appendChild(etiqueta);
  });

  const printWindow = window.open('','_blank');
  if(!printWindow) return alert("Permite ventanas emergentes");
  printWindow.document.write('<html><head><title>Etiquetas</title></head><body></body></html>');
  printWindow.document.body.appendChild(tempDiv);
  printWindow.document.close(); printWindow.focus(); printWindow.print();
};

// ================= DESCARGAR TODAS ETIQUETAS EN PDF =================
async function descargarTodasEtiquetasPDF(productos){
  if(!productos?.length) return alert("No hay productos para descargar");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','mm','a4');

  const etiquetaWidth=90, etiquetaHeight=50, marginLeft=10, marginTop=10, gapX=10, gapY=10;
  const colsPorFila=2, filasPorHoja=4;
  let col=0,row=0;

  for(let i=0;i<productos.length;i++){
    const prod = productos[i];
    const x = marginLeft + col*(etiquetaWidth+gapX);
    const y = marginTop + row*(etiquetaHeight+gapY);

    doc.setDrawColor(50); doc.rect(x,y,etiquetaWidth,etiquetaHeight);

    let qrDataUrl='';
    try{ qrDataUrl = await QRCode.toDataURL(`PRODUCTO: ${prod.productName}\nMARCA: ${prod.brand.toUpperCase()}\nPRESENTACIÓN: ${prod.presentation}\nLOTE: ${prod.lot}\nCADUCIDAD: ${prod.caducidad}\nCANTIDAD: ${prod.cantidadTotal}\nUBICACIONES: ${prod.ubicaciones.join(', ')}`,{width:50,margin:1}); }
    catch(err){ console.error(err); continue; }

    doc.addImage(qrDataUrl,'PNG',x+5,y+5,35,35);

    let colorCad = [0,128,0];
    if(prod.fechaCaducidadObj){
      const diffMonths = (prod.fechaCaducidadObj.getFullYear()-new Date().getFullYear())*12 + (prod.fechaCaducidadObj.getMonth()-new Date().getMonth());
      if(diffMonths<12) colorCad=[255,0,0];
      else if(diffMonths<24) colorCad=[255,165,0];
    }

    const textX = x+45; let textY = y+10;
    doc.setFontSize(10); doc.setTextColor(0,0,0);
    doc.text(`${prod.productName}`, textX, textY); textY+=5;
    doc.text(`MARCA: ${prod.brand.toUpperCase()}`, textX, textY); textY+=5;
    doc.text(`Pres: ${prod.presentation}`, textX, textY); textY+=5;
    doc.text(`Lote: ${prod.lot}`, textX, textY); textY+=5;
    doc.setTextColor(...colorCad); doc.text(`Cad: ${prod.caducidad}`, textX, textY); textY+=5;
    doc.setTextColor(0,0,0); doc.text(`Cant: ${prod.cantidadTotal}`, textX, textY);

    col++; if(col>=colsPorFila){ col=0; row++; }
    if(row>=filasPorHoja){ doc.addPage(); col=0; row=0; }
  }
  doc.save('etiquetas_inventario_grandes.pdf');
}

// ================= FUNCIONES GENERALES PDF, PRINT, EXCEL =================
async function exportTablePDF(selector,fileName){
  const element=document.querySelector(selector);
  if(!element) return alert("Tabla no encontrada");
  try{
    const canvas=await html2canvas(element,{scale:2,useCORS:true,willReadFrequently:true});
    const imgData=canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf=new jsPDF('p','mm','a4');
    const imgWidth=190,pageHeight=295;
    const imgHeight=(canvas.height*imgWidth)/canvas.width;
    let heightLeft=imgHeight,position=10;

    pdf.setFontSize(14); pdf.text(fileName,105,10,{align:'center'});
    pdf.setFontSize(10); pdf.text(`Generado: ${new Date().toLocaleString()}`,200,15,{align:'right'});

    while(heightLeft>0){
      pdf.addImage(imgData,'PNG',10,position,imgWidth,imgHeight);
      heightLeft-=pageHeight;
      if(heightLeft>0){ pdf.addPage(); position=10; }
    }
    pdf.save(fileName+'.pdf');
  }catch(err){ console.error(err); alert("Error exportando PDF"); }
}

async function printTable(selector){
  const element=document.querySelector(selector);
  if(!element) return alert("Tabla no encontrada");
  try{
    const canvas=await html2canvas(element,{scale:2,useCORS:true,willReadFrequently:true});
    const imgData=canvas.toDataURL("image/png");
    const printWindow=window.open('','_blank');
    if(!printWindow) return alert("Permite ventanas emergentes");
    printWindow.document.write(`<html><head><title>Imprimir</title><style>
      body{font-family:Arial;text-align:center;}
      table{width:100%;border-collapse:collapse;margin-top:20px;}
      th,td{border:1px solid #ccc;padding:8px;text-align:center;}
      th{background:#1e3a8a;color:white;}
      </style></head><body><h2>Reporte</h2><p>${new Date().toLocaleString()}</p>
      <img src="${imgData}" style="width:95%;"/></body></html>`);
    printWindow.document.close(); printWindow.focus(); printWindow.print();
  }catch(err){ console.error(err); alert("Error al imprimir"); }
}

function exportTableExcel(data,fileName){
  if(!data.length){ alert("No hay datos"); return; }
  const ws=XLSX.utils.json_to_sheet(data);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Sheet1');
  XLSX.writeFile(wb,fileName+'.xlsx');
}

// ================= BOTONES =================
// Movimientos
btnExportMovPdf?.addEventListener('click',()=>exportTablePDF('#movements-table','Movimientos'));
btnPrintMov?.addEventListener('click',()=>printTable('#movements-table'));
btnExportMovExcel?.addEventListener('click',()=>{
  const rows=[];
  document.querySelectorAll('#movements-table tbody tr').forEach(tr=>{
    const tds=tr.querySelectorAll('td');
    if(tds.length<9) return;
    rows.push({Fecha:tds[0].textContent,Usuario:tds[1].textContent,Accion:tds[2].textContent,Mapa:tds[3].textContent,Posicion:tds[4].textContent,Producto:tds[5].textContent,Cantidad:tds[6].textContent,Detalles:tds[7].textContent});
  });
  exportTableExcel(rows,'Movimientos');
});

// ================= BOTÓN DESCARGAR TODAS ETIQUETAS =================
const btnAllPDF = document.getElementById('btn-download-all-pdf');
if(btnAllPDF){
  btnAllPDF.addEventListener('click', async () => {
    if (!productosMap || !Object.keys(productosMap).length) {
      return alert("No hay productos para descargar");
    }
    await descargarTodasEtiquetasPDF(Object.values(productosMap));
  });
}


function crearBotonesInventario() {
  // Contenedor de botones
  const containerBotones = document.createElement('div');
  containerBotones.style.display = 'flex';
  containerBotones.style.gap = '10px';
  containerBotones.style.marginBottom = '10px';

  // Imprimir todas las etiquetas
  let btnAll = document.getElementById('btn-print-all');
  if (!btnAll) {
    btnAll = document.createElement('button');
    btnAll.id = 'btn-print-all';
    btnAll.textContent = 'Imprimir todas las etiquetas';
    btnAll.classList.add('btn-login');
    btnAll.addEventListener('click', () => imprimirEtiquetas(Object.values(productosMap)));
  }
  containerBotones.appendChild(btnAll);

  // Descargar PDF todas las etiquetas
  let btnAllPDF = document.getElementById('btn-download-all-pdf');
  if (!btnAllPDF) {
    btnAllPDF = document.createElement('button');
    btnAllPDF.id = 'btn-download-all-pdf';
    btnAllPDF.textContent = 'Descargar todas las etiquetas en PDF';
    btnAllPDF.classList.add('btn-login');
    btnAllPDF.addEventListener('click', async () => {
      if (!productosMap || !Object.keys(productosMap).length) return alert("No hay productos para descargar");
      await descargarTodasEtiquetasPDF(Object.values(productosMap));
    });
  }
  containerBotones.appendChild(btnAllPDF);

  // Insertar arriba de la tabla de inventario
  containerInventario.insertBefore(containerBotones, tableInvBody.parentNode);
}

// Llamar a la función al cargar inventario
cargarInventario().then(() => {
  crearBotonesInventario();
});

// Inventario
btnExportInvPdf?.addEventListener('click',()=>exportTablePDF('#inventory-table','Inventario'));
btnPrintInv?.addEventListener('click',()=>printTable('#inventory-table'));
btnExportInvExcel?.addEventListener('click',()=>{
  const rows=[];
  document.querySelectorAll('#inventory-table tbody tr').forEach(tr=>{
    const tds=tr.querySelectorAll('td');
    if(tds.length!==6) return;
    rows.push({Producto:tds[0].textContent,Lote:tds[1].textContent,Caducidad:tds[2].textContent,CantidadTotal:tds[3].textContent,Ubicaciones:tds[4].textContent});
  });
  exportTableExcel(rows,'Inventario');
});

// ================= INICIALIZAR =================
cargarInventario();


// ================= ESTILOS DINÁMICOS =================
const style = document.createElement('style');
style.textContent = `
  /* Botones Eliminar */
  .btn-delete {
    background: #dc2626;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-delete:hover {
    background: #b91c1c;
  }

`;
document.head.appendChild(style);
});