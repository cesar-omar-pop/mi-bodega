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
    const productDateElaborationInput = document.getElementById('product-date-elaboration-input');
    const productDurationSelect = document.getElementById('product-duration-select'); // Cambiado a select
    const productBatchInput = document.getElementById('product-batch-input');
    const productExpirationDateDisplay = document.getElementById('product-expiration-date-display'); // Nuevo span para la fecha
    const expirationDisplayGroup = document.getElementById('expiration-display-group'); // Nuevo div contenedor

    const addButton = document.getElementById('add-button');
    const editButton = document.getElementById('edit-button');
    const deleteButton = document.getElementById('delete-button');
    const addedProductsList = document.getElementById('added-products-list');

    const toggleSearchButton = document.getElementById('toggle-search-button');
    const searchInputsContainer = document.getElementById('search-inputs-container');
    const searchProductInput = document.getElementById('search-product-input');
    const searchBrandInput = document.getElementById('search-brand-input');
    const searchQuantityInput = document.getElementById('search-quantity-input');
    const searchExpirationStatusSelect = document.getElementById('search-expiration-status-select'); // Nuevo select de búsqueda

    const backToMainButton = document.getElementById('back-to-main-button');
    const goToMap3Button = document.getElementById('go-to-map3-button');

    const customTooltip = document.getElementById('custom-tooltip');
    const toastNotification = document.getElementById('toast-notification');

    // Nuevas referencias para los resultados de búsqueda (si existen)
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
    
    // --- NUEVAS FUNCIONES DE CÁLCULO DE CADUCIDAD ---
    /**
     * Calculates the expiration date based on the elaboration date, duration, and unit.
     * @param {string} elaborationDateStr - The elaboration date in 'YYYY-MM-DD' format.
     * @param {number} duration - The duration value.
     * @param {string} unit - The unit of duration ('days' or 'months').
     * @returns {Date | null} The expiration date object or null if inputs are invalid.
     */
    function calculateExpirationDate(elaborationDateStr, duration, unit) {
        if (!elaborationDateStr || isNaN(duration)) {
            return null;
        }
        const elaborationDate = new Date(elaborationDateStr);
        if (isNaN(elaborationDate.getTime())) {
            return null;
        }

        const expirationDate = new Date(elaborationDate);
        if (unit === 'months') {
            expirationDate.setMonth(expirationDate.getMonth() + duration);
        } else if (unit === 'days') {
            expirationDate.setDate(expirationDate.getDate() + duration);
        } else {
            return null; // Invalid unit
        }

        return expirationDate;
    }

    /**
     * Determines the expiration status of a product.
     * @param {Date} expirationDate - The expiration date object.
     * @returns {string} The expiration status ('expired', 'exp-30', 'near-expired', 'fresco').
     */
    // Simplemente deja esta versión más corta
function getExpirationStatus(expirationDate) {
    if (!expirationDate) return 'fresco'; // Sigue siendo fresco si no hay fecha
    const now = new Date();

    if (expirationDate.getTime() <= now.getTime()) {
        return 'expired'; // Sigue siendo expirado si ya pasó la fecha
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expDate = new Date(expirationDate.getFullYear(), expirationDate.getMonth(), expirationDate.getDate());

    // Calcula la diferencia en meses (aproximadamente)
    const diffInMonths = (expDate.getFullYear() - today.getFullYear()) * 12 + (expDate.getMonth() - today.getMonth());

    if (diffInMonths <= 12 && diffInMonths > 0) {
        return 'duration-1-year'; // Quedan 12 meses o menos para caducar
    } else if (diffInMonths <= 24 && diffInMonths > 12) {
        return 'duration-2-years'; // Quedan entre 13 y 24 meses
    } else if (diffInMonths <= 36 && diffInMonths > 24) {
        return 'duration-3-years'; // Quedan entre 25 y 36 meses
    } else {
        return 'fresco'; // Más de 3 años o no definido
    }
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

    cell.classList.remove('libre', 'ocupado', 'expired-cell', 'found'); // Simplificada
    cell.innerHTML = '';
    cell.textContent = cell.dataset.id;

    if (products && products.length > 0) {
            cell.classList.add('ocupado');
            let hasExpired = false;
            let hasDuration1Year = false;
            let hasDuration2Years = false;
            let hasDuration3Years = false;
            
            // Check the status of each product
            products.forEach(product => {
                const elaborationDate = product.productDateElaboration;
                const duration = parseInt(product.productDuration);
                const unit = product.productDurationUnit;
                const expirationDate = calculateExpirationDate(elaborationDate, duration, unit);
                const status = getExpirationStatus(expirationDate);
                
                // Marca las banderas según el estado
                if (status === 'expired') {
                    hasExpired = true;
                } else if (status === 'duration-1-year') {
                    hasDuration1Year = true;
                } else if (status === 'duration-2-years') {
                    hasDuration2Years = true;
                } else if (status === 'duration-3-years') {
                    hasDuration3Years = true;
                }
            });

            // Aplica la clase del estado más crítico (el más próximo a caducar)
            if (hasExpired) {
                cell.classList.add('expired-cell');
            } else if (hasDuration1Year) {
                cell.classList.add('duration-1-year');
            } else if (hasDuration2Years) {
                cell.classList.add('duration-2-years');
            } else if (hasDuration3Years) {
                cell.classList.add('duration-3-years');
            }
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
                const elaborationDate = product.productDateElaboration;
                const duration = parseInt(product.productDuration);
                const unit = product.productDurationUnit;
                const expirationDate = calculateExpirationDate(elaborationDate, duration, unit);
                const status = getExpirationStatus(expirationDate);
                const formattedExpirationDate = expirationDate ? expirationDate.toLocaleDateString('es-ES') : 'N/A';
           let statusText = '';
                let statusClass = '';
                switch (status) {
                    case 'expired':
                        statusText = 'EXPIRADO';
                        statusClass = 'expired-text';
                        break;
                    case 'duration-1-year':
                        statusText = 'CAD. 1 AÑO';
                        statusClass = 'duration-1-year-text';
                        break;
                    case 'duration-2-years':
                        statusText = 'CAD. 2 AÑOS';
                        statusClass = 'duration-2-years-text';
                        break;
                    case 'duration-3-years':
                        statusText = 'CAD. 3 AÑOS';
                        statusClass = 'duration-3-years-text';
                        break;
                    default:
                        statusText = 'Fresco';
                        statusClass = 'fresco-item';
                        break;
                }
                
                tooltipContent += `<br>${index + 1}. ${product.productName || 'N/A'} (Cant: ${product.productQuantity || 0}) - <span class="${statusClass}">${statusText}</span>`;
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
        expirationDisplayGroup.style.display = 'none'; // Ocultar al abrir el modal

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
        if (searchProductInput.value === '' && searchBrandInput.value === '' && searchQuantityInput.value === '' && searchExpirationStatusSelect.value === '') {
            if (searchResultsContainer) {
                searchResultsContainer.style.display = 'none';
                searchResultsList.innerHTML = '';
            }
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
        productDurationSelect.value = ''; // Cambiado a select
        productBatchInput.value = '';
        productExpirationDateDisplay.textContent = '';
        expirationDisplayGroup.style.display = 'none';

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
        
        // Find the option in the select that matches the stored duration and unit
        const durationOption = product.productDuration && product.productDurationUnit
            ? productDurationSelect.querySelector(`option[value="${product.productDuration}"][data-unit="${product.productDurationUnit}"]`)
            : null;
        if (durationOption) {
            productDurationSelect.value = product.productDuration;
        } else {
            productDurationSelect.value = '';
        }




        
        productBatchInput.value = product.productBatch || '';
        updateExpirationDateDisplay(); // Muestra la fecha de caducidad al editar
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

            const expirationDate = calculateExpirationDate(product.productDateElaboration, parseInt(product.productDuration), product.productDurationUnit);
            const status = getExpirationStatus(expirationDate);
            const formattedExpirationDate = expirationDate ? expirationDate.toLocaleDateString('es-ES') : 'N/A';
            
            let statusText = '';
            let statusClass = '';
            switch (status) {
                case 'expired':
                    statusText = 'EXPIRADO';
                    statusClass = 'expired-item';
                    break;
                case 'duration-1-year':
                    statusText = 'CAD. 1 AÑO';
                    statusClass = 'duration-1-year-text';
                    break;
                case 'duration-2-years':
                    statusText = 'CAD. 2 AÑOS';
                    statusClass = 'duration-2-years-text';
                    break;
                case 'duration-3-years':
                    statusText = 'CAD. 3 AÑOS';
                    statusClass = 'duration-3-years-text';
                    break;
                default:
                    statusText = 'Fresco';
                    statusClass = 'fresco-item';
                    break;
            }

            productItem.innerHTML = `
                <span>
                    <strong>${product.productName || 'N/A'}</strong> (Cant: ${product.productQuantity || 0}, Marca: ${product.productBrand || 'N/A'})
                    <span class="product-expiration-status ${statusClass}">${statusText} (Cad: ${formattedExpirationDate})</span>
                </span>
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
/**
     * Deletes a product from the current position.
     * @param {number} index - The index of the product to delete.
     */
    function deleteExistingProduct(index) {
        if (confirm('¿Estás seguro de que quieres eliminar este producto de la posición?')) {
            if (currentPositionId && positions[currentPositionId] && positions[currentPositionId].products[index]) {
                positions[currentPositionId].products.splice(index, 1);

                if (positions[currentPositionId].products.length === 0) {
                    // Si no quedan productos, elimina el documento de Firestore
                    deleteDoc(doc(db, POSITIONS_COLLECTION_PATH, currentPositionId))
                        .then(() => {
                            delete positions[currentPositionId];
                            showToast('Producto eliminado y posición marcada como libre.', 'success');
                            updateAddedProductsDisplay();
                            clearProductForm();
                            updateGridDisplay(); // Refresca el grid para que la celda se muestre como libre
                        })
                        .catch(e => {
                            console.error('Error al eliminar el documento de Firestore:', e);
                            showToast('Error al eliminar la posición de la base de datos.', 'error');
                        });
                } else {
                    // Si quedan productos, actualiza el documento
                    savePositionToFirestore(currentPositionId, positions[currentPositionId].products)
                        .then(() => {
                            showToast('Producto eliminado de la posición.', 'success');
                            updateAddedProductsDisplay();
                            clearProductForm();
                        })
                        .catch(e => {
                            console.error('Error al actualizar la posición en Firestore:', e);
                            showToast('Error al actualizar los datos en la base de datos.', 'error');
                        });
                }
            } else {
                showToast('No se seleccionó ningún producto para eliminar.', 'warning');
            }
        }
    }
    
    // Este es el event listener para el botón "Eliminar" del formulario principal.
    // DEBE IR DESPUÉS de la definición de la función deleteExistingProduct.
    deleteButton.addEventListener('click', () => {
        // Llama a la función de eliminación con el índice actual del producto
        if (currentProductIndex !== -1) {
            deleteExistingProduct(currentProductIndex);
        } else {
            showToast('No se seleccionó ningún producto para eliminar.', 'warning');
        }
    });

    // Asegúrate de que el código para los botones de la lista de productos (que llamas en updateAddedProductsDisplay)
    // también use esta función, como se muestra a continuación:

    // addedProductsList.querySelectorAll('.delete-product-btn').forEach(button => {
    //     button.addEventListener('click', (event) => {
    //         const index = parseInt(event.target.dataset.index);
    //         deleteExistingProduct(index); // Esta línea es la que debe llamar a la función
    //     });
    // });

    

    function getProductDataFromForm() {
        const productName = productNameInput.value.trim();
        const productBrand = productBrandInput.value.trim();
        const quantity = parseInt(productQuantityInput.value);
        const dateElaboration = productDateElaborationInput.value.trim();
        const duration = productDurationSelect.value;
        const durationUnit = productDurationSelect.options[productDurationSelect.selectedIndex].dataset.unit;
        const batch = productBatchInput.value.trim();

        if (!productName) { showToast('Debe especificar el nombre del producto.', 'warning'); return null; }
        if (!productBrand) { showToast('Debe especificar la marca del producto.', 'warning'); return null; }
        if (isNaN(quantity) || quantity <= 0) { showToast('La cantidad debe ser un número positivo.', 'warning'); return null; }
        if (!dateElaboration) { showToast('Debe especificar la fecha de elaboración del producto.', 'warning'); return null; }
        if (!duration) { showToast('Debe especificar la duración del producto.', 'warning'); return null; }
        if (!batch) { showToast('Debe especificar el lote del producto.', 'warning'); return null; }

        let contentType = productContentTypeSelect.value;
        let contentTypeOther = '';
        if (contentType === 'otro') {
            if (productContentTypeOtherInput && productContentTypeOtherInput.value.trim() === '') {
                showToast('Debe especificar el tipo de contenido "otro".', 'warning'); return null;
            }
            contentTypeOther = productContentTypeOtherInput ? productContentTypeOtherInput.value.trim() : '';
        } else if (contentType === '') { showToast('Debe seleccionar un tipo de contenido.', 'warning'); return null; }

        let presentationType = productPresentationSelect.value;
        let presentationTypeOther = '';
        if (presentationType === 'otro') {
            if (productPresentationOtherInput && productPresentationOtherInput.value.trim() === '') {
                showToast('Debe especificar el tipo de presentación "otro".', 'warning'); return null;
            }
            presentationTypeOther = productPresentationOtherInput ? productPresentationOtherInput.value.trim() : '';
        } else if (presentationType === '') { showToast('Debe seleccionar un tipo de presentación.', 'warning'); return null; }

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
            productDurationUnit: durationUnit,
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

    // Event listener para actualizar la fecha de caducidad al cambiar la fecha de elaboración o la duración
    productDateElaborationInput.addEventListener('change', updateExpirationDateDisplay);
    productDurationSelect.addEventListener('change', updateExpirationDateDisplay);

    function updateExpirationDateDisplay() {
        const elaborationDateStr = productDateElaborationInput.value;
        const duration = parseInt(productDurationSelect.value);
        const unit = productDurationSelect.options[productDurationSelect.selectedIndex].dataset.unit;
        
        if (elaborationDateStr && duration) {
            const expirationDate = calculateExpirationDate(elaborationDateStr, duration, unit);
            if (expirationDate) {
                productExpirationDateDisplay.textContent = expirationDate.toLocaleDateString('es-ES');
                expirationDisplayGroup.style.display = 'block';
            } else {
                productExpirationDateDisplay.textContent = 'Fecha inválida';
                expirationDisplayGroup.style.display = 'block';
            }
        } else {
            productExpirationDateDisplay.textContent = '';
            expirationDisplayGroup.style.display = 'none';
        }
    }


    // --- Funciones de búsqueda MEJORADAS ---
    function performSearch() {
        const searchTermProduct = searchProductInput.value.toLowerCase();
        const searchTermBrand = searchBrandInput.value.toLowerCase();
        const searchTermQuantity = parseInt(searchQuantityInput.value);
        const searchTermExpiration = searchExpirationStatusSelect.value;
        
        let foundPositions = new Set();
        let foundProducts = [];

        // Clear previous found class
        gridContainer.querySelectorAll('.grid-cell.found').forEach(cell => {
            cell.classList.remove('found');
        });
        
        for (const positionId in positions) {
            const positionData = positions[positionId];
            if (positionData.products && positionData.products.length > 0) {
                positionData.products.forEach(product => {
                    const matchesProduct = searchTermProduct === '' || (product.productName && product.productName.toLowerCase().includes(searchTermProduct));
                    const matchesBrand = searchTermBrand === '' || (product.productBrand && product.productBrand.toLowerCase().includes(searchTermBrand));
                    const matchesQuantity = isNaN(searchTermQuantity) || (product.productQuantity && parseInt(product.productQuantity) >= searchTermQuantity);

                    // Expiration status check
                    let matchesExpiration = true;
                    if (searchTermExpiration !== '') {
                        const expirationDate = calculateExpirationDate(product.productDateElaboration, parseInt(product.productDuration), product.productDurationUnit);
                        const status = getExpirationStatus(expirationDate);
                        
                        let targetStatus = '';
                        // Traducimos el valor del select a nuestro estado interno
                        if (searchTermExpiration === 'expired') {
                            targetStatus = 'expired';
                        } else if (searchTermExpiration === '12-months') {
                            targetStatus = 'duration-1-year';
                        } else if (searchTermExpiration === '24-months') {
                            targetStatus = 'duration-2-years';
                        } else if (searchTermExpiration === '36-months') {
                            targetStatus = 'duration-3-years';
                        } else if (searchTermExpiration === 'fresco') {
                             targetStatus = 'fresco';
                        }
                        
                        // Comparamos el estado del producto con el estado objetivo del filtro
                        if (status !== targetStatus) {
                            matchesExpiration = false;
                        }
                    }

                    if (matchesProduct && matchesBrand && matchesQuantity && matchesExpiration) {
                        foundPositions.add(positionId);
                        foundProducts.push({
                            positionId: positionId,
                            product: product
                        });
                    }
                });
            }
        }

        // Highlight cells on the grid
        foundPositions.forEach(id => {
            const cell = gridContainer.querySelector(`[data-id="${id}"]`);
            if (cell) {
                cell.classList.add('found');
            }
        });

        // Display search results list (optional, but good for UX)
        if (searchResultsContainer) {
            searchResultsContainer.style.display = 'block';
            searchResultsList.innerHTML = '';

            if (foundProducts.length > 0) {
                const listTitle = document.createElement('h4');
                listTitle.textContent = `Resultados de la búsqueda: (${foundProducts.length} productos encontrados)`;
                searchResultsList.appendChild(listTitle);

                foundProducts.forEach(item => {
                    const listItem = document.createElement('li');
                    const expirationDate = calculateExpirationDate(item.product.productDateElaboration, parseInt(item.product.productDuration), item.product.productDurationUnit);
                    const status = getExpirationStatus(expirationDate);
                    const formattedExpirationDate = expirationDate ? expirationDate.toLocaleDateString('es-ES') : 'N/A';
                    
                    let statusText = '';
                    let statusClass = '';
                    switch (status) {
                        case 'expired':
                            statusText = 'EXPIRADO';
                            statusClass = 'expired-item';
                            break;
                        case 'duration-1-year':
                            statusText = 'CAD. 1 AÑO';
                            statusClass = 'duration-1-year-text';
                            break;
                        case 'duration-2-years':
                            statusText = 'CAD. 2 AÑOS';
                            statusClass = 'duration-2-years-text';
                            break;
                        case 'duration-3-years':
                            statusText = 'CAD. 3 AÑOS';
                            statusClass = 'duration-3-years-text';
                            break;
                        default:
                            statusText = 'Fresco';
                            statusClass = 'fresco-item';
                            break;
                    }
                    
                    listItem.innerHTML = `
                        <strong>Posición ${item.positionId}:</strong> ${item.product.productName} (${item.product.productBrand}, Cant: ${item.product.productQuantity})
                        - <span class="${statusClass}">${statusText} (Cad: ${formattedExpirationDate})</span>
                    `;
                    searchResultsList.appendChild(listItem);
                });
            } else {
                searchResultsList.innerHTML = '<p>No se encontraron productos que coincidan con los criterios de búsqueda.</p>';
            }
        }
    }

    function toggleSearchInput() {
        searchInputsContainer.classList.toggle('active');
        if (!searchInputsContainer.classList.contains('active')) {
            // Clear inputs when hiding the container
            searchProductInput.value = '';
            searchBrandInput.value = '';
            searchQuantityInput.value = '';
            searchExpirationStatusSelect.value = '';
            // And clear any search highlights
            updateGridDisplay();
            // Clear search results list
            if (searchResultsContainer) {
                searchResultsContainer.style.display = 'none';
                searchResultsList.innerHTML = '';
            }
        }
    }
    
    // Add event listeners for all search inputs
    [searchProductInput, searchBrandInput, searchQuantityInput, searchExpirationStatusSelect].forEach(input => {
        input.addEventListener('input', performSearch);
    });
    
    // --- Event Listeners del mapa y del modal ---
    gridContainer.addEventListener('click', (event) => {
        const cell = event.target.closest('.grid-cell');
        if (cell && !cell.classList.contains('red-separator') && !cell.classList.contains('rack-level-separator') &&
            !cell.classList.contains('vertical-aisle') && !cell.classList.contains('horizontal-aisle-bottom') &&
            !cell.classList.contains('pasillo-horizontal') && !cell.classList.contains('outer-block-border')) {
            openModal(cell);
        }
    });

    gridContainer.addEventListener('mouseover', (event) => {
        const cell = event.target.closest('.grid-cell');
        if (cell && !cell.classList.contains('red-separator') && !cell.classList.contains('rack-level-separator') &&
            !cell.classList.contains('vertical-aisle') && !cell.classList.contains('horizontal-aisle-bottom') &&
            !cell.classList.contains('pasillo-horizontal') && !cell.classList.contains('outer-block-border')) { // También ignorar outer-block-border
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

    // Listener para el botón de ir a Salidas
    const goToSalidasButtonMap2 = document.getElementById('go-to-salidas-button-map2');
    if (goToSalidasButtonMap2) {
        goToSalidasButtonMap2.addEventListener('click', () => {
            window.location.href = 'salidas.html';
        });
    }
    
    // Cargar datos al iniciar
    loadPositionsFromFirestore();
});