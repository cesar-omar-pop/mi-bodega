// script2.js - Lógica JavaScript para el Mapa 2, con Múltiples Productos por Celda y Persistencia Firestore

import { db } from './firebase-config.js'; // Asegúrate de que esta ruta sea correcta
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
    const gridContainer = document.getElementById('warehouse-map2');
    if (!gridContainer) {
        console.error('Error: El elemento con ID "warehouse-map2" no se encontró en el DOM. La página no se inicializará correctamente.');
        return;
    }

    const modal = document.getElementById('modal');
    const closeModalButton = document.querySelector('.close-button');
    const modalPositionTitle = document.getElementById('modal-position');

    const productNameInput = document.getElementById('product-name-input');
    const productBrandInput = document.getElementById('product-brand-input');
    const productContentTypeSelect = document.getElementById('product-content-type-select');
    const productPresentationSelect = document.getElementById('product-presentation-select');

    const productContentTypeOtherInput = document.getElementById('product-content-type-other');
    const productPresentationOtherInput = document.getElementById('product-presentation-other');

    const productQuantityInput = document.getElementById('product-quantity-input');
    const productDateElaborationInput = document.getElementById('product-date-elaboration-input'); // Corregido: `= document` eliminado
    const productDurationInput = document.getElementById('product-duration-input');
    const productBatchInput = document.getElementById('product-batch-input');

    const addButton = document.getElementById('add-button');
    const editButton = document.getElementById('edit-button');
    const deleteButton = document.getElementById('delete-button');
    const addedProductsList = document.getElementById('added-products-list');

    const toggleSearchButton = document.getElementById('toggle-search-button');
    const searchInputsContainer = document.getElementById('search-inputs-container');
    const searchProductInput = document.getElementById('search-product-input');
    const searchBrandInput = document.getElementById('search-brand-input');
    const searchQuantityInput = document.getElementById('search-quantity-input');

    const backToMainButton = document.getElementById('back-to-main-button');
    const goToMap3Button = document.getElementById('go-to-map3-button');

    const customTooltip = document.getElementById('custom-tooltip');
    const toastNotification = document.getElementById('toast-notification');

    // Nuevas referencias para los resultados de búsqueda
    const searchResultsContainer = document.getElementById('search-results-container');
    const searchResultsList = document.getElementById('search-results-list');

    let positions = {};
    let currentPositionId = null;
    let currentProductIndex = -1;
    let currentSelectedCell = null;

    const MAX_PRODUCTS_PER_CELL = 5;
    const WAREHOUSE_ID = 'mapa2';
    const POSITIONS_COLLECTION_PATH = `bodegas/${WAREHOUSE_ID}/posiciones`;

    // --- Toast Notification Function ---
    function showToast(message, type = 'success', duration = 3000) {
        toastNotification.textContent = message;
        toastNotification.className = 'toast-notification show ' + type;

        setTimeout(() => {
            toastNotification.classList.remove('show');
            setTimeout(() => {
                toastNotification.textContent = '';
                toastNotification.className = 'toast-notification';
            }, 500);
        }, duration);
    }

    // --- Funciones de persistencia de datos (Firestore) ---
    async function savePositionToFirestore(positionId, productsArray) {
        try {
            const positionRef = doc(db, POSITIONS_COLLECTION_PATH, positionId);
            await setDoc(positionRef, { products: productsArray });
            console.log(`Posición ${positionId} guardada en Firestore.`);
            updateGridDisplay();
            showToast('Datos guardados correctamente.', 'success');
        } catch (e) {
            console.error('Error al guardar la posición en Firestore:', e);
            showToast('Error al guardar los datos en la base de datos.', 'error');
        }
    }

    async function loadPositionsFromFirestore() {
        try {
            const querySnapshot = await getDocs(collection(db, POSITIONS_COLLECTION_PATH));
            positions = {};
            querySnapshot.forEach((doc) => {
                positions[doc.id] = doc.data();
            });
            console.log("Datos cargados de Firestore:", positions);
            updateGridDisplay();
            showToast('Datos cargados correctamente.', 'success');
        } catch (e) {
            console.error('Error al cargar las posiciones de Firestore:', e);
            showToast('Error al cargar los datos de la base de datos. Se cargarán datos vacíos.', 'error');
            positions = {};
        }
    }

    // --- Funciones de UI/UX del mapa ---
    function updateGridDisplay() {
        gridContainer.querySelectorAll('.grid-cell').forEach(cell => {
            const id = cell.dataset.id;
            // Ignorar celdas de separación o contenedores que no son de producto
            if (cell.classList.contains('red-separator') || cell.classList.contains('rack-level-separator') ||
                cell.classList.contains('vertical-aisle') || cell.classList.contains('horizontal-aisle-bottom') ||
                cell.classList.contains('pasillo-horizontal') || cell.classList.contains('outer-block-border')) {
                return;
            }

            const productsInCell = positions[id] ? positions[id].products : [];
            updateCellAppearance(cell, productsInCell);
        });
    }

    function updateCellAppearance(cell, products) {
        if (!cell) return;

        cell.classList.remove('libre', 'ocupado', 'found'); // Elimina 'found' también
        cell.innerHTML = '';

        cell.textContent = cell.dataset.id;

        if (products && products.length > 0) {
            cell.classList.add('ocupado');
        } else {
            cell.classList.add('libre');
        }
    }


    function showTooltip(event, cell) {
        if (!cell || !customTooltip) {
            console.warn('showTooltip: Celda o tooltip no encontrado.');
            return;
        }

        const id = cell.dataset.id;
        const productsInCell = positions[id] ? positions[id].products : [];
        let tooltipContent = `<strong>Posición: ${id}</strong>`;

        if (productsInCell.length > 0) {
            tooltipContent += '<br><br><strong>Productos:</strong>';
            productsInCell.forEach((product, index) => {
                tooltipContent += `<br>${index + 1}. ${product.productName || 'N/A'} (Cant: ${product.productQuantity || 0})`;
            });
        } else {
            tooltipContent += '<br>Vacía';
        }

        customTooltip.innerHTML = tooltipContent;
        customTooltip.classList.add('visible');

        const x = event.clientX + 15;
        const y = event.clientY + 15;

        customTooltip.style.left = `${x}px`;
        customTooltip.style.top = `${y}px`;

        if (x + customTooltip.offsetWidth > window.innerWidth) {
            customTooltip.style.left = `${event.clientX - customTooltip.offsetWidth - 15}px`;
        }
        if (y + customTooltip.offsetHeight > window.innerHeight) {
            customTooltip.style.top = `${event.clientY - customTooltip.offsetHeight - 15}px`;
        }
    }

    function hideTooltip() {
        if (customTooltip) {
            customTooltip.classList.remove('visible');
        }
    }

    // --- Funciones del modal ---
    function openModal(cell) {
        currentPositionId = cell.dataset.id;
        modalPositionTitle.textContent = `Posición: ${currentPositionId}`;

        clearProductForm();
        currentProductIndex = -1;
        addButton.style.display = 'inline-block';
        editButton.style.display = 'none';
        deleteButton.style.display = 'none';

        updateAddedProductsDisplay();

        modal.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
        if (currentSelectedCell) {
            currentSelectedCell.classList.remove('selected');
        }
        currentPositionId = null;
        currentProductIndex = -1;
        clearProductForm();
        // Al cerrar el modal, siempre refresca el grid para quitar posibles resaltados de búsqueda
        updateGridDisplay();
        // Ocultar resultados de búsqueda si no hay un término activo
        if (searchProductInput.value === '' && searchBrandInput.value === '' && searchQuantityInput.value === '') {
            searchResultsContainer.style.display = 'none';
            searchResultsList.innerHTML = '';
        }
    }

    function clearProductForm() {
        productNameInput.value = '';
        productBrandInput.value = '';
        productContentTypeSelect.value = '';
        if (productContentTypeOtherInput) {
            productContentTypeOtherInput.value = '';
            productContentTypeOtherInput.style.display = 'none';
        }
        productPresentationSelect.value = '';
        if (productPresentationOtherInput) {
            productPresentationOtherInput.value = '';
            productPresentationOtherInput.style.display = 'none';
        }
        productQuantityInput.value = '1';
        productDateElaborationInput.value = '';
        productDurationInput.value = '';
        productBatchInput.value = '';

        addButton.style.display = 'inline-block';
        editButton.style.display = 'none';
        deleteButton.style.display = 'none';
        currentProductIndex = -1;
    }

    function fillProductForm(product) {
        productNameInput.value = product.productName || '';
        productBrandInput.value = product.productBrand || '';
        productContentTypeSelect.value = product.productContentType || '';
        if (productContentTypeSelect.value === 'otro' && productContentTypeOtherInput) {
            productContentTypeOtherInput.value = product.productContentTypeOther || '';
            productContentTypeOtherInput.style.display = 'block';
        } else {
            if (productContentTypeOtherInput) {
                productContentTypeOtherInput.value = '';
                productContentTypeOtherInput.style.display = 'none';
            }
        }
        productPresentationSelect.value = product.productPresentation || '';
        if (productPresentationSelect.value === 'otro' && productPresentationOtherInput) {
            productPresentationOtherInput.value = product.productPresentationOther || '';
            productPresentationOtherInput.style.display = 'block';
        } else {
            if (productPresentationOtherInput) {
                productPresentationOtherInput.value = '';
                productPresentationOtherInput.style.display = 'none';
            }
        }
        productQuantityInput.value = product.productQuantity || 1;
        productDateElaborationInput.value = product.productDateElaboration || '';
        productDurationInput.value = product.productDuration || '';
        productBatchInput.value = product.productBatch || '';
    }

    function updateAddedProductsDisplay() {
        addedProductsList.innerHTML = '';
        const products = positions[currentPositionId] ? positions[currentPositionId].products : [];

        if (products.length === 0) {
            addedProductsList.innerHTML = '<p>No hay productos en esta posición.</p>';
            return;
        }

        products.forEach((product, index) => {
            const productItem = document.createElement('div');
            productItem.classList.add('added-product-item');
            productItem.innerHTML = `
                <span><strong>${product.productName || 'N/A'}</strong> (Cant: ${product.productQuantity || 0}, Marca: ${product.productBrand || 'N/A'})</span>
                <div class="product-item-actions">
                    <button class="edit-product-btn save" data-index="${index}">Editar</button>
                    <button class="delete-product-btn delete" data-index="${index}">Eliminar</button>
                </div>
            `;
            addedProductsList.appendChild(productItem);
        });

        addedProductsList.querySelectorAll('.edit-product-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const index = parseInt(event.target.dataset.index);
                editExistingProduct(index);
            });
        });

        addedProductsList.querySelectorAll('.delete-product-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const index = parseInt(event.target.dataset.index);
                deleteExistingProduct(index);
            });
        });
    }

    function getProductDataFromForm() {
        const productName = productNameInput.value.trim();
        const productBrand = productBrandInput.value.trim();
        const quantity = parseInt(productQuantityInput.value);
        const dateElaboration = productDateElaborationInput.value.trim();
        const duration = productDurationInput.value.trim();
        const batch = productBatchInput.value.trim();

        if (!productName) {
            showToast('Debe especificar el nombre del producto.', 'warning');
            return null;
        }
        if (!productBrand) {
            showToast('Debe especificar la marca del producto.', 'warning');
            return null;
        }
        if (isNaN(quantity) || quantity <= 0) {
            showToast('La cantidad debe ser un número positivo.', 'warning');
            return null;
        }
        if (!dateElaboration) {
            showToast('Debe especificar la fecha de elaboración del producto.', 'warning');
            return null;
        }
        if (!duration) {
            showToast('Debe especificar la duración del producto.', 'warning');
            return null;
        }
        if (!batch) {
            showToast('Debe especificar el lote del producto.', 'warning');
            return null;
        }

        let contentType = productContentTypeSelect.value;
        let contentTypeOther = '';
        if (contentType === 'otro') {
            if (productContentTypeOtherInput && productContentTypeOtherInput.value.trim() === '') {
                showToast('Debe especificar el tipo de contenido "otro".', 'warning');
                return null;
            }
            contentTypeOther = productContentTypeOtherInput ? productContentTypeOtherInput.value.trim() : '';
        } else if (contentType === '') {
            showToast('Debe seleccionar un tipo de contenido.', 'warning');
            return null;
        }

        let presentationType = productPresentationSelect.value;
        let presentationTypeOther = '';
        if (presentationType === 'otro') {
            if (productPresentationOtherInput && productPresentationOtherInput.value.trim() === '') {
                showToast('Debe especificar el tipo de presentación "otro".', 'warning');
                return null;
            }
            presentationTypeOther = productPresentationOtherInput ? productPresentationOtherInput.value.trim() : '';
        } else if (presentationType === '') {
            showToast('Debe seleccionar un tipo de presentación.', 'warning');
            return null;
        }


        return {
            productName: productName,
            productBrand: productBrand,
            productContentType: contentType,
            productContentTypeOther: contentTypeOther,
            productPresentation: presentationType,
            productPresentationOther: presentationTypeOther,
            productQuantity: quantity,
            productDateElaboration: dateElaboration,
            productDuration: duration,
            productBatch: batch,
        };
    }

    addButton.addEventListener('click', async () => {
        if (!currentPositionId) {
            showToast('No hay una posición seleccionada para agregar el producto. Por favor, seleccione una celda del mapa.', 'error');
            return;
        }

        const newProductData = getProductDataFromForm();
        if (!newProductData) return;

        if (!positions[currentPositionId]) {
            positions[currentPositionId] = { products: [] };
        }

        if (positions[currentPositionId].products.length >= MAX_PRODUCTS_PER_CELL) {
            showToast(`Ya hay ${MAX_PRODUCTS_PER_CELL} productos en esta posición. No se pueden agregar más.`, 'warning');
            return;
        }

        positions[currentPositionId].products.push(newProductData);
        await savePositionToFirestore(currentPositionId, positions[currentPositionId].products);

        updateAddedProductsDisplay();
        clearProductForm();
        showToast('Producto agregado a la posición.', 'success');
    });

    function editExistingProduct(index) {
        if (!positions[currentPositionId] || !positions[currentPositionId].products[index]) {
            console.error('No se encontró el producto para editar.');
            showToast('Error: No se encontró el producto para editar.', 'error');
            return;
        }
        const productToEdit = positions[currentPositionId].products[index];
        currentProductIndex = index;
        fillProductForm(productToEdit);
        addButton.style.display = 'none';
        editButton.style.display = 'inline-block';
        deleteButton.style.display = 'inline-block';
    }

    editButton.addEventListener('click', async () => {
        if (currentPositionId && currentProductIndex !== -1) {
            const updatedProductData = getProductDataFromForm();
            if (!updatedProductData) return;

            positions[currentPositionId].products[currentProductIndex] = updatedProductData;
            await savePositionToFirestore(currentPositionId, positions[currentPositionId].products);

            updateAddedProductsDisplay();
            clearProductForm();
            showToast('Producto actualizado correctamente.', 'success');
        } else {
            showToast('No se seleccionó ningún producto para actualizar.', 'warning');
        }
    });

    deleteButton.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que quieres eliminar este producto de la posición?')) {
            if (currentPositionId && currentProductIndex !== -1) {
                positions[currentPositionId].products.splice(currentProductIndex, 1);

                if (positions[currentPositionId].products.length === 0) {
                    try {
                        await deleteDoc(doc(db, POSITIONS_COLLECTION_PATH, currentPositionId));
                        delete positions[currentPositionId];
                        showToast('Producto eliminado y posición marcada como libre.', 'success');
                    } catch (e) {
                        console.error('Error al eliminar el documento de Firestore:', e);
                        showToast('Error al eliminar la posición de la base de datos.', 'error');
                    }
                } else {
                    await savePositionToFirestore(currentPositionId, positions[currentPositionId].products);
                    showToast('Producto eliminado de la posición.', 'success');
                }

                updateAddedProductsDisplay();
                clearProductForm();
                closeModal();
            } else {
                showToast('No se seleccionó ningún producto para eliminar.', 'warning');
            }
        }
    });

    // Event listeners para los selects "otro"
    productContentTypeSelect.addEventListener('change', () => {
        if (productContentTypeSelect.value === 'otro') {
            productContentTypeOtherInput.style.display = 'block';
        } else {
            productContentTypeOtherInput.style.display = 'none';
            productContentTypeOtherInput.value = '';
        }
    });

    productPresentationSelect.addEventListener('change', () => {
        if (productPresentationSelect.value === 'otro') {
            productPresentationOtherInput.style.display = 'block';
        } else {
            productPresentationOtherInput.style.display = 'none';
            productPresentationOtherInput.value = '';
        }
    });

    // --- Funciones de búsqueda MEJORADAS ---
    function performSearch() {
        const searchTermProduct = searchProductInput.value.toLowerCase().trim();
        const searchTermBrand = searchBrandInput.value.toLowerCase().trim();
        const searchTermQuantity = searchQuantityInput.value.trim(); // Mantener como string para validación posterior

        const hasSearchTerm = searchTermProduct !== '' || searchTermBrand !== '' || searchTermQuantity !== '';

        searchResultsList.innerHTML = ''; // Limpiar resultados anteriores
        searchResultsContainer.style.display = hasSearchTerm ? 'block' : 'none'; // Mostrar/ocultar contenedor

        const foundProductsByPosition = {}; // Para agrupar productos encontrados por su nombre y posición

        gridContainer.querySelectorAll('.grid-cell').forEach(cell => {
            if (cell.classList.contains('red-separator') || cell.classList.contains('rack-level-separator') ||
                cell.classList.contains('vertical-aisle') || cell.classList.contains('horizontal-aisle-bottom') ||
                cell.classList.contains('pasillo-horizontal') || cell.classList.contains('outer-block-border')) {
                return;
            }

            const id = cell.dataset.id;
            const productsInCell = positions[id] ? positions[id].products : [];
            let cellContainsMatch = false; // Indica si la celda contiene AL MENOS UN producto que coincide

            productsInCell.forEach(product => {
                const matchesProduct = searchTermProduct === '' || (product.productName && product.productName.toLowerCase().includes(searchTermProduct));
                const matchesBrand = searchTermBrand === '' || (product.productBrand && product.productBrand.toLowerCase().includes(searchTermBrand));
                const matchesQuantity = searchTermQuantity === '' || (parseInt(product.productQuantity) === parseInt(searchTermQuantity));

                if (matchesProduct && matchesBrand && matchesQuantity) {
                    cellContainsMatch = true;

                    // Agrupar los resultados para mostrar "Producto X en Posición Y (cantidad)"
                    const key = `${product.productName || 'Desconocido'}-${product.productBrand || 'Desconocido'}`;
                    if (!foundProductsByPosition[key]) {
                        foundProductsByPosition[key] = {
                            productName: product.productName,
                            productBrand: product.productBrand,
                            positions: []
                        };
                    }
                    foundProductsByPosition[key].positions.push({
                        positionId: id,
                        quantity: product.productQuantity || 0
                    });
                }
            });

            // Resaltar la celda si contiene al menos un producto que coincide
            cell.classList.remove('found');
            if (cellContainsMatch) {
                cell.classList.add('found');
            }
            // Asegurarse de que la apariencia de la celda (rojo/blanco, solo ID) se mantenga
            updateCellAppearance(cell, productsInCell);
            if (cellContainsMatch) { // Vuelve a aplicar 'found' para que el color de búsqueda tenga prioridad
                 cell.classList.add('found');
            }
        });

        // Mostrar los resultados detallados en la lista
        if (hasSearchTerm) {
            let resultsCount = 0;
            for (const key in foundProductsByPosition) {
                const productGroup = foundProductsByPosition[key];
                const listItem = document.createElement('li');
                
                // Mostrar el nombre y marca del producto una vez
                let productInfo = `<strong>${productGroup.productName || 'N/A'}</strong> (Marca: ${productGroup.productBrand || 'N/A'})`;
                
                // Recopilar todas las posiciones para este producto
                const positionsInfo = productGroup.positions.map(pos => 
                    `<span class="position-info">Posición: ${pos.positionId} (Cantidad: ${pos.quantity})</span>`
                ).join(', ');

                listItem.innerHTML = `${productInfo}<br>${positionsInfo}`;
                searchResultsList.appendChild(listItem);
                resultsCount++;
            }

            if (resultsCount === 0) {
                searchResultsList.innerHTML = '<li>No se encontraron productos con los criterios de búsqueda.</li>';
            }
        } else {
            searchResultsContainer.style.display = 'none'; // Ocultar si no hay términos de búsqueda
        }
    }

    searchProductInput.addEventListener('input', performSearch);
    searchBrandInput.addEventListener('input', performSearch);
    searchQuantityInput.addEventListener('input', performSearch);

    function toggleSearchInput() {
        searchInputsContainer.classList.toggle('active');
        if (!searchInputsContainer.classList.contains('active')) {
            // Limpiar campos y resultados al ocultar la búsqueda
            searchProductInput.value = '';
            searchBrandInput.value = '';
            searchQuantityInput.value = '';
            performSearch(); // Para limpiar los resaltados de búsqueda y ocultar resultados
            searchResultsContainer.style.display = 'none';
            searchResultsList.innerHTML = '';
        }
    }

    // --- Event Listeners generales ---
    gridContainer.addEventListener('click', (event) => {
        const cell = event.target.closest('.grid-cell');
        if (cell && !cell.classList.contains('red-separator') && !cell.classList.contains('rack-level-separator') &&
            !cell.classList.contains('vertical-aisle') && !cell.classList.contains('horizontal-aisle-bottom') &&
            !cell.classList.contains('pasillo-horizontal') && !cell.classList.contains('outer-block-border')) {
            
            if (currentSelectedCell) {
                currentSelectedCell.classList.remove('selected');
            }
            currentSelectedCell = cell;
            currentSelectedCell.classList.add('selected');
            openModal(cell);
        }
    });

    gridContainer.addEventListener('mouseover', (event) => {
        const cell = event.target.closest('.grid-cell');
        if (cell && !cell.classList.contains('red-separator') && !cell.classList.contains('rack-level-separator') &&
            !cell.classList.contains('vertical-aisle') && !cell.classList.contains('horizontal-aisle-bottom') &&
            !cell.classList.contains('pasillo-horizontal') && !cell.classList.contains('outer-block-border')) {
            showTooltip(event, cell);
        }
    });

    gridContainer.addEventListener('mouseout', () => {
        hideTooltip();
    });

    closeModalButton.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal();
        }
    });

    toggleSearchButton.addEventListener('click', toggleSearchInput);

    if (backToMainButton) {
        backToMainButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    if (goToMap3Button) {
        goToMap3Button.addEventListener('click', () => {
            window.location.href = 'index3.html';
        });
    }

    // Carga inicial de posiciones desde Firestore
    await loadPositionsFromFirestore();
});