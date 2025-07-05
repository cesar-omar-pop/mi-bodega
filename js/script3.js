// script3.js - Lógica JavaScript para el Mapa 3, con Drag & Drop y Persistencia (Firestore)

import { db } from './firebase-config.js'; // Importa la instancia de Firestore
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js'; // Importa funciones de Firestore

document.addEventListener('DOMContentLoaded', async () => { // Agrega 'async' aquí

    // Referencias a todos los contenedores donde se pueden arrastrar elementos
    const dragContainers = document.querySelectorAll('.map3-overall-container, .horizontal-half-block');
    const productContainers = document.querySelectorAll('.product-container-map3'); // Todos los productos arrastrables

    const modal = document.getElementById('modal');
    const closeModalButton = document.querySelector('.close-button');
    const modalProductNameDisplay = document.getElementById('modal-product-name-display');
    const modalCurrentProductIdInput = document.getElementById('modal-current-product-id');
    const modalProductBrandSelect = document.getElementById('modal-product-brand-select');
    const modalProductQuantityInput = document.getElementById('modal-product-quantity-input');
    const modalSaveButton = document.getElementById('modal-save-button');
    const modalClearButton = document.getElementById('modal-clear-button');

    const toastNotification = document.getElementById('toast-notification'); // New: Toast element
    // Referencias a botones de navegación (NEW)
    const backToMainButton = document.getElementById('back-to-main-button');
    const backToMap2Button = document.getElementById('back-to-map2-button');

    // Almacenamiento en memoria para los datos de los productos
    // Estos datos se sincronizarán con Firestore
    let productDataStore = {};

    // --- Referencia a la colección de Firestore para el Mapa 3 ---
    // La estructura será: bodegas -> mapa3 -> celdas -> {productId}
    const map3CollectionRef = collection(db, 'bodegas', 'mapa3', 'celdas');
    const map3OrderDocRef = doc(db, 'bodegas', 'mapa3'); // Documento para el orden del mapa

    // --- Toast Notification Function ---
    function showToast(message, type = 'success', duration = 3000) {
        toastNotification.textContent = message;
        toastNotification.className = 'toast-notification show ' + type; // Add type class (success, error)

        setTimeout(() => {
            toastNotification.classList.remove('show');
            // Optional: clear text after transition for accessibility
            setTimeout(() => {
                toastNotification.textContent = '';
                toastNotification.className = 'toast-notification'; // Reset classes
            }, 500); // Wait for transition to finish
        }, duration);
    }

    // Función para guardar los datos de un producto específico en Firestore
    async function saveProductData(productId, data) {
        try {
            await setDoc(doc(map3CollectionRef, productId), data, { merge: true }); // 'merge: true' para no sobrescribir todo el documento
            productDataStore[productId] = data; // Actualiza el store local
            showToast(`Producto ${productId} guardado en la nube.`, 'success', 1500);
        } catch (e) {
            console.error("Error al guardar el documento en Firestore: ", e);
            showToast('Error al guardar el producto.', 'error');
        }
    }

    // Función para eliminar un producto de Firestore
    async function deleteProductData(productId) {
        try {
            await deleteDoc(doc(map3CollectionRef, productId));
            delete productDataStore[productId]; // Elimina del store local
            showToast(`Producto ${productId} eliminado de la nube.`, 'success', 1500);
        } catch (e) {
            console.error("Error al eliminar el documento de Firestore: ", e);
            showToast('Error al eliminar el producto.', 'error');
        }
    }


    // Función para guardar el orden actual de los productos en Firestore
    async function saveProductOrder() {
        const currentOrder = {};
        dragContainers.forEach(container => {
            // Asegurarse de que todos los contenedores tengan un ID
            let containerId = container.id;
            if (!containerId) {
                if (container.classList.contains('map3-overall-container')) {
                    container.id = 'map3-overall-container'; // Asigna un ID por defecto si no está presente
                } else if (container.classList.contains('horizontal-half-block')) {
                    // Genera IDs únicos si no se asignaron manualmente en HTML
                    const siblings = Array.from(container.parentNode.children).filter(el => el.classList.contains('horizontal-half-block'));
                    const index = siblings.indexOf(container);
                    container.id = `horizontal-half-block-${index}`;
                }
                containerId = container.id; // Re-asigna después de asegurar el ID
            }
            
            if (containerId) {
                currentOrder[containerId] = Array.from(container.children)
                                                .filter(child => child.classList.contains('product-container-map3'))
                                                .map(child => child.dataset.productId);
            }
        });

        try {
            // Guardar el orden en un documento específico para el mapa 3
            await setDoc(map3OrderDocRef, { order: currentOrder }, { merge: true });
            console.log("Orden de productos guardado en Firestore:", currentOrder);
            showToast('Orden del mapa guardado en la nube.', 'success', 2000);
        } catch (e) {
            console.error("Error al guardar el orden del mapa en Firestore: ", e);
            showToast('Error al guardar el orden del mapa.', 'error');
        }
    }

    // --- Funciones de Modal ---
    function openModal(productId, productName) {
        const data = productDataStore[productId] || { brand: '', quantity: 0 };
        modalProductNameDisplay.textContent = productName;
        modalCurrentProductIdInput.value = productId;
        modalProductBrandSelect.value = data.brand;
        modalProductQuantityInput.value = data.quantity;
        modal.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
        modalProductNameDisplay.textContent = '';
        modalCurrentProductIdInput.value = '';
        modalProductBrandSelect.value = '';
        modalProductQuantityInput.value = 0;
    }

    async function saveProductChanges() { // Agrega 'async'
        const productId = modalCurrentProductIdInput.value;
        const brand = modalProductBrandSelect.value;
        const quantity = parseInt(modalProductQuantityInput.value, 10);

        if (!productId) {
            showToast('Error: No se pudo identificar el producto.', 'error');
            return;
        }
        if (brand === "") {
            showToast('Por favor, seleccione una marca.', 'error');
            return;
        }
        if (isNaN(quantity) || quantity < 0) {
            showToast('Por favor, ingrese una cantidad válida (número mayor o igual a 0).', 'error');
            return;
        }

        const productData = { brand, quantity };
        await saveProductData(productId, productData); // Guarda en Firestore
        console.log(`Datos guardados para ${productId}:`, productData);

        updateProductContainerUI(productId, quantity);

        closeModal();
    }

    async function clearModalFields() { // Agrega 'async'
        const productId = modalCurrentProductIdInput.value;
        if (productId && productDataStore[productId]) {
            // Si la cantidad es 0, puedes considerar eliminar el documento o simplemente establecer la cantidad a 0
            await saveProductData(productId, { brand: '', quantity: 0 }); // Limpia y guarda en Firestore
            updateProductContainerUI(productId, 0);
        }
        modalProductBrandSelect.value = '';
        modalProductQuantityInput.value = 0;
        showToast('Campos limpiados.', 'success');
    }

    // --- Función para actualizar la UI del contenedor del producto ---
    function updateProductContainerUI(productId, quantity) {
        const container = document.querySelector(`.product-container-map3[data-product-id="${productId}"]`);
        if (container) {
            const quantityDisplay = container.querySelector('.product-quantity-display');
            if (quantity > 0) {
                quantityDisplay.textContent = quantity;
                quantityDisplay.style.display = 'flex';
            } else {
                quantityDisplay.style.display = 'none';
                quantityDisplay.textContent = '';
            }
        }
    }

    // --- Carga inicial y reordenamiento de la UI desde Firestore ---
    async function loadAndArrangeProducts() { // Agrega 'async'
        // Cargar datos de productos
        try {
            const querySnapshot = await getDocs(map3CollectionRef);
            productDataStore = {}; // Limpia el store local
            querySnapshot.forEach((doc) => {
                productDataStore[doc.id] = doc.data();
            });
            console.log("Datos de productos cargados de Firestore:", productDataStore);
        } catch (e) {
            console.error("Error al cargar datos de productos de Firestore: ", e);
            showToast('Error al cargar datos de productos.', 'error');
        }

        // Cargar orden de los productos
        let savedOrder = null;
        try {
            const docSnap = await getDoc(map3OrderDocRef);
            if (docSnap.exists()) {
                savedOrder = docSnap.data().order;
                console.log("Orden de productos cargado de Firestore:", savedOrder);
            } else {
                console.log("No hay orden de mapa guardado en Firestore, usando orden por defecto del HTML.");
            }
        } catch (e) {
            console.error("Error al cargar el orden del mapa de Firestore: ", e);
            showToast('Error al cargar el orden del mapa.', 'error');
        }

        if (savedOrder) {
            const existingProductsMap = new Map();
            productContainers.forEach(container => {
                existingProductsMap.set(container.dataset.productId, container);
            });

            for (const containerId in savedOrder) {
                const targetContainer = document.getElementById(containerId);

                if (targetContainer) {
                    while (targetContainer.firstChild) {
                        targetContainer.removeChild(targetContainer.firstChild);
                    }

                    savedOrder[containerId].forEach(productId => {
                        const productElement = existingProductsMap.get(productId);
                        if (productElement) {
                            targetContainer.appendChild(productElement);
                            existingProductsMap.delete(productId);
                        }
                    });
                }
            }
            existingProductsMap.forEach(productElement => {
                const originalParentContainer = productElement.closest('.map3-overall-container, .horizontal-half-block');
                if (originalParentContainer) {
                    originalParentContainer.appendChild(productElement);
                }
            });
        }

        // Después de reordenar, inicializar cantidades en la UI
        for (const productId in productDataStore) {
            updateProductContainerUI(productId, productDataStore[productId].quantity);
        }
    }

    // --- Drag and Drop Logic ---
    let draggedItem = null;

    // Event listeners para cada producto arrastrable
    productContainers.forEach(container => {
        container.addEventListener('dragstart', (e) => {
            draggedItem = container;
            setTimeout(() => {
                container.classList.add('dragging');
            }, 0);
            e.dataTransfer.setData('text/plain', container.dataset.productId);
        });

        container.addEventListener('dragend', async () => { // Agrega 'async'
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            dragContainers.forEach(c => c.classList.remove('drag-over'));
            await saveProductOrder(); // Guarda el nuevo orden en Firestore después de soltar
        });

        container.addEventListener('click', (e) => {
            if (!e.isTrusted || (e.detail === 0 && e.clientX === 0 && e.clientY === 0)) {
                return;
            }
            const productId = container.dataset.productId;
            const productName = container.querySelector('.product-name-map3').textContent;
            openModal(productId, productName);
        });
    });

    // Eventos para todos los contenedores de drag-and-drop (zonas de soltar)
    dragContainers.forEach(container => {
        // Asegurarse de que todos los drag containers tengan un ID para una persistencia robusta
        if (!container.id) {
            if (container.classList.contains('map3-overall-container')) {
                container.id = 'map3-overall-container'; // Asigna un ID por defecto si no está presente
            } else if (container.classList.contains('horizontal-half-block')) {
                // Si no agregaste IDs manuales en HTML, genera unos únicos aquí
                const siblings = Array.from(container.parentNode.children).filter(el => el.classList.contains('horizontal-half-block'));
                const index = siblings.indexOf(container);
                container.id = `horizontal-half-block-${index}`;
            }
        }

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (draggedItem && draggedItem.parentNode !== container) {
                container.classList.add('drag-over');
            }

            const isHorizontalContainer = container.classList.contains('map3-overall-container') || container.classList.contains('horizontal-half-block');
            const afterElement = getDragAfterElement(container, e.clientX, e.clientY, !isHorizontalContainer);

            if (draggedItem && draggedItem !== afterElement) {
                if (afterElement == null) {
                    container.appendChild(draggedItem);
                } else {
                    container.insertBefore(draggedItem, afterElement);
                }
            }
        });

        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            if (draggedItem == null) return;
            // El orden se guarda en dragend, por lo que no es necesario guardar aquí también.
        });
    });

    // Función auxiliar para determinar dónde insertar el elemento arrastrado
    function getDragAfterElement(container, x, y, isVertical) {
        const draggableElements = [...container.querySelectorAll('.product-container-map3:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            let offset;

            if (isVertical) {
                offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            } else {
                offset = x - box.left - box.width / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }
        }, { offset: -Infinity }).element;
    }


    // --- Event Listeners para Modal (sin cambios) ---
    closeModalButton.addEventListener('click', closeModal);
    modalSaveButton.addEventListener('click', saveProductChanges);
    modalClearButton.addEventListener('click', clearModalFields);

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
    // Listener para el botón de regreso al mapa principal (index.html)
    if (backToMainButton) {
        backToMainButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // Listener para el botón de regreso al Mapa 2 (index2.html)
    if (backToMap2Button) {
        backToMap2Button.addEventListener('click', () => {
            window.location.href = 'index2.html';
        });
    }

    // Listener para el botón de ir a Salidas
    const goToSalidasButtonMap3 = document.getElementById('go-to-salidas-button-map3');
    if (goToSalidasButtonMap3) {
        goToSalidasButtonMap3.addEventListener('click', () => {
            window.location.href = 'salidas.html';
        });
    }
    // Cargar y organizar los productos al inicio
    await loadAndArrangeProducts(); // Llama a la función asíncrona
});