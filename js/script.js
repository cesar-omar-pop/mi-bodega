// script.js
import { auth, db } from './firebase-config.js'; // Asegúrate de importar 'db'
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Importa la función showMessage desde tu nuevo archivo notifications.js
// (Asegúrate de que este import sea correcto si tienes un archivo notifications.js separado)
// import { showMessage } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.querySelector('.grid-container');
    const modal = document.getElementById('modal');
    const closeModalButton = document.querySelector('.close-button');

    const productNameInput = document.getElementById('product-name-input');
    const productBrandInput = document.getElementById('product-brand-input');
    const productQuantityInput = document.getElementById('product-quantity-input');
    const productDateInput = document.getElementById('product-date-input');
    const productPresentationSelect = document.getElementById('product-presentation-select');
    const modalPositionDisplay = document.getElementById('modal-position');

    const editButton = document.getElementById('edit-button');
    const deleteButton = document.getElementById('delete-button');
    const addButton = document.getElementById('add-button');
    
    const searchProductInput = document.getElementById('search-product-input');
    const toggleSearchButton = document.getElementById('toggle-search-button');
    // const newMapButton = document.getElementById('new-map-button'); // No usado en tu script actual

    const goToMap2Button = document.getElementById('go-to-map2-button');
    const goToMap3Button = document.getElementById('go-to-map3-button');
    const customTooltip = document.getElementById('custom-tooltip');

    let draggedCell = null;

    let numRows = 14;
    let numCols = 25;
    // REEMPLAZAMOS 'positions' por 'warehouseData' para almacenar los datos de Firestore
    let warehouseData = {}; 

    // ID de la bodega (puedes hacer esto dinámico si tienes múltiples bodegas)
    const WAREHOUSE_ID = 'mapa1';
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
                    // Actualizar nuestro estado local 'warehouseData'
                    warehouseData[cellId] = cellData;

                    // Determinar el estado de la celda basado en si tiene productos
                    const state = (cellData.products && cellData.products.length > 0) ? 'ocupado' : 'libre';
                    
                    // Pasar el primer producto para la visualización directa si existe
                    const productToDisplay = state === 'ocupado' ? cellData.products[0] : null;
                    updateCellAppearance(cellElement, state, productToDisplay); // Modificado para pasar el objeto product
                }
            });
            // Si hay una celda seleccionada (modal abierto), actualiza el modal con los últimos datos de Firestore
            if (selectedCell) {
                selectPosition({ target: selectedCell }); // Esto re-rellenará el modal con los datos actualizados
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
                } else if (isSpecialArea) {
                    cell.className = `grid-cell aisle ${isSpecialArea.className || ''}`;
                } else if (isMiddleAisle) {
                    cell.className = `grid-cell aisle ${isMiddleAisle.className || ''}`;
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
                presentation
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

            let tooltipContent = `-Producto: ${details.productName}`;
            if (details.brand) tooltipContent += `\n-Marca: ${details.brand}`;
            tooltipContent += `\n-Cantidad: ${details.quantity}`;
            if (details.presentation) tooltipContent += `\n-Presentación: ${details.presentation}`;
            if (details.date) tooltipContent += `\n-Fecha: ${details.date}`;

            customTooltip.textContent = tooltipContent;

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

    let selectedCell = null;

    function selectPosition(event) {
        if (event.target.classList.contains('aisle') || event.target.classList.contains('office')) return;
        
        const clickedCell = event.target;
        const clickedCellId = clickedCell.dataset.id;
        // AHORA USAMOS 'warehouseData' EN LUGAR DE 'positions'
        const currentCellData = warehouseData[clickedCellId]; 

        hideTooltip(); 

        if (selectedCell) {
            selectedCell.classList.remove('selected');
        }
        selectedCell = clickedCell;
        selectedCell.classList.add('selected');
        modalPositionDisplay.textContent = `Posición: ${selectedCell.dataset.row}-${selectedCell.dataset.col}`;

        // Limpiar todas las selecciones de marca predeterminadas
        document.querySelectorAll('.brand-option-circle').forEach(option => {
            option.classList.remove('selected');
        });

        // Rellenar campos del modal
        if (currentCellData && currentCellData.products && currentCellData.products.length > 0) { 
            const productToDisplay = currentCellData.products[0]; // Asumimos el primer producto
            productNameInput.value = productToDisplay.productName || '';
            productBrandInput.value = productToDisplay.brand || ''; // Usar 'brand'
            productQuantityInput.value = productToDisplay.quantity || 1;
            productDateInput.value = productToDisplay.date || '';
            productPresentationSelect.value = productToDisplay.presentation || '';

            // Seleccionar la opción de marca predeterminada si coincide
            const selectedBrandOption = document.querySelector(`.brand-option-circle[data-brand="${productToDisplay.brand}"]`);
            if (selectedBrandOption) {
                selectedBrandOption.classList.add('selected');
            }

            productNameInput.readOnly = false; 
            productBrandInput.readOnly = false;
            productQuantityInput.readOnly = false;
            productDateInput.readOnly = false;
            productPresentationSelect.disabled = false;

            editButton.style.display = 'inline-block';
            deleteButton.style.display = 'inline-block';
            addButton.style.display = 'none';

        } else { // Si la celda está libre o no tiene productos
            productNameInput.readOnly = false;
            productBrandInput.readOnly = false;
            productQuantityInput.readOnly = false;
            productDateInput.readOnly = false;
            productPresentationSelect.disabled = false;

            productNameInput.value = '';
            productBrandInput.value = '';
            productQuantityInput.value = 1;
            productDateInput.value = '';
            productPresentationSelect.value = '';

            editButton.style.display = 'none';
            deleteButton.style.display = 'none';
            addButton.style.display = 'inline-block';
        }

        modal.style.display = "block";
    }

    closeModalButton.addEventListener('click', () => {
        modal.style.display = "none";
        if (selectedCell) {
            selectedCell.classList.remove('selected');
            selectedCell = null;
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
            if (selectedCell) {
                selectedCell.classList.remove('selected');
                selectedCell = null;
            }
        }
    });

    // Lógica para Guardar/Editar Producto (editButton)
    editButton.addEventListener('click', async () => { // Hacemos la función async
        if (!selectedCell) {
            showMessage('No hay celda seleccionada para editar.', 'error');
            return;
        }
        const id = selectedCell.dataset.id;
        const productName = productNameInput.value.trim();
        if (!productName) {
            showMessage('El nombre del producto no puede estar vacío.', 'warning');
            return;
        }

        const productBrand = productBrandInput.value.trim();
        const quantity = parseInt(productQuantityInput.value) || 1;
        const date = productDateInput.value;
        const presentation = productPresentationSelect.value;

        // AHORA LEEMOS DE 'warehouseData' Y ASUMIMOS QUE SI ESTAMOS EDITANDO, HAY UN PRODUCTO
        const currentCellData = warehouseData[id] || { products: [] };
        let updatedProducts = Array.isArray(currentCellData.products) ? [...currentCellData.products] : [];

        if (updatedProducts.length > 0) {
            // Asumiendo que editamos el primer producto en la celda
            updatedProducts[0].productName = productName;
            updatedProducts[0].brand = productBrand; // Actualizar el campo 'brand'
            updatedProducts[0].quantity = quantity;
            updatedProducts[0].date = date;
            updatedProducts[0].presentation = presentation;
        } else {
            showMessage('No hay producto para editar en esta celda.', 'warning');
            return;
        }

        const dataToSave = {
            nombreCelda: id, // Puedes mantener esto si lo usas para referencia, aunque el ID del documento es 'id'
            state: updatedProducts.length > 0 ? 'ocupado' : 'libre',
            products: updatedProducts
        };

        await saveCellToFirestore(id, dataToSave);
        showMessage('Producto actualizado correctamente.', 'success'); 

        modal.style.display = "none";
        if (selectedCell) {
            selectedCell.classList.remove('selected');
            selectedCell = null;
        }
    });

    // Lógica para Agregar Producto (cuando la celda está libre)
    addButton.addEventListener('click', async () => { // Hacemos la función async
        if (!selectedCell) {
            showMessage('No hay celda seleccionada para agregar producto.', 'error');
            return;
        }
        const id = selectedCell.dataset.id;
        const productName = productNameInput.value.trim();
        if (!productName) {
            showMessage('El nombre del producto no puede estar vacío.', 'warning'); 
            return;
        }

        const productBrand = productBrandInput.value.trim();
        const quantity = parseInt(productQuantityInput.value) || 1;
        const date = productDateInput.value;
        const presentation = productPresentationSelect.value;
        
        const newProduct = {
            id: crypto.randomUUID(), 
            productName,
            brand: productBrand, 
            quantity,
            date,
            presentation
        };

        // AHORA LEEMOS DE 'warehouseData'
        const currentCellData = warehouseData[id] || { products: [] };
        let updatedProducts = Array.isArray(currentCellData.products) ? [...currentCellData.products] : [];
        
        updatedProducts.push(newProduct);
        
        const dataToSave = {
            nombreCelda: id, // Puedes mantener esto si lo usas para referencia
            state: 'ocupado',
            products: updatedProducts
        };

        await saveCellToFirestore(id, dataToSave);
        showMessage('Producto agregado correctamente.', 'success'); 

        modal.style.display = "none";
        if (selectedCell) {
            selectedCell.classList.remove('selected');
            selectedCell = null;
        }
    });

    // Lógica para Eliminar Producto
    deleteButton.addEventListener('click', async () => { // Hacemos la función async
        if (!selectedCell) {
            showMessage('No hay celda seleccionada para eliminar.', 'error');
            return;
        }
        const id = selectedCell.dataset.id;
        
        if (confirm('¿Estás seguro de que quieres eliminar este producto?')) { 
            // Para eliminar, vamos a vaciar el array de productos y cambiar el estado a 'libre'
            const dataToSave = {
                nombreCelda: id,
                state: 'libre',
                products: [] // Vaciar el array de productos
            };

            await saveCellToFirestore(id, dataToSave); // Guardar el estado vacío
            // Alternativamente, si quieres eliminar el documento de la celda por completo:
            // await deleteCellFromFirestore(id);
            // Si eliminas el documento, asegúrate de que listenForWarehouseChanges maneje la eliminación.
            // Por ahora, vaciar el array de productos es más sencillo.

            showMessage('Producto eliminado correctamente.', 'success'); 

            // Re-abrir modal para mostrar opciones de "Agregar Producto"
            // La función selectPosition ya leerá los datos actualizados de warehouseData
            selectPosition({ target: selectedCell });
            modal.style.display = "block";
            addButton.style.display = 'inline-block';
            editButton.style.display = 'none';
            deleteButton.style.display = 'none';
        }
    });

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

    async function moveProduct(sourceId, targetId) { // Hacemos la función async
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

    function performSearch() {
        const searchTermProduct = searchProductInput.value.toLowerCase().trim();

        document.querySelectorAll('.grid-cell.found').forEach(cell => {
            cell.classList.remove('found');
            // Revertir a la apariencia normal (basado en warehouseData)
            const id = cell.dataset.id;
            const cellData = warehouseData[id];
            const state = (cellData && cellData.products && cellData.products.length > 0) ? 'ocupado' : 'libre';
            const productToDisplay = state === 'ocupado' ? cellData.products[0] : null;
            updateCellAppearance(cell, state, productToDisplay);
        });

        if (searchTermProduct === '') {
            searchProductInput.classList.add('hidden');
            showMessage('Búsqueda cancelada. Campo de búsqueda vacío.', 'info'); 
            return;
        }

        let foundCount = 0;
        let totalQuantity = 0; 

        for (const id in warehouseData) { // Iterar sobre warehouseData
            const pos = warehouseData[id];
            const cell = document.querySelector(`[data-id="${id}"]`);

            if (!cell || cell.classList.contains('aisle') || cell.classList.contains('office')) {
                continue;
            }

            // Si la celda tiene productos y el nombre o marca coincide
            if (pos.products && pos.products.length > 0) {
                const product = pos.products[0]; // Asumimos buscar en el primer producto
                if (product.productName.toLowerCase().includes(searchTermProduct) || 
                    (product.brand && product.brand.toLowerCase().includes(searchTermProduct))) {
                    cell.classList.add('found');
                    foundCount++;
                    totalQuantity += product.quantity; 
                }
            }
        }
        
        if (foundCount === 0) {
            showMessage('No se encontraron productos que coincidan con la búsqueda.', 'warning', 4000);
        } else {
            showMessage(`Se encontraron ${foundCount} posiciones y un total de ${totalQuantity} cajas del producto "${searchTermProduct}".`, 'info', 6000);
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