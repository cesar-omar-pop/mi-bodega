// script.js
import { auth, db } from './firebase-config.js'; // Asegúrate de importar 'db'
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
// Importa la función showMessage desde tu nuevo archivo notifications.js
// (Asegúrate de que este import sea correcto si tienes un archivo notifications.js separado)
// import { showMessage } from './notifications.js';
import { logMovement } from './movementsHandler.js';
const currentUser = auth.currentUser;
const currentUserEmail = currentUser?.email || currentUser?.uid || 'Invitado';


document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.querySelector('.grid-container');
    const modal = document.getElementById('modal');
    const closeModalButton = document.querySelector('.close-button');
    const productLotInput = document.getElementById('product-lot-input'); 
    const productNameInput = document.getElementById('product-name-input');
    const productBrandInput = document.getElementById('product-brand-input');
    const productQuantityInput = document.getElementById('product-quantity-input');
    const productDateInput = document.getElementById('product-date-input');
    const productPresentationSelect = document.getElementById('product-presentation-select');
    // const modalPositionDisplay = document.getElementById('modal-position'); // No se usa en tu HTML actual para la posición.

    // CAMBIOS CLAVE AQUÍ: Añadimos la referencia al título del modal y al contenedor de la lista de productos
    const modalTitle = document.getElementById('modal-title');
    const productListContainer = document.getElementById('product-list-container');


    const editButton = document.getElementById('edit-button');
    const deleteButton = document.getElementById('delete-button');
    const addButton = document.getElementById('add-button');
    
    const searchProductInput = document.getElementById('search-product-input');
    const toggleSearchButton = document.getElementById('toggle-search-button');
    // const newMapButton = document.getElementById('new-map-button'); // No usado en tu script actual

    const goToMap2Button = document.getElementById('go-to-map2-button');
    const goToMap3Button = document.getElementById('go-to-map3-button');
    const customTooltip = document.getElementById('custom-tooltip');

    // CAMBIOS CLAVE AQUÍ: Añadimos currentProductForModalEdit para gestionar el producto a editar
    let selectedCell = null;
    let currentProductForModalEdit = null; 
    let draggedCell = null;

    let numRows = 14;
    let numCols = 25;
    // REEMPLAZAMOS 'positions' por 'warehouseData' para almacenar los datos de Firestore
    let warehouseData = {}; 

    // ID de la bodega (puedes hacer esto dinámico si tienes múltiples bodegas)
    const WAREHOUSE_ID = 'mapa1';
    const POSITIONS_COLLECTION_PATH = `bodegas/${WAREHOUSE_ID}/celdas`;
    let currentUser = null; // Para almacenar el usuario autenticado

    const numRowsTop = 7;
    const numRowsBottom = numRows - numRowsTop;
    const aislePositionsTop = [
        { startRow: 0, endRow: numRowsTop - 1, col: 2 },
        { startRow: 0, endRow: numRowsTop - 1, col: 4 },
        { startRow: 0, endRow: numRowsTop - 1, col: 22 },
    ];
    const aislePositionsBottom = [
        { startRow: numRowsTop, endRow: numRows - 1, col: 21 },
        { startRow: numRowsTop, endRow: numRows - 1, col: 3 },
    ];
    const aislePositionsMiddle = [
        { startRow: 6, endRow: 6, col: 0, length: numCols },
        { startRow: 7, endRow: 7, col: 0, length: numCols },
    ];
    const officePosition = { startRow: 0, endRow: 0, col: 0, className: 'office' };

    

    function generateId(row, col) {
        return `pos-${row}-${col}`;
    }

    // --- FUNCIÓN PARA MOSTRAR MENSAJES PERSONALIZADOS ---
    // (Asegúrate de que esta función esté definida o importada de notifications.js)
    function showMessage(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification-message notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        notification.offsetWidth; 
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            notification.addEventListener('transitionend', () => {
                notification.remove();
            }, { once: true });
        }, duration);
    }
    // --- FIN FUNCIÓN ---

    // **NUEVO: Función para guardar datos en Firestore**
    async function saveCellToFirestore(cellId, data) {
        if (!currentUser) {
            showMessage('Debe iniciar sesión para guardar datos.', 'error');
            return;
        }
        try {
            const cellRef = doc(db, 'bodegas', WAREHOUSE_ID, 'celdas', cellId);
            await setDoc(cellRef, data, { merge: true }); // 'merge: true' para no sobrescribir el documento completo
            // showMessage('Datos guardados en Firestore.', 'success'); // Mensaje opcional
        } catch (error) {
            console.error('Error al guardar datos en Firestore:', error);
            showMessage('Error al guardar datos: ' + error.message, 'error');
        }
    }

    // **NUEVO: Función para eliminar un documento en Firestore**
    async function deleteCellFromFirestore(cellId) {
        if (!currentUser) {
            showMessage('Debe iniciar sesión para eliminar datos.', 'error');
            return;
        }
        try {
            const cellRef = doc(db, 'bodegas', WAREHOUSE_ID, 'celdas', cellId);
            await deleteDoc(cellRef);
            // showMessage('Celda eliminada de Firestore.', 'success'); // Mensaje opcional
        } catch (error) {
            console.error('Error al eliminar celda de Firestore:', error);
            showMessage('Error al eliminar celda: ' + error.message, 'error');
        }
    }



    
    // **NUEVO: Función para escuchar cambios en Firestore en tiempo real**
   function listenForWarehouseChanges() {
    if (!currentUser) {
        console.log('No hay usuario autenticado, no se escuchará Firestore.');
        return;
    }

    const cellsRef = collection(db, 'bodegas', WAREHOUSE_ID, 'celdas');

    onSnapshot(cellsRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const cellData = change.doc.data();
            const cellId = change.doc.id;
            const cellElement = document.querySelector(`[data-id="${cellId}"]`);

            if (cellElement) {
                warehouseData[cellId] = cellData;

                const hasProducts = cellData.products && cellData.products.length > 0;
                const firstProductQuantity = hasProducts ? cellData.products[0].quantity : 0;
                
                const state = (hasProducts && firstProductQuantity > 0) ? 'ocupado' : 'libre';
                
                const productToDisplay = state === 'ocupado' ? cellData.products[0] : null;

                updateCellAppearance(cellElement, state, productToDisplay);

                // --- CAMBIO CLAVE AQUÍ ---
                // Si la celda se acaba de liberar Y el modal está abierto para esa celda,
                // debemos limpiarlo para evitar que muestre la información vieja.
                if (state === 'libre' && selectedCell && selectedCell.dataset.id === cellId) {
                    clearModalFields();
                }
            }
        });
        
        if (modal.style.display === 'block' && selectedCell && warehouseData[selectedCell.dataset.id]) {
            renderProductListInModal(selectedCell.dataset.id);
        }
    }, (error) => {
        console.error("Error al escuchar cambios en Firestore:", error);
        showMessage("Error al cargar los datos del mapa. Revisa la consola para más detalles.", "error", 5000);
    });
}




    // Ya no necesitamos savePositions y loadPositions porque usaremos Firestore
    // function savePositions() { ... }
    // function loadPositions() { ... }

    function createGrid() {
        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateRows = `repeat(${numRows}, 1fr)`;

        // Ya no cargamos de localStorage, simplemente creamos las celdas
        // y Firestore las poblará al inicio via listenForWarehouseChanges.

        for (let i = 0; i < numRows; i++) {
            for (let j = 0; j < numCols; j++) {
                const cell = document.createElement('div');
                const id = generateId(i, j);
                cell.dataset.id = id;
                cell.dataset.row = i;
                cell.dataset.col = j;

                // Inicializar la celda en 'libre' visualmente. Firestore la actualizará.
                // No necesitamos inicializar 'positions[id]' aquí, 'warehouseData' se poblará de Firestore.
                
                let isSpecialArea = null;
                if (i < numRowsTop) {
                    isSpecialArea = aislePositionsTop.find(area =>
                        j === area.col && i >= area.startRow && i <= area.endRow
                    );
                } else {
                    isSpecialArea = aislePositionsBottom.find(area =>
                        j === area.col && i >= area.startRow && i <= area.endRow
                    );
                }

                const isMiddleAisle = aislePositionsMiddle.find(area =>
                    i === area.startRow && j >= area.col && j < area.col + (area.length || 1)
                );

                const isOfficeCell = j === officePosition.col && i >= officePosition.startRow && i <= officePosition.endRow;

                if (isOfficeCell) {
                    cell.className = `grid-cell office ${officePosition.className || ''}`;
                    cell.textContent = 'Oficina';
                    cell.style.color = '#ffffff';
                    cell.style.fontWeight = 'bold';
                    cell.style.pointerEvents = 'none'; // Las oficinas no son interactivas
                } else if (isSpecialArea) {
                    cell.className = `grid-cell aisle ${isSpecialArea.className || ''}`;
                    cell.style.pointerEvents = 'none'; // Los pasillos no son interactivas
                } else if (isMiddleAisle) {
                    cell.className = `grid-cell aisle ${isMiddleAisle.className || ''}`;
                    cell.style.pointerEvents = 'none'; // Los pasillos no son interactivas
                } else {
                    cell.className = 'grid-cell';
                    cell.addEventListener('click', selectPosition);
                    cell.addEventListener('mouseover', showTooltip);
                    cell.addEventListener('mouseout', hideTooltip);

                    cell.addEventListener('dragstart', handleDragStart);
                    cell.addEventListener('dragover', handleDragOver);
                    cell.addEventListener('dragleave', handleDragLeave);
                    cell.addEventListener('drop', handleDrop);
                    cell.setAttribute('draggable', 'false'); 

                    // Inicializamos visualmente como libre, Firestore lo cambiará si hay datos
                    updateCellAppearance(cell, 'libre'); 
                }

                gridContainer.appendChild(cell);
            }
        }
        // No necesitamos savePositions() aquí ya que Firestore es la fuente.
    }

    // **MODIFICACIÓN CLAVE**: updateCellAppearance ahora puede recibir directamente el objeto de producto
    function updateCellAppearance(cell, state, product = null) { // Agregamos 'product' como un parámetro opcional
        cell.classList.remove('libre', 'ocupado', 'found', 'moving-source', 'moving-target');
        cell.classList.add(state);

        if (state === 'ocupado') {
            cell.setAttribute('draggable', 'true');
        } else {
            cell.setAttribute('draggable', 'false');
        }

        let productToDisplay = product; // Usamos el producto pasado si está disponible
        // Si no se pasó un producto, intentamos obtenerlo de warehouseData
        if (!productToDisplay && state === 'ocupado') {
            const cellId = cell.dataset.id;
            const cellData = warehouseData[cellId];
            if (cellData && cellData.products && cellData.products.length > 0) {
                productToDisplay = cellData.products[0]; // Asumimos el primer producto para mostrar en la celda
            }
        }

        if (state === 'ocupado' && productToDisplay) {
            const productName = productToDisplay.productName || '';
            const quantity = productToDisplay.quantity || 1;
            const brand = productToDisplay.brand || ''; // Usamos 'brand'
            const date = productToDisplay.date || '';
            const presentation = productToDisplay.presentation || '';
            const lot = productToDisplay.lot || ''; // CAMBIOS CLAVE AQUÍ: Obtener el lote

            const cleanBrand = brand ? brand.trim().replace(/\n/g, ' ') : '';
            
            // **AQUÍ DECIDES QUÉ MOSTRAR EN LA CELDA**
            // Opción 1: Solo la marca (ejemplo de la imagen)
            cell.textContent = cleanBrand; 
            
            // Opción 2: Un poco del nombre y la marca (puede ser muy largo)
            // cell.textContent = `${productName.substring(0, 5)}... (${cleanBrand})`; 

            // Opción 3: Un icono o la primera letra de la marca (si el espacio es limitado)
            // cell.textContent = cleanBrand.substring(0,1).toUpperCase();


            // Guardar datos completos para el tooltip
            let fullDetails = {
                productName,
                quantity,
                brand,
                date,
                presentation,
                lot // CAMBIOS CLAVE AQUÍ: Añadir el lote a fullDetails
            };
            cell.dataset.fullDetails = JSON.stringify(fullDetails);
        } else {
            cell.textContent = '';
            cell.removeAttribute('data-full-details');
        }
    }

    const brandOptionsContainer = document.querySelector('.brand-options-container');

    function setupBrandOptions() {
        if (!brandOptionsContainer) return;

        brandOptionsContainer.addEventListener('click', (event) => {
            const clickedOption = event.target;
            if (clickedOption.classList.contains('brand-option-circle')) {
                const brand = clickedOption.dataset.brand;
                productBrandInput.value = brand;

                document.querySelectorAll('.brand-option-circle').forEach(option => {
                    option.classList.remove('selected');
                });
                clickedOption.classList.add('selected');
            }
        });
    }

    setupBrandOptions();

    function hideTooltip() {
        customTooltip.style.opacity = '0';
        customTooltip.style.visibility = 'hidden';
    }

    function showTooltip(event) {
        const cell = event.currentTarget;
        // Ahora el tooltip lee de dataset.fullDetails, que updateCellAppearance ya actualiza
        if (cell.classList.contains('ocupado') && cell.dataset.fullDetails) {
            const details = JSON.parse(cell.dataset.fullDetails);
            const formattedDate = details.date ? new Date(details.date).toLocaleDateString('es-ES') : 'N/A'; // CAMBIOS CLAVE AQUÍ: Formatear fecha

            let tooltipContent = `
                <strong>Producto:</strong> ${details.productName || 'N/A'}<br>
                <strong>Marca:</strong> ${details.brand || 'N/A'}<br>
                <strong>Cantidad:</strong> ${details.quantity || 'N/A'}<br>
                <strong>Presentación:</strong> ${details.presentation || 'N/A'}<br>
                <strong>Fecha Cad.:</strong> ${formattedDate}<br>
                <strong>Lote:</strong> ${details.lot || 'N/A'}
            `; // CAMBIOS CLAVE AQUÍ: Añadir el lote al contenido del tooltip

            customTooltip.innerHTML = tooltipContent; // CAMBIOS CLAVE AQUÍ: Usar innerHTML para el formato HTML

            const cellRect = cell.getBoundingClientRect();
            const tooltipRect = customTooltip.getBoundingClientRect();

            let tooltipX = cellRect.left + (cellRect.width / 2) - (tooltipRect.width / 2);
            if (tooltipX < 0) tooltipX = 0;
            if (tooltipX + tooltipRect.width > window.innerWidth) {
                tooltipX = window.innerWidth - tooltipRect.width;
            }

            let tooltipY = cellRect.top - tooltipRect.height - 10;
            if (tooltipY < 0) {
                tooltipY = cellRect.bottom + 10;
            }

            customTooltip.style.left = `${tooltipX}px`;
            customTooltip.style.top = `${tooltipY}px`;
            customTooltip.style.opacity = '1';
            customTooltip.style.visibility = 'visible';
        }
    }

    // let selectedCell = null; // Declarada arriba

    function selectPosition(event) {
        hideTooltip(); // Ocultar tooltip al abrir el modal

        if (selectedCell) {
            selectedCell.classList.remove('selected-cell');
        }

        selectedCell = event.target.closest('.grid-cell');
        if (!selectedCell || selectedCell.classList.contains('aisle') || selectedCell.classList.contains('office')) {
            return;
        }

        selectedCell.classList.add('selected-cell');

        const cellId = selectedCell.dataset.id;
        modalTitle.textContent = `Gestión de Productos en ${cellId}`; // CAMBIOS CLAVE AQUÍ: Usar modalTitle
        
        // Limpiar inputs del modal
        clearProductModalFields(); // CAMBIOS CLAVE AQUÍ: Esta función se moverá a la segunda mitad, la añadiremos ahí.

        // Mostrar el botón de añadir por defecto y ocultar los de editar/eliminar
        // Siempre mostramos "Agregar Nuevo Producto" al abrir el modal
        addButton.style.display = 'inline-block'; 
        editButton.style.display = 'none';
        deleteButton.style.display = 'none';
        currentProductForModalEdit = null; // Reiniciar el producto en edición

        renderProductListInModal(cellId); // CAMBIOS CLAVE AQUÍ: Esta función se moverá a la segunda mitad, la añadiremos ahí.
        modal.style.display = 'block';
    }

    closeModalButton.addEventListener('click', () => {
        modal.style.display = "none";
        if (selectedCell) {
            selectedCell.classList.remove('selected-cell'); // Cambiado de 'selected' a 'selected-cell' para consistencia
            selectedCell = null;
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
            if (selectedCell) {
                selectedCell.classList.remove('selected-cell'); // Cambiado de 'selected' a 'selected-cell' para consistencia
                selectedCell = null;
            }
        }
    });

    // CAMBIOS CLAVE AQUÍ: Función para renderizar la lista de productos en el modal
       // CAMBIOS CLAVE AQUÍ: Función para editar un producto de la lista

function renderProductListInModal(cellId) {
    const currentCellData = warehouseData[cellId];

    if (!currentCellData || !currentCellData.products) {
        productListContainer.innerHTML = '<p>No hay productos en esta celda.</p>';
        return;
    }

    // ✅ Filtrar productos con cantidad > 0
    const products = currentCellData.products.filter(p => p.quantity > 0);

    if (products.length === 0) {
        productListContainer.innerHTML = '<p>No hay productos en esta celda.</p>';
        return;
    }

    productListContainer.innerHTML = '';

    products.forEach((product, index) => {
        const productDiv = document.createElement('div');
        productDiv.classList.add('product-item');
        productDiv.innerHTML = `
            <p>
                <strong>${product.productName}</strong>  
                Marca: ${product.brand}  
                Cant: ${product.quantity}  
                Lote: ${product.lot}
            </p>
            <div class="product-buttons">
                <button class="edit-product-btn" data-product-id="${product.id}" data-index="${index}">
                    ✏️ Editar
                </button>
                <button class="delete-product-btn" data-product-id="${product.id}" data-index="${index}">
                    🗑 Eliminar
                </button>
            </div>
        `;
        productListContainer.appendChild(productDiv);
    });

    // ✅ Eventos para editar
    document.querySelectorAll('.edit-product-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = e.target.dataset.index;
            openEditModal(cellId, index); // aquí usas tu función de edición
        });
    });

    // ✅ Eventos para eliminar
    document.querySelectorAll('.delete-product-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = e.target.dataset.index;
            deleteExistingProduct(cellId, index); // aquí usas tu función de eliminar
        });
    });
}

    function editProductFromList(event) {
        
        const productIdToEdit = event.target.dataset.productId;
        const cellId = selectedCell.dataset.id;
        const cellData = warehouseData[cellId];

        if (cellData && cellData.products) {
            const productToEdit = cellData.products.find(p => p.id === productIdToEdit);
            if (productToEdit) {
                currentProductForModalEdit = productToEdit; // Guardar el producto actual para edición

                productNameInput.value = productToEdit.productName || '';
                productBrandInput.value = productToEdit.brand || '';
                productQuantityInput.value = productToEdit.quantity || 1;
                productDateInput.value = productToEdit.date || '';
                productPresentationSelect.value = productToEdit.presentation || '';
                productLotInput.value = productToEdit.lot || ''; // CAMBIOS CLAVE AQUÍ: Rellenar campo Lote

                // Limpiar selecciones de marca y seleccionar la correcta
                document.querySelectorAll('.brand-option-circle').forEach(option => {
                    option.classList.remove('selected');
                });
                const selectedBrandOption = document.querySelector(`.brand-option-circle[data-brand="${productToEdit.brand}"]`);
                if (selectedBrandOption) {
                    selectedBrandOption.classList.add('selected');
                }

                // Ajustar visibilidad de botones: Mostrar editar/eliminar, ocultar añadir
                addButton.style.display = 'none';
                editButton.style.display = 'inline-block';
                deleteButton.style.display = 'none'; // El botón de eliminar general ya no es necesario aquí, se usa el de la lista
            }
        }
    }    

    // CAMBIOS CLAVE AQUÍ: Función para eliminar un producto específico de la lista
    async function removeProductFromList(event) {
        const productIdToRemove = event.target.dataset.productId;
        const cellId = selectedCell.dataset.id;
        const currentCellData = warehouseData[cellId];

        if (!currentCellData || !currentCellData.products || currentCellData.products.length === 0) {
            showMessage('No hay productos en esta celda para eliminar.', 'warning');
            return;
        }

        if (confirm('¿Estás seguro de que quieres eliminar este producto de la celda?')) {
            const updatedProducts = currentCellData.products.filter(p => p.id !== productIdToRemove);
            
            const dataToSave = {
                nombreCelda: cellId,
                state: updatedProducts.length > 0 ? 'ocupado' : 'libre',
                products: updatedProducts
            };

            await saveCellToFirestore(cellId, dataToSave);
            showMessage('Producto eliminado correctamente de la celda.', 'success');
            
            // Re-renderizar la lista de productos en el modal para reflejar el cambio
            renderProductListInModal(cellId);
            clearProductModalFields(); // Limpiar campos después de eliminar
        }
    }


    // CAMBIOS CLAVE AQUÍ: Función para limpiar los campos del modal
    function clearProductModalFields() {
        productNameInput.value = '';
        productBrandInput.value = '';
        productQuantityInput.value = 1;
        productDateInput.value = '';
        productPresentationSelect.value = '';
        productLotInput.value = ''; // CAMBIOS CLAVE AQUÍ: Limpiar campo Lote
        document.querySelectorAll('.brand-option-circle').forEach(option => {
            option.classList.remove('selected');
        });
    }

    // Lógica para Guardar/Editar Producto (editButton)
    editButton.addEventListener('click', async () => {
    if (!selectedCell || !currentProductForModalEdit) {
        showMessage('No hay producto seleccionado para editar.', 'error');
        return;
    }

    const cellId = selectedCell.dataset.id;
    const productName = productNameInput.value.trim();
    const productBrand = productBrandInput.value.trim();
    const quantity = parseInt(productQuantityInput.value) || 1;
    const date = productDateInput.value;
    const presentation = productPresentationSelect.value;
    const lot = productLotInput.value.trim();

    if (!productName || !productBrand || !quantity || !date || !presentation || !lot) {
        showMessage('Todos los campos son obligatorios.', 'warning');
        return;
    }

    const currentCellData = warehouseData[cellId] || { products: [] };
    let updatedProducts = Array.isArray(currentCellData.products) ? [...currentCellData.products] : [];

    const productIndex = updatedProducts.findIndex(p => p.id === currentProductForModalEdit.id);

    if (productIndex === -1) {
        showMessage('Error: Producto no encontrado para actualizar.', 'error');
        return;
    }

    if (quantity <= 0) {
        updatedProducts.splice(productIndex, 1);
    } else {
        updatedProducts[productIndex] = {
            ...updatedProducts[productIndex],
            productName,
            brand: productBrand,
            quantity,
            date,
            presentation,
            lot
        };
    }

    const dataToSave = {
        nombreCelda: cellId,
        state: updatedProducts.length > 0 ? 'ocupado' : 'libre',
        products: updatedProducts
    };

    await saveCellToFirestore(cellId, dataToSave);
    showMessage('Producto actualizado correctamente.', 'success');

    // Guardar referencia antes de reiniciar
    const editedProductForLog = {
        id: currentProductForModalEdit.id,
        productName,
        productBrand,
        lot,
        quantity
    };

    clearProductModalFields();
    addButton.style.display = 'inline-block';
    editButton.style.display = 'none';
    deleteButton.style.display = 'none';
    currentProductForModalEdit = null;
    renderProductListInModal(cellId);

    const currentUser = auth.currentUser;
    const currentUserEmail = currentUser?.email || currentUser?.uid || 'Invitado';

    await logMovement({
        userEmail: currentUserEmail,
        action: 'Editar producto',
        mapId: 'mapa1',
        positionId: cellId,
        productId: editedProductForLog.id,
        productName: editedProductForLog.productName,
        productBrand: editedProductForLog.productBrand,
        lot: editedProductForLog.lot,
        quantity: editedProductForLog.quantity,
        details: `Producto editado en la celda ${cellId}`
    });
});

    // Lógica para Agregar Producto (cuando la celda está libre)
  addButton.addEventListener('click', async () => { 
    if (!selectedCell) {
        showMessage('No hay celda seleccionada para agregar producto.', 'error');
        return;
    }
    const cellId = selectedCell.dataset.id;
    const productName = productNameInput.value.trim();
    const productBrand = productBrandInput.value.trim();
    const quantity = parseInt(productQuantityInput.value) || 1;
    const date = productDateInput.value;
    const presentation = productPresentationSelect.value;
    const lot = productLotInput.value.trim();
    
    // Validaciones
    if (!productName || !productBrand || !quantity || !date || !presentation || !lot) {
        showMessage('Todos los campos del producto (Nombre, Marca, Cantidad, Fecha, Presentación, Lote) son obligatorios.', 'warning'); 
        return;
    }

    const newProduct = {
        id: crypto.randomUUID(), 
        productName,
        brand: productBrand, 
        quantity,
        date,
        presentation,
        lot
    };

    const currentCellData = warehouseData[cellId] || { products: [] };
    let updatedProducts = Array.isArray(currentCellData.products) ? [...currentCellData.products] : [];
    
    updatedProducts.push(newProduct);
    
    const dataToSave = {
        nombreCelda: cellId,
        state: 'ocupado',
        products: updatedProducts
    };

    await saveCellToFirestore(cellId, dataToSave);
    showMessage('Producto agregado correctamente.', 'success'); 

    // Registrar movimiento en Firestore
    logMovement({
        userEmail: currentUser?.email || currentUser?.uid || 'Invitado',
        action: 'Agregar producto',
        mapId: 'mapa1', // o dinámico según tu lógica
        positionId: cellId,
        productId: newProduct.id,
        productName: newProduct.productName,
        productBrand: newProduct.brand,
        lot: newProduct.lot,
        quantity: newProduct.quantity,
        details: `Producto agregado a la celda ${cellId}`
    });

    // Limpiar campos y actualizar UI
    clearProductModalFields();
    renderProductListInModal(cellId);
    addButton.style.display = 'inline-block'; 
    editButton.style.display = 'none';
    deleteButton.style.display = 'none';
    currentProductForModalEdit = null;
});




    // Lógica para Eliminar Producto (Este botón general ahora podría eliminar TODOS los productos de la celda o ser removido si solo se usa el de la lista)
    // He ajustado este listener para que solo elimine todos los productos de la celda, como se comportaba antes.

async function deleteAllProductsFromCell(cellId) {
    const cellData = warehouseData[cellId];
    if (!cellData || !cellData.products || cellData.products.length === 0) return;

    const auth = getAuth();
    const user = auth.currentUser;

    // 🔹 Guardar una copia de todos los productos antes de eliminarlos
    const deletedProducts = [...cellData.products];

    // 🔹 Limpiar productos de la celda
    cellData.products = [];

    // 🔹 Actualizar Firestore con estado libre
    await saveCellToFirestore(cellId, {
        nombreCelda: cellId,
        state: 'libre',
        products: []
    });

    // 🔹 Registrar cada producto eliminado en movimientos
    for (const prod of deletedProducts) {
        await logMovement({
            userEmail: user?.email || user?.uid || 'Invitado',
            userName: user?.displayName || null,
            action: 'delete',
            mapId: 'mapa1',
            positionId: cellId,
            productId: prod.id || null,
            productName: prod.productName,
            productBrand: prod.brand,
            lot: prod.lot,
            quantity: prod.quantity,
            details: `Producto eliminado de la celda ${cellId}`
        });
    }

    // 🔹 Re-renderizar lista en modal si está abierto
    renderProductListInModal(cellId);
}

// DELETE PRODUCTOS MAPA 1
deleteButton.addEventListener('click', async () => {
    if (!selectedCell) {
        showMessage('No hay celda seleccionada para eliminar.', 'error');
        return;
    }

    const cellId = selectedCell.dataset.id;

    if (!confirm('¿Estás seguro de que quieres eliminar TODOS los productos de esta celda?')) return;

    const currentCellData = warehouseData[cellId] || { products: [] };
    const productsToDelete = Array.isArray(currentCellData.products) ? [...currentCellData.products] : [];

    if (productsToDelete.length === 0) {
        showMessage('No hay productos para eliminar en esta celda.', 'warning');
        return;
    }

    try {
        // Esperamos a que el usuario esté autenticado
        const user = await new Promise((resolve) => {
            if (auth.currentUser) resolve(auth.currentUser);
            else {
                const unsubscribe = auth.onAuthStateChanged(u => {
                    unsubscribe();
                    resolve(u);
                });
            }
        });

        const userEmail = user?.email || user?.uid || 'Invitado';
        const userName = user?.displayName || null;

        // Guardar la celda como libre en Firestore
        const dataToSave = {
            nombreCelda: cellId,
            state: 'libre',
            products: []
        };
        await saveCellToFirestore(cellId, dataToSave);
        showMessage('Todos los productos de la celda eliminados correctamente.', 'success');

        // Registrar cada producto eliminado como un movimiento separado
        for (const product of productsToDelete) {
            await logMovement({
                userEmail,
                userName,
                action: 'delete',
                mapId: 'mapa1',
                positionId: cellId,
                productId: product.id || null,
                productName: product.productName || 'N/A',
                productBrand: product.brand || 'N/A',
                lot: product.lot || 'N/A',
                quantity: product.quantity || 0,
                details: `Producto eliminado de la celda ${cellId}`
            });
        }

        // Limpiar UI
        modal.style.display = "none";
        selectedCell.classList.remove('selected-cell');
        selectedCell = null;

    } catch (err) {
        console.error('Error eliminando productos de la celda:', err);
        showMessage('Error eliminando los productos.', 'error');
    }
});

async function eliminarProducto(idProducto, usuarioActual) {
    const producto = products.find(p => p.id === idProducto);
    if (!producto) return;

    // Eliminar del array de productos
    products = products.filter(p => p.id !== idProducto);

    // Actualizar UI del mapa
    actualizarMapa();

    // Registrar la eliminación en Firestore
    await logDeleteProduct({
        userEmail: usuarioActual.correo,
        mapId: producto.mapId,
        positionId: producto.positionId,
        productId: producto.id,
        productName: producto.nombre,
        productBrand: producto.marca,
        lot: producto.lote,
        quantity: producto.cantidad
    });
}


function clearModalFields() {
    if (typeof productNameInput !== 'undefined' && productNameInput) productNameInput.value = '';
    if (typeof productBrandInput !== 'undefined' && productBrandInput) productBrandInput.value = '';
    if (typeof productQuantityInput !== 'undefined' && productQuantityInput) productQuantityInput.value = '';
    if (typeof productDateInput !== 'undefined' && productDateInput) productDateInput.value = '';
    if (typeof productPresentationSelect !== 'undefined' && productPresentationSelect) productPresentationSelect.value = '';
    if (typeof productLotInput !== 'undefined' && productLotInput) productLotInput.value = '';

    // Solo si existen estos campos
    if (typeof productContentTypeOtherInput !== 'undefined' && productContentTypeOtherInput) {
        productContentTypeOtherInput.value = '';
        productContentTypeOtherInput.style.display = 'none';
    }
    if (typeof productPresentationOtherInput !== 'undefined' && productPresentationOtherInput) {
        productPresentationOtherInput.value = '';
        productPresentationOtherInput.style.display = 'none';
    }

    // Ocultar grupo de expiración si existe
    if (typeof expirationDisplayGroup !== 'undefined' && expirationDisplayGroup) {
        expirationDisplayGroup.style.display = 'none';
    }
}


function deleteSingleProductFromModal(productIndex) {
    if (!selectedCell) {
        showMessage('No hay celda seleccionada.', 'error');
        return;
    }

    const cellId = selectedCell.dataset.id;
    const cellData = warehouseData[cellId];

    if (!cellData || !cellData.products || !cellData.products[productIndex]) {
        showMessage('Producto no encontrado para eliminar.', 'error');
        return;
    }

    const productToDelete = cellData.products[productIndex];

    if (!confirm(`¿Eliminar el producto ${productToDelete.productName}?`)) return;

    // Eliminar del array local
    cellData.products.splice(productIndex, 1);

    // Actualizar estado de la celda
    const newState = cellData.products.length > 0 ? 'ocupado' : 'libre';
    const dataToSave = {
        nombreCelda: cellId,
        state: newState,
        products: cellData.products
    };

    saveCellToFirestore(cellId, dataToSave)
        .then(async () => {
            showMessage(`Producto ${productToDelete.productName} eliminado correctamente.`, 'success');

            // Registrar movimiento
            const user = auth.currentUser;
            await logMovement({
                userEmail: user?.email || user?.uid || 'Invitado',
                userName: user?.displayName || null,
                action: 'delete',
                mapId: 'mapa1',
                positionId: cellId,
                productId: productToDelete.id || null,
                productName: productToDelete.productName,
                productBrand: productToDelete.brand,
                lot: productToDelete.lot,
                quantity: productToDelete.quantity,
                details: `Producto eliminado de la celda ${cellId}`
            });

            // Re-renderizar lista en modal
            renderProductListInModal(cellId);
        })
        .catch(err => {
            console.error('Error eliminando producto:', err);
            showMessage('Error al eliminar producto.', 'error');
        });
}


    // ******** DRAG AND DROP FUNCTIONS ********

    function handleDragStart(event) {
        if (!event.target.classList.contains('ocupado')) {
            event.preventDefault();
            return;
        }
        draggedCell = event.target;
        event.dataTransfer.setData('text/plain', draggedCell.dataset.id);
        event.dataTransfer.effectAllowed = 'move'; 

        setTimeout(() => {
            draggedCell.classList.add('dragging');
        }, 0); 
    }

    function handleDragOver(event) {
        event.preventDefault(); 
        const targetCell = event.target;

        if (targetCell.classList.contains('aisle') || targetCell.classList.contains('office') || targetCell.classList.contains('ocupado')) {
            event.dataTransfer.dropEffect = 'none'; 
            return;
        }

        event.dataTransfer.dropEffect = 'move'; 
        if (!targetCell.classList.contains('drop-target')) {
            targetCell.classList.add('drop-target');
        }
    }

    function handleDragLeave(event) {
        event.target.classList.remove('drop-target');
    }

    async function handleDrop(event) { // Hacemos la función async
        event.preventDefault(); 
        const targetCell = event.target;

        targetCell.classList.remove('drop-target');

        if (targetCell.classList.contains('aisle') || targetCell.classList.contains('office') || targetCell.classList.contains('ocupado')) {
            showMessage('No puedes mover un producto a un pasillo, oficina o una celda ya ocupada.', 'error', 5000); 
            return; 
        }

        const sourceId = event.dataTransfer.getData('text/plain');
        const targetId = targetCell.dataset.id;

        if (sourceId && targetId && sourceId !== targetId) {
            await moveProduct(sourceId, targetId); // await la función de movimiento
            showMessage('Producto movido exitosamente.', 'success'); 
        }

        if (draggedCell) {
            draggedCell.classList.remove('dragging');
            draggedCell = null;
        }
    }

   async function moveProduct(sourceId, targetId) { 
    const sourceCellData = warehouseData[sourceId]; // Obtener datos de Firestore
    if (!sourceCellData || !sourceCellData.products || sourceCellData.products.length === 0) {
        showMessage('No hay producto para mover en la celda de origen.', 'warning');
        return;
    }

    // Obtener el producto de la celda de origen (asumimos el primero)
    const productToMove = sourceCellData.products[0];

    // 1. Crear el nuevo documento en la celda destino
    const targetData = {
        nombreCelda: targetId,
        state: 'ocupado',
        products: [productToMove] // Mover el producto al destino
    };
    await saveCellToFirestore(targetId, targetData);

    // 2. Vaciar el documento de la celda origen
    const sourceData = {
        nombreCelda: sourceId,
        state: 'libre',
        products: [] // Vaciar productos en la celda origen
    };
    await saveCellToFirestore(sourceId, sourceData);

    // Registrar movimiento en Firestore
    logMovement({
        userEmail: currentUser?.email || currentUser?.uid || 'Invitado',
        action: 'Mover producto',
        mapId: 'mapa1', // o dinámico si manejas más mapas
        positionId: targetId,
        productId: productToMove.id,
        productName: productToMove.productName,
        productBrand: productToMove.brand,
        lot: productToMove.lot,
        quantity: productToMove.quantity,
        details: `Movido al contenedor ${targetId}`
    });

    // Las actualizaciones visuales se manejarán automáticamente por listenForWarehouseChanges
}


    toggleSearchButton.addEventListener('click', () => {
        const isHidden = searchProductInput.classList.contains('hidden');
        if (isHidden) {
            searchProductInput.classList.remove('hidden');
            searchProductInput.focus();
        } else {
            performSearch();
        }
    });

    searchProductInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

// ----------------------
// Helpers: editar / eliminar desde los botones (soportan index o id)
// ----------------------
async function deleteExistingProduct(cellId, indexOrId) {
    const currentCellData = warehouseData[cellId] || { products: [] };
    if (!currentCellData.products || currentCellData.products.length === 0) {
        showMessage('No hay productos en esta celda para eliminar.', 'warning');
        return;
    }

    // Determinar si recibimos un índice numérico o un id
    const maybeIndex = Number(indexOrId);
    let updatedProducts;
    if (!isNaN(maybeIndex) && Number.isInteger(maybeIndex) && maybeIndex >= 0 && maybeIndex < currentCellData.products.length) {
        if (!confirm('¿Estás seguro de que quieres eliminar este producto de la celda?')) return;
        updatedProducts = currentCellData.products.filter((_, i) => i !== maybeIndex);
    } else {
        // tratar indexOrId como productId
        const productId = indexOrId;
        if (!currentCellData.products.some(p => p.id === productId)) {
            showMessage('Producto no encontrado.', 'error');
            return;
        }
        if (!confirm('¿Estás seguro de que quieres eliminar este producto de la celda?')) return;
        updatedProducts = currentCellData.products.filter(p => p.id !== productId);
    }

    const dataToSave = {
        nombreCelda: cellId,
        state: updatedProducts.length > 0 ? 'ocupado' : 'libre',
        products: updatedProducts
    };

    try {
        await saveCellToFirestore(cellId, dataToSave);
        showMessage('Producto eliminado correctamente de la celda.', 'success');
    } catch (err) {
        console.error(err);
        showMessage('Error al eliminar producto. Revisa la consola.', 'error');
    }

    // Actualizar UI inmediata (Firestore también actualizará vía onSnapshot)
    const cellEl = document.querySelector(`[data-id="${cellId}"]`);
    if (cellEl) {
        const newState = updatedProducts.length > 0 ? 'ocupado' : 'libre';
        updateCellAppearance(cellEl, newState, updatedProducts[0] || null);
    }

    // Si el modal está abierto y es la misma celda, re-renderizar la lista
    if (modal.style.display === 'block' && selectedCell && selectedCell.dataset.id === cellId) {
        renderProductListInModal(cellId);
    }
}

function openEditModal(cellId, indexOrId) {
    const currentCellData = warehouseData[cellId] || { products: [] };
    if (!currentCellData.products || currentCellData.products.length === 0) {
        showMessage('No hay productos en esta celda para editar.', 'warning');
        return;
    }

    const maybeIndex = Number(indexOrId);
    let product;
    if (!isNaN(maybeIndex) && Number.isInteger(maybeIndex) && maybeIndex >= 0 && maybeIndex < currentCellData.products.length) {
        product = currentCellData.products[maybeIndex];
    } else {
        product = currentCellData.products.find(p => p.id === indexOrId);
    }

    if (!product) {
        showMessage('Producto no encontrado para editar.', 'error');
        return;
    }

    // Asegurar selectedCell DOM
    selectedCell = document.querySelector(`[data-id="${cellId}"]`) || selectedCell;

    // Preparar modal para edición
    currentProductForModalEdit = product;
    modalTitle.textContent = `Editar producto en ${cellId}`;
    productNameInput.value = product.productName || '';
    productBrandInput.value = product.brand || '';
    productQuantityInput.value = product.quantity || 1;
    productDateInput.value = product.date || '';
    productPresentationSelect.value = product.presentation || '';
    productLotInput.value = product.lot || '';

    // Ajustar selección visual de marca si tienes .brand-option-circle
    document.querySelectorAll('.brand-option-circle').forEach(option => option.classList.remove('selected'));
    const sb = document.querySelector(`.brand-option-circle[data-brand="${(product.brand||'').replace(/"/g,'\\"')}"]`);
    if (sb) sb.classList.add('selected');

    addButton.style.display = 'none';
    editButton.style.display = 'inline-block';
    deleteButton.style.display = 'none';

    // Abrir modal (si no estaba abierto)
    modal.style.display = 'block';
}
    // CAMBIOS CLAVE AQUÍ: performSearch para incluir el lote
    function performSearch() {
        const searchTerm = searchProductInput.value.toLowerCase().trim();

        // Eliminar clase 'found' y restaurar apariencia normal
        document.querySelectorAll('.grid-cell.found').forEach(cell => {
            cell.classList.remove('found');
            const id = cell.dataset.id;
            const cellData = warehouseData[id];
            const state = (cellData && cellData.products && cellData.products.length > 0) ? 'ocupado' : 'libre';
            const productToDisplay = state === 'ocupado' ? cellData.products[0] : null;
            updateCellAppearance(cell, state, productToDisplay);
        });

        if (searchTerm === '') {
            searchProductInput.classList.add('hidden');
            showMessage('Búsqueda cancelada. Campo de búsqueda vacío.', 'info'); 
            return;
        }

        let foundCount = 0;
        let totalQuantity = 0; 

        for (const id in warehouseData) { 
            const pos = warehouseData[id];
            const cell = document.querySelector(`[data-id="${id}"]`);

            if (!cell || cell.classList.contains('aisle') || cell.classList.contains('office')) {
                continue;
            }

            if (pos.products && pos.products.length > 0) {
                const product = pos.products[0]; // Asumimos buscar en el primer producto
                if (product.productName.toLowerCase().includes(searchTerm) || 
                    (product.brand && product.brand.toLowerCase().includes(searchTerm)) ||
                    (product.lot && product.lot.toLowerCase().includes(searchTerm))) { // CAMBIOS CLAVE AQUÍ: Buscar por lote
                    
                    cell.classList.add('found');
                    foundCount++;
                    totalQuantity += product.quantity; 
                }
            }
        }
        
        if (foundCount === 0) {
            showMessage('No se encontraron productos que coincidan con la búsqueda.', 'warning', 4000);
        } else {
            showMessage(`Se encontraron ${foundCount} posiciones y un total de ${totalQuantity} cajas del producto o lote "${searchTerm}".`, 'info', 6000);
        }
    }

    if (goToMap2Button) {
        goToMap2Button.addEventListener('click', () => {
            // Pasar un parámetro en la URL: ?mapId=mapa2
            window.location.href = 'index2.html'; 
        });
    }

    if (goToMap3Button) {
        goToMap3Button.addEventListener('click', () => {
            // Pasar un parámetro en la URL: ?mapId=mapa3
            window.location.href = 'index3.html'; 
        });
    }

    gridContainer.addEventListener('mouseout', (event) => {
        const cell = event.target.closest('.grid-cell[data-id]');
        if (cell) { 
            hideTooltip();
        }
    });

    // Redirigir al login de administrador
document.getElementById('adminAccessBtn').addEventListener('click', () => {
    window.location.href = 'admin-login.html'; 
});

    const logoutButton = document.getElementById('logout-button');

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut() 
                .then(() => {
                    showMessage('Sesión cerrada correctamente.', 'info', 2000);
                    setTimeout(() => {
                        window.location.href = 'login.html'; 
                    }, 2000);
                })
                .catch((error) => {
                    console.error('Error al cerrar sesión:', error); 
                    showMessage('Error al cerrar sesión. Intenta de nuevo.', 'error', 3000);
                });
        });
    }
    // Dentro de js/script.js, en el DOMContentLoaded
    const goToSalidasButton = document.getElementById('go-to-salidas-button');
    if (goToSalidasButton) {
        goToSalidasButton.addEventListener('click', () => {
            window.location.href = 'salidas.html';
        });
    }
    // Listener para el estado de autenticación (para iniciar la escucha de Firestore)
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        if (user) {
            console.log('Usuario autenticado:', user.uid);
            createGrid(); // Crea el grid una vez que el usuario está autenticado
            listenForWarehouseChanges(); // Empieza a escuchar los cambios de Firestore
        } else {
            console.log('No hay usuario autenticado.');
            // Puedes redirigir a login.html aquí si no lo haces en el script de index.html
        }
    });

});