// js/salidas.js
import { db } from './firebase-config.js';
import { collection, query, getDocs, doc, updateDoc, writeBatch, getDoc, addDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Inputs y elementos de display para la selección de producto
    const productoInput = document.getElementById('producto-input');
    const productosDatalist = document.getElementById('productos-datalist');
    const marcaDisplay = document.getElementById('marca-display');
    const locationDisplay = document.getElementById('location-display');
    const currentStockDisplay = document.getElementById('current-stock-display');
    const presentacionSelect = document.getElementById('presentacion-select'); // Ahora solo muestra la presentación del producto seleccionado
    const cantidadInput = document.getElementById('cantidad-input');
    
    // Inputs ocultos para almacenar los IDs del producto seleccionado
    const selectedProductIdInput = document.getElementById('selected-product-id');
    const selectedProductBodegaIdInput = document.getElementById('selected-product-bodega-id');
    const selectedProductLocationIdInput = document.getElementById('selected-product-location-id');

    // Botones para añadir/limpiar producto
    const addToCargaBtn = document.getElementById('add-to-carga-btn');
    const clearProductSelectionBtn = document.getElementById('clear-product-selection-btn');

    // Elementos para la tabla de productos en la carga
    const cargaTableBody = document.getElementById('carga-table-body');
    const totalItemsDisplay = document.getElementById('total-items-display');

    // Inputs y botones para registrar la carga completa
    const destinoInput = document.getElementById('destino-input');
    const observacionesTextarea = document.getElementById('observaciones-textarea');
    const registrarCargaBtn = document.getElementById('registrar-carga-btn');
    const viewHistoryBtn = document.getElementById('view-history-btn');
    const backToMainButton = document.getElementById('back-to-main-menu-btn'); // Renombrado para consistencia con HTML

    // Datos globales
    let allAvailableProducts = []; // Contiene todos los productos con sus detalles de ubicación
    let currentSelectedProduct = null; // El producto seleccionado actualmente en los inputs
    let cargaProductos = []; // Los productos que se van acumulando para la carga actual

    const warehouseConfigs = [
        { id: 'mapa1', subCollectionName: 'celdas' },
        { id: 'mapa2', subCollectionName: 'posiciones' },
        { id: 'mapa3', subCollectionName: 'celdas' }
    ];
    const mainCollectionName = 'bodegas';

    // Función para mostrar mensajes (sin cambios)
    function showMessage(message, type = 'info', duration = 3000) {
        const toast = document.getElementById('toast-notification');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast-notification ${type} show`;
            if (duration > 0) {
                setTimeout(() => {
                    toast.className = toast.className.replace('show', '');
                }, duration);
            }
        } else {
            alert(message);
        }
    }

    // Carga todos los productos de todas las bodegas para el autocompletado
    async function loadAllProductsForAutocompletion() {
        console.log('Iniciando carga de todos los productos disponibles...');
        allAvailableProducts = [];
        productosDatalist.innerHTML = ''; // Limpiar datalist

        try {
            for (const config of warehouseConfigs) {
                const warehouseId = config.id;
                const subCollectionName = config.subCollectionName;
                const subCollectionRef = collection(db, mainCollectionName, warehouseId, subCollectionName);
                const querySnapshot = await getDocs(query(subCollectionRef));

                querySnapshot.forEach((doc) => {
                    const cellData = doc.data();
                    const locationDocId = doc.id; // ID del documento de la celda/posición

                    // Manejo para estructuras con array 'products' (Mapa 1 y Mapa 2)
                    if (cellData.products && Array.isArray(cellData.products)) {
                        cellData.products.forEach(prod => {
                            const prodName = prod.productName || prod.name;
                            const prodBrand = prod.productBrand || prod.brand || 'N/A';
                            // Intenta obtener la presentación de varias posibles claves
                            const prodPresentation = prod.productPresentation || prod.presentacion || prod.presentation || 'N/A';
                            let prodQuantity;
                            let originalQuantityFieldName;

                            if (prod.productQuantity !== undefined) {
                                prodQuantity = prod.productQuantity;
                                originalQuantityFieldName = 'productQuantity';
                            } else if (prod.quantity !== undefined) {
                                prodQuantity = prod.quantity;
                                originalQuantityFieldName = 'quantity';
                            } else {
                                return; 
                            }

                            if (prodName && prodQuantity > 0) {
                                const displayLabel = `${prodName} - ${prodBrand} - ${prodPresentation} [${warehouseId}/${locationDocId}]`;
                                const productEntry = {
                                    displayLabel: displayLabel,
                                    productId: prod.productId || null,
                                    name: prodName,
                                    brand: prodBrand,
                                    presentation: prodPresentation,
                                    quantity: prodQuantity,
                                    bodegaId: warehouseId,
                                    locationId: locationDocId,
                                    originalQuantityFieldName: originalQuantityFieldName,
                                    isProductArray: true // Indicar que es parte de un array de productos
                                };
                                allAvailableProducts.push(productEntry);
                                const option = document.createElement('option');
                                option.value = displayLabel;
                                productosDatalist.appendChild(option);
                                // DEBUG: Muestra el producto cargado para inspeccionar su estructura
                                // console.log('Producto cargado (Array):', productEntry); 
                            }
                        });
                    } 
                    // Manejo para estructuras con campos directos (Mapa 3 y otros)
                    else {
                        const pName = cellData.productName || cellData.name;
                        const pBrand = cellData.productBrand || cellData.brand || 'N/A';
                        // Intenta obtener la presentación de varias posibles claves
                        const pPresentation = cellData.productPresentation || cellData.presentacion || cellData.presentation || 'N/A';
                        let pQuantity;
                        let originalQuantityFieldName;

                        if (cellData.productQuantity !== undefined) {
                            pQuantity = cellData.productQuantity;
                            originalQuantityFieldName = 'productQuantity';
                        } else if (cellData.quantity !== undefined) {
                            pQuantity = cellData.quantity;
                            originalQuantityFieldName = 'quantity';
                        } else {
                            return; 
                        }

                        if (pName && pQuantity > 0) {
                            const displayLabel = `${pName} - ${pBrand} - ${pPresentation} [${warehouseId}/${locationDocId}]`;
                            const productEntry = {
                                displayLabel: displayLabel,
                                productId: cellData.productId || null,
                                name: pName,
                                brand: pBrand,
                                presentation: pPresentation,
                                quantity: pQuantity,
                                bodegaId: warehouseId,
                                locationId: locationDocId,
                                originalQuantityFieldName: originalQuantityFieldName,
                                isProductArray: false // Indicar que es un producto directo del documento
                            };
                            allAvailableProducts.push(productEntry);
                            const option = document.createElement('option');
                            option.value = displayLabel;
                            productosDatalist.appendChild(option);
                            // DEBUG: Muestra el producto cargado para inspeccionar su estructura
                            // console.log('Producto cargado (Directo):', productEntry);
                        }
                    }
                });
            }
            console.log('Productos disponibles cargados:', allAvailableProducts.length);
            // Si hay productos, habilitar el input de producto
            if (allAvailableProducts.length > 0) {
                productoInput.disabled = false;
            } else {
                showMessage('No se encontraron productos en el inventario.', 'warning', 5000);
            }

        } catch (error) {
            console.error('Error al cargar productos para autocompletado:', error);
            showMessage('Error al cargar los productos para la búsqueda. Revisa la consola.', 'error');
        }
    }

    // Limpia los campos de selección de un solo producto
    function clearProductSelectionFields() {
        productoInput.value = '';
        marcaDisplay.value = '';
        locationDisplay.value = '';
        currentStockDisplay.value = '';
        presentacionSelect.innerHTML = '<option value="">Selecciona una presentación</option>'; // Limpiar opciones
        presentacionSelect.disabled = true;
        cantidadInput.value = '1';
        cantidadInput.disabled = true;
        addToCargaBtn.disabled = true;
        currentSelectedProduct = null; // Resetear el producto seleccionado
        selectedProductIdInput.value = '';
        selectedProductBodegaIdInput.value = '';
        selectedProductLocationIdInput.value = '';
    }

    // Renderiza la tabla de productos en la carga actual
    function renderCargaTable() {
        cargaTableBody.innerHTML = ''; // Limpiar tabla
        if (cargaProductos.length === 0) {
            cargaTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #6c757d;">No hay productos en la carga.</td></tr>';
            registrarCargaBtn.disabled = true; // Deshabilitar si no hay productos
        } else {
            cargaProductos.forEach((item, index) => {
                const row = cargaTableBody.insertRow();
                row.innerHTML = `
                    <td>${item.name}</td>
                    <td>${item.brand}</td>
                    <td>${item.presentation}</td>
                    <td>${item.quantity}</td>
                    <td>${item.bodegaId}/${item.locationId}</td>
                    <td><button type="button" class="delete-item-btn" data-index="${index}">Eliminar</button></td>
                `;
            });
            // Añadir event listeners a los botones de eliminar después de renderizar
            document.querySelectorAll('.delete-item-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const indexToDelete = parseInt(event.target.dataset.index);
                    deleteItemFromCarga(indexToDelete);
                });
            });
            registrarCargaBtn.disabled = false; // Habilitar si hay productos
        }
        totalItemsDisplay.textContent = `Total de ítems en carga: ${cargaProductos.length}`;
        // Habilitar/deshabilitar el botón de registrar carga
        if (cargaProductos.length === 0 || destinoInput.value.trim() === '') {
            registrarCargaBtn.disabled = true;
        } else {
            registrarCargaBtn.disabled = false;
        }
    }

    // Elimina un producto de la carga temporal
    function deleteItemFromCarga(index) {
        if (confirm('¿Estás seguro de que quieres eliminar este producto de la carga?')) {
            cargaProductos.splice(index, 1); // Eliminar del array
            renderCargaTable(); // Volver a renderizar la tabla
            showMessage('Producto eliminado de la carga.', 'info');
        }
    }

    // Añade el producto seleccionado a la carga temporal
    function addProductoToCarga() {
        if (!currentSelectedProduct) {
            showMessage('Por favor, selecciona un producto válido de la lista.', 'error');
            return;
        }

        const cantidad = parseInt(cantidadInput.value);

        if (isNaN(cantidad) || cantidad <= 0) {
            showMessage('Por favor, ingresa una cantidad válida mayor a cero.', 'error');
            return;
        }

        if (cantidad > currentSelectedProduct.quantity) {
            showMessage(`No hay suficiente stock. Cantidad disponible: ${currentSelectedProduct.quantity}`, 'error');
            return;
        }

        // Verificar si el producto ya está en la carga con la misma presentación y ubicación
        const existingItemIndex = cargaProductos.findIndex(item =>
            item.productId === currentSelectedProduct.productId &&
            item.presentation === currentSelectedProduct.presentation &&
            item.bodegaId === currentSelectedProduct.bodegaId &&
            item.locationId === currentSelectedProduct.locationId
        );

        if (existingItemIndex > -1) {
            // Si ya existe, preguntar si desea sumar la cantidad
            if (confirm(`Este producto (${currentSelectedProduct.name} - ${currentSelectedProduct.presentation} en ${currentSelectedProduct.bodegaId}/${currentSelectedProduct.locationId}) ya está en la carga. ¿Deseas sumar ${cantidad} a la cantidad existente?`)) {
                cargaProductos[existingItemIndex].quantity += cantidad;
                showMessage(`Cantidad de ${currentSelectedProduct.name} actualizada en la carga.`, 'success');
            } else {
                return; // No añadir si el usuario cancela
            }
        } else {
            // Añadir el producto completo al array de carga
            const productToAdd = { ...currentSelectedProduct, quantity: cantidad }; // Clonar y actualizar cantidad
            cargaProductos.push(productToAdd);
            showMessage('Producto añadido a la carga temporalmente.', 'success');
        }
        
        // Actualizar UI
        renderCargaTable();
        clearProductSelectionFields();
    }

// Registra la carga completa de productos
async function registrarCargaCompleta() {
    if (cargaProductos.length === 0) {
        showMessage('No hay productos en la carga para registrar.', 'error');
        return;
    }

    const destino = destinoInput.value.trim();
    if (!destino) {
        showMessage('Por favor, ingresa el destino de la carga.', 'error');
        return;
    }

    registrarCargaBtn.disabled = true; // Deshabilitar el botón durante el proceso

    const batch = writeBatch(db);
    const fechaSalida = new Date();
    const historialDocRef = collection(db, 'historial_salidas');

    try {
        // 1. Actualizar el stock de cada producto en su respectiva celda/posición
        for (const item of cargaProductos) {
            const warehouseConfig = warehouseConfigs.find(wc => wc.id === item.bodegaId);
            if (!warehouseConfig) {
                throw new Error(`Configuración de bodega no encontrada para ID: ${item.bodegaId}`);
            }
            const cellRef = doc(db, mainCollectionName, item.bodegaId, warehouseConfig.subCollectionName, item.locationId);
            const cellSnap = await getDoc(cellRef);

            if (!cellSnap.exists()) {
                throw new Error(`Ubicación no encontrada: ${item.bodegaId}/${item.locationId}`);
            }

            const cellData = cellSnap.data();

            if (item.isProductArray) {
                // --- CASO ARRAY ---
                let foundProductInCell = false;
                let updatedProducts = cellData.products.map(prod => {
                    const currentProdId = prod.productId || prod.id;
                    const currentProdName = prod.productName || prod.name;
                    const currentProdBrand = prod.productBrand || prod.brand;
                    const currentProdPresentation = prod.productPresentation || prod.presentacion || prod.presentation;

                    if (
                        (item.productId && currentProdId === item.productId) ||
                        (currentProdName === item.name &&
                         currentProdBrand === item.brand &&
                         currentProdPresentation === item.presentation)
                    ) {
                        foundProductInCell = true;
                        prod[item.originalQuantityFieldName] =
                            (prod[item.originalQuantityFieldName] || 0) - item.quantity;

                        if (prod[item.originalQuantityFieldName] <= 0) {
                            return null; // marcar para eliminar
                        }
                    }
                    return prod;
                });

                if (!foundProductInCell) {
                    throw new Error(`Producto ${item.name} no encontrado en la ubicación esperada: ${item.bodegaId}/${item.locationId}`);
                }

                // Filtrar los eliminados (null)
                updatedProducts = updatedProducts.filter(p => p !== null);

                batch.update(cellRef, { products: updatedProducts });

            } else {
                // --- CASO CAMPOS DIRECTOS ---
                const newQuantity = (cellData[item.originalQuantityFieldName] || 0) - item.quantity;
                if (newQuantity < 0) {
                    throw new Error(`Stock insuficiente para ${item.name} en ${item.bodegaId}/${item.locationId}`);
                }

                if (newQuantity <= 0) {
                    // limpiar la celda cuando llega a 0
                    batch.update(cellRef, {
                        productName: "",
                        productBrand: "",
                        productPresentation: "",
                        lote: "",
                        caducidad: "",
                        [item.originalQuantityFieldName]: 0,
                        status: "libre"
                    });
                } else {
                    batch.update(cellRef, { [item.originalQuantityFieldName]: newQuantity });
                }
            }
        }

        // 2. Registrar la salida en historial_salidas
        const salidaData = {
            fecha: fechaSalida,
            destino: destino,
            observaciones: observacionesTextarea.value.trim(),
            productos: cargaProductos.map(item => ({
                productId: item.productId,
                name: item.name,
                brand: item.brand,
                presentation: item.presentation,
                quantity: item.quantity,
                bodegaId: item.bodegaId,
                locationId: item.locationId
            }))
        };
        await addDoc(historialDocRef, salidaData);

        // 3. Ejecutar batch
        await batch.commit();

        showMessage('¡Carga registrada y stock actualizado con éxito!', 'success', 5000);

        // Reset de interfaz
        clearProductSelectionFields();
        cargaProductos = [];
        renderCargaTable();
        destinoInput.value = '';
        observacionesTextarea.value = '';
        await loadAllProductsForAutocompletion();

    } catch (error) {
        console.error('Error al registrar la carga o actualizar stock:', error);
        showMessage(`Error al registrar la carga: ${error.message}. Revisa la consola.`, 'error', 7000);
    } finally {
        registrarCargaBtn.disabled = false;
        renderCargaTable();
    }
}

    // --- Event Listeners ---

    // Cuando el usuario escribe o selecciona un producto del datalist
    productoInput.addEventListener('input', () => {
        const selectedLabel = productoInput.value;
        currentSelectedProduct = allAvailableProducts.find(p => p.displayLabel === selectedLabel);

        if (currentSelectedProduct) {
            // Llenar campos de display e inputs ocultos
            selectedProductIdInput.value = currentSelectedProduct.productId || '';
            selectedProductBodegaIdInput.value = currentSelectedProduct.bodegaId;
            selectedProductLocationIdInput.value = currentSelectedProduct.locationId;

            marcaDisplay.value = currentSelectedProduct.brand;
            locationDisplay.value = `${currentSelectedProduct.bodegaId}/${currentSelectedProduct.locationId}`;
            currentStockDisplay.value = currentSelectedProduct.quantity;
            
            // Habilitar y setear la presentación del producto seleccionado
            presentacionSelect.innerHTML = `<option value="${currentSelectedProduct.presentation}">${currentSelectedProduct.presentation}</option>`;
            presentacionSelect.disabled = false;
            presentacionSelect.value = currentSelectedProduct.presentation;


            cantidadInput.disabled = false;
            cantidadInput.max = currentSelectedProduct.quantity;
            cantidadInput.value = '1'; // Default a 1
            addToCargaBtn.disabled = false;
        } else {
            // Limpiar si la selección no es válida
            clearProductSelectionFields();
        }
    });

    // Validar cantidad al cambiar el input
    cantidadInput.addEventListener('input', () => {
        const cantidad = parseInt(cantidadInput.value);
        if (currentSelectedProduct) {
            if (isNaN(cantidad) || cantidad <= 0) {
                showMessage('La cantidad debe ser un número positivo.', 'warning', 2000);
                addToCargaBtn.disabled = true;
            } else if (cantidad > currentSelectedProduct.quantity) {
                showMessage(`La cantidad excede el stock disponible (${currentSelectedProduct.quantity}).`, 'warning', 3000);
                addToCargaBtn.disabled = true;
            } else {
                addToCargaBtn.disabled = false;
            }
        } else {
            addToCargaBtn.disabled = true;
        }
    });

    // Habilitar/deshabilitar el botón de registrar carga al cambiar el destino
    destinoInput.addEventListener('input', () => {
        if (destinoInput.value.trim() === '' || cargaProductos.length === 0) {
            registrarCargaBtn.disabled = true;
        } else {
            registrarCargaBtn.disabled = false;
        }
    });

    addToCargaBtn.addEventListener('click', addProductoToCarga);
    clearProductSelectionBtn.addEventListener('click', clearProductSelectionFields);
    registrarCargaBtn.addEventListener('click', registrarCargaCompleta);

    // Navegación
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', () => {
            window.location.href = 'historial_salidas.html';
        });
    }

    if (backToMainButton) {
        backToMainButton.addEventListener('click', () => {
            window.location.href = 'index.html'; // Ajusta esto si tu menú principal es otra página
        });
    }

    // Inicialización al cargar la página
    await loadAllProductsForAutocompletion();
    renderCargaTable(); // Asegurarse de que la tabla y el estado del botón se rendericen al inicio
});