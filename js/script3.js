// script3.js - Mapa 3 con Drag & Drop y registro de movimientos

import { db } from './firebase-config.js'; 
import { collection, doc, getDoc, setDoc, deleteDoc, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { logMovement } from './movementsHandler.js'; 

document.addEventListener('DOMContentLoaded', async () => {

    const dragContainers = document.querySelectorAll('.map3-overall-container, .horizontal-half-block');
    const productContainers = document.querySelectorAll('.product-container-map3');

    const modal = document.getElementById('modal');
    const closeModalButton = document.querySelector('.close-button');
    const modalProductNameDisplay = document.getElementById('modal-product-name-display');
    const modalCurrentProductIdInput = document.getElementById('modal-current-product-id');
    const modalProductBrandSelect = document.getElementById('modal-product-brand-select');
    const modalProductQuantityInput = document.getElementById('modal-product-quantity-input');
    const modalSaveButton = document.getElementById('modal-save-button');
    const modalClearButton = document.getElementById('modal-clear-button');

    const toastNotification = document.getElementById('toast-notification'); 
    const backToMainButton = document.getElementById('back-to-main-button');
    const backToMap2Button = document.getElementById('back-to-map2-button');

    let productDataStore = {};
    const map3CollectionRef = collection(db, 'bodegas', 'mapa3', 'celdas');
    const map3OrderDocRef = doc(db, 'bodegas', 'mapa3', 'celdas', 'order'); // <-- Referencia al documento 'order'

    // --- Toast Notification ---
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

    // --- Guardar producto en su propio documento ---
    async function saveProductData(productId, data) {
        try {
            // Se guarda cada producto en su propio documento en la colección 'celdas'
            await setDoc(doc(map3CollectionRef, productId), data, { merge: true });
            productDataStore[productId] = data;
            showToast(`Producto ${productId} guardado en la nube.`, 'success', 1500);
        } catch (e) {
            console.error("Error al guardar el documento en Firestore: ", e);
            showToast('Error al guardar el producto.', 'error');
        }
    }

    // --- Eliminar producto (documento completo) ---
    async function deleteProductData(productId) {
        try {
            // Se elimina el documento completo del producto
            await deleteDoc(doc(map3CollectionRef, productId));
            delete productDataStore[productId];
            showToast(`Producto ${productId} eliminado de la nube.`, 'success', 1500);
        } catch (e) {
            console.error("Error al eliminar el documento de Firestore: ", e);
            showToast('Error al eliminar el producto.', 'error');
        }
    }

    // --- Guardar orden ---
    async function saveProductOrder() {
        const currentOrder = {};
        dragContainers.forEach(container => {
            const containerId = container.id || (container.id = container.classList.contains('map3-overall-container') ? 'map3-overall-container' : `horizontal-half-block-${Array.from(container.parentNode.children).indexOf(container)}`);
            currentOrder[containerId] = Array.from(container.children)
                .filter(child => child.classList.contains('product-container-map3'))
                .map(child => child.dataset.productId);
        });

        try {
            await setDoc(map3OrderDocRef, { order: currentOrder }, { merge: true });
            console.log("Orden de productos guardado en Firestore:", currentOrder);
            showToast('Orden del mapa guardado en la nube.', 'success', 2000);
        } catch (e) {
            console.error("Error al guardar el orden del mapa en Firestore: ", e);
            showToast('Error al guardar el orden del mapa.', 'error');
        }
    }

    // --- Modal ---
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

    async function saveProductChanges() {
        const productId = modalCurrentProductIdInput.value;
        const brand = modalProductBrandSelect.value;
        const quantity = parseInt(modalProductQuantityInput.value, 10);

        if (!productId || brand === "" || isNaN(quantity) || quantity < 0) {
            showToast('Campos inválidos.', 'error');
            return;
        }

        const productData = { brand, quantity };
        await saveProductData(productId, productData);
        updateProductContainerUI(productId, quantity);

        await logMovement({
            userEmail: 'usuario@example.com', 
            action: 'Editar producto',
            mapId: 'mapa3',
            positionId: document.querySelector(`.product-container-map3[data-product-id="${productId}"]`)?.parentNode.id,
            productId,
            productName: modalProductNameDisplay.textContent,
            productBrand: brand,
            quantity,
            details: 'Edición desde modal'
        });

        closeModal();
    }

    async function clearModalFields() {
        const productId = modalCurrentProductIdInput.value;
        if (productId && productDataStore[productId]) {
            await saveProductData(productId, { brand: '', quantity: 0 });
            updateProductContainerUI(productId, 0);

            await logMovement({
                userEmail: 'usuario@example.com',
                action: 'Eliminar producto',
                mapId: 'mapa3',
                positionId: document.querySelector(`.product-container-map3[data-product-id="${productId}"]`)?.parentNode.id,
                productId,
                productName: modalProductNameDisplay.textContent,
                details: 'Cantidad puesta a 0 desde modal'
            });
        }
        modalProductBrandSelect.value = '';
        modalProductQuantityInput.value = 0;
        showToast('Campos limpiados.', 'success');
    }

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

    async function loadAndArrangeProducts() {
        try {
            // Carga todos los productos de la colección 'celdas'
            const querySnapshot = await getDocs(map3CollectionRef);
            productDataStore = {};
            querySnapshot.forEach(doc => productDataStore[doc.id] = doc.data());
        } catch (e) {
            console.error("Error al cargar productos:", e);
            showToast('Error al cargar productos.', 'error');
        }

        let savedOrder = null;
        try {
            // Carga el documento de la orden
            const docSnap = await getDoc(map3OrderDocRef);
            if (docSnap.exists()) savedOrder = docSnap.data().order;
        } catch (e) {
            console.error("Error al cargar orden:", e);
        }

        if (savedOrder) {
            const existingProductsMap = new Map();
            productContainers.forEach(container => existingProductsMap.set(container.dataset.productId, container));

            for (const containerId in savedOrder) {
                const targetContainer = document.getElementById(containerId);
                if (targetContainer) {
                    while (targetContainer.firstChild) targetContainer.removeChild(targetContainer.firstChild);
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
                const originalParent = productElement.closest('.map3-overall-container, .horizontal-half-block');
                if (originalParent) originalParent.appendChild(productElement);
            });
        }

        for (const productId in productDataStore) {
            updateProductContainerUI(productId, productDataStore[productId].quantity);
        }
    }

    // --- Drag & Drop ---
    let draggedItem = null;

    productContainers.forEach(container => {
        container.addEventListener('dragstart', e => {
            draggedItem = container;
            setTimeout(() => container.classList.add('dragging'), 0);
            e.dataTransfer.setData('text/plain', container.dataset.productId);
        });

        container.addEventListener('dragend', async () => {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            dragContainers.forEach(c => c.classList.remove('drag-over'));
            await saveProductOrder();

            const movedProductId = container.dataset.productId;
            const newParentId = container.parentNode.id;
            if (movedProductId) {
                await logMovement({
                    userEmail: 'usuario@example.com',
                    action: 'Mover producto',
                    mapId: 'mapa3',
                    positionId: newParentId,
                    productId: movedProductId,
                    productName: container.querySelector('.product-name-map3')?.textContent,
                    details: `Movido al contenedor ${newParentId}`
                });
            }
        });

        container.addEventListener('click', e => {
            if (!e.isTrusted || (e.detail === 0 && e.clientX === 0 && e.clientY === 0)) return;
            const productId = container.dataset.productId;
            const productName = container.querySelector('.product-name-map3').textContent;
            openModal(productId, productName);
        });
    });

    dragContainers.forEach(container => {
        if (!container.id) container.id = container.classList.contains('map3-overall-container') ? 'map3-overall-container' : `horizontal-half-block-${Array.from(container.parentNode.children).indexOf(container)}`;

        container.addEventListener('dragover', e => {
            e.preventDefault();
            if (draggedItem && draggedItem.parentNode !== container) container.classList.add('drag-over');
            const isVertical = container.classList.contains('map3-overall-container') || container.classList.contains('horizontal-half-block');
            const afterElement = getDragAfterElement(container, e.clientX, e.clientY, !isVertical);
            if (draggedItem && draggedItem !== afterElement) {
                if (afterElement == null) container.appendChild(draggedItem);
                else container.insertBefore(draggedItem, afterElement);
            }
        });

        container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
        container.addEventListener('drop', e => { e.preventDefault(); container.classList.remove('drag-over'); });
    });

    function getDragAfterElement(container, x, y, isVertical) {
        const draggableElements = [...container.querySelectorAll('.product-container-map3:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            let offset = isVertical ? y - box.top - box.height/2 : x - box.left - box.width/2;
            if (offset < 0 && offset > closest.offset) return { offset, element: child };
            return closest;
        }, { offset: -Infinity }).element;
    }

    // --- Modal listeners ---
    closeModalButton.addEventListener('click', closeModal);
    modalSaveButton.addEventListener('click', saveProductChanges);
    modalClearButton.addEventListener('click', clearModalFields);

    window.addEventListener('click', event => { if(event.target === modal) closeModal(); });
    window.addEventListener('keydown', event => { if(event.key==='Escape') closeModal(); });

    if(backToMainButton) backToMainButton.addEventListener('click', () => window.location.href='index.html');
    if(backToMap2Button) backToMap2Button.addEventListener('click', () => window.location.href='index2.html');

    const goToSalidasButtonMap3 = document.getElementById('go-to-salidas-button-map3');
    if(goToSalidasButtonMap3) goToSalidasButtonMap3.addEventListener('click', () => window.location.href='salidas.html');

    // --- Inicializar ---
    await loadAndArrangeProducts();
});