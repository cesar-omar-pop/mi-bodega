// js/historial_salidas.js
import { db } from './firebase-config.js';
import { collection, query, getDocs, orderBy, Timestamp, deleteDoc, doc, where, writeBatch } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
    const historyListDiv = document.getElementById('history-list');
    const tabsContainer = document.getElementById('tabs-container');
    const deleteMonthBtn = document.getElementById('delete-month-btn');
    const backToMainButton = document.getElementById('back-to-main-menu-btn');
    const toastNotification = document.getElementById('toast-notification');

    let allHistoryData = []; // Almacenará todos los documentos del historial
    let groupedHistoryByMonth = {}; // Almacenará el historial agrupado por Año-Mes
    let currentActiveMonth = ''; // Formato 'YYYY-MM'
    let currentActiveMonthYear = ''; // Formato 'Mes Año'

    // Función para mostrar mensajes (sin cambios)
    function showMessage(message, type = 'info', duration = 3000) {
        if (toastNotification) {
            toastNotification.textContent = message;
            toastNotification.className = `toast-notification ${type} show`;
            if (duration > 0) {
                setTimeout(() => {
                    toastNotification.className = toastNotification.className.replace('show', '');
                }, duration);
            }
        } else {
            alert(message);
        }
    }

    // Función para cargar, agrupar y mostrar el historial de salidas
    async function loadHistory() {
        historyListDiv.innerHTML = '<p style="text-align: center; color: #6c757d;">Cargando historial...</p>';
        tabsContainer.innerHTML = ''; // Limpiar pestañas existentes
        deleteMonthBtn.disabled = true; // Deshabilitar botón de eliminar mes mientras carga

        try {
            // Consulta a la colección 'historial_salidas', ordenando por fecha descendente
            const q = query(collection(db, 'historial_salidas'), orderBy('fecha', 'desc'));
            const querySnapshot = await getDocs(q);

            allHistoryData = [];
            groupedHistoryByMonth = {};

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                let dateObj;
                if (data.fecha instanceof Timestamp) {
                    dateObj = data.fecha.toDate();
                } else if (data.fecha && typeof data.fecha.toDate === 'function') {
                    dateObj = data.fecha.toDate();
                } else if (data.fecha instanceof Date) {
                    dateObj = data.fecha;
                } else {
                    dateObj = new Date(data.fecha);
                }

                // Guardar el ID del documento junto con los datos
                allHistoryData.push({ id: doc.id, ...data, dateObj: dateObj });

                // Agrupar por mes y año
                const yearMonthKey = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0');
                const monthYearLabel = dateObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

                if (!groupedHistoryByMonth[yearMonthKey]) {
                    groupedHistoryByMonth[yearMonthKey] = {
                        label: monthYearLabel.charAt(0).toUpperCase() + monthYearLabel.slice(1), // Capitalizar
                        entries: []
                    };
                }
                groupedHistoryByMonth[yearMonthKey].entries.push({ id: doc.id, ...data, dateObj: dateObj });
            });

            if (allHistoryData.length === 0) {
                historyListDiv.innerHTML = '<p style="text-align: center; color: #6c757d;">No hay salidas registradas aún.</p>';
                showMessage('No se encontró historial de salidas.', 'info');
                return;
            }

            // Ordenar los meses de forma descendente (más reciente primero)
            const sortedMonthKeys = Object.keys(groupedHistoryByMonth).sort().reverse();
            let firstMonthKey = null;

            // Crear las pestañas
            sortedMonthKeys.forEach((key, index) => {
                const tabButton = document.createElement('button');
                tabButton.className = 'tab-button';
                tabButton.textContent = groupedHistoryByMonth[key].label;
                tabButton.dataset.monthKey = key; // Guardar la clave 'YYYY-MM'
                tabsContainer.appendChild(tabButton);

                tabButton.addEventListener('click', () => {
                    setActiveTab(key);
                });

                if (index === 0) { // Establecer el mes más reciente como activo por defecto
                    firstMonthKey = key;
                }
            });

            if (firstMonthKey) {
                setActiveTab(firstMonthKey);
            } else {
                 historyListDiv.innerHTML = '<p style="text-align: center; color: #6c757d;">No hay salidas registradas aún.</p>';
            }

            showMessage('Historial de salidas cargado con éxito.', 'success');

        } catch (error) {
            console.error('Error al cargar el historial de salidas:', error);
            historyListDiv.innerHTML = '<p style="text-align: center; color: #dc3545;">Error al cargar el historial. Por favor, intenta de nuevo.</p>';
            showMessage('Error al cargar el historial. Revisa la consola.', 'error');
        } finally {
            // Eliminar el mensaje de "Cargando historial..."
            const loadingMessage = historyListDiv.querySelector('p');
            if (loadingMessage && loadingMessage.textContent === 'Cargando historial...') {
                historyListDiv.removeChild(loadingMessage);
            }
        }
    }

    // Establece la pestaña activa y renderiza el historial para ese mes
    function setActiveTab(monthKey) {
        // Remover clase 'active' de todas las pestañas
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Añadir clase 'active' a la pestaña seleccionada
        const activeTabButton = document.querySelector(`.tab-button[data-month-key="${monthKey}"]`);
        if (activeTabButton) {
            activeTabButton.classList.add('active');
            currentActiveMonth = monthKey; // Actualizar mes activo global
            currentActiveMonthYear = activeTabButton.textContent; // Actualizar label del mes activo
            renderHistoryForMonth(monthKey);
            deleteMonthBtn.disabled = false; // Habilitar el botón de eliminar mes
        } else {
            console.error('Pestaña no encontrada para la clave:', monthKey);
            deleteMonthBtn.disabled = true; // Mantener deshabilitado si no hay pestaña activa
        }
    }

    // Renderiza solo las entradas del historial para el mes y año dados
    function renderHistoryForMonth(monthKey) {
        historyListDiv.innerHTML = ''; // Limpiar el contenido actual
        const monthData = groupedHistoryByMonth[monthKey];

        if (!monthData || monthData.entries.length === 0) {
            historyListDiv.innerHTML = '<p style="text-align: center; color: #6c757d;">No hay salidas registradas para este mes.</p>';
            return;
        }

        // Ordenar las entradas del mes por fecha descendente
        const sortedEntries = monthData.entries.sort((a, b) => b.dateObj - a.dateObj);

        let lastDate = null;

        sortedEntries.forEach((entry) => {
            const data = entry; // entry ya contiene los datos del documento y dateObj
            const salidaId = entry.id; // El ID del documento para eliminación
            
            const destino = data.destino || 'Desconocido';
            const observaciones = data.observaciones || '';
            const productos = data.productos || [];
            const dateObj = data.dateObj;

            const currentDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timeString = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

            // Añadir separador de día si es un nuevo día
            if (lastDate !== currentDate) {
                const daySeparator = document.createElement('div');
                daySeparator.className = 'day-separator';
                daySeparator.textContent = currentDate;
                historyListDiv.appendChild(daySeparator);
                lastDate = currentDate;
            }

            // Crear la tarjeta de la salida
            const salidaCard = document.createElement('div');
            salidaCard.className = 'salida-card';

            salidaCard.innerHTML = `
                <div class="salida-header">
                    <h3>Destino: <span class="product-detail">${destino}</span></h3>
                    <span class="date-time">Fecha: ${dateObj.toLocaleDateString('es-ES')} ${timeString}</span>
                </div>
                ${observaciones ? `<p><strong>Observaciones:</strong> <span class="product-detail">${observaciones}</span></p>` : ''}
                
                <div class="product-list">
                    <h4>Productos Salientes:</h4>
                    ${productos.length > 0 ? `
                        ${productos.map(prod => `
                            <div class="product-item">
                                <div><strong>Nombre:</strong> <span class="product-detail">${prod.name || 'N/A'}</span></div>
                                <div><strong>Marca:</strong> <span class="product-detail">${prod.brand || 'N/A'}</span></div>
                                <div><strong>Presentación:</strong> <span class="product-detail">${prod.presentation || 'N/A'}</span></div>
                                <div><strong>Cantidad:</strong> <span class="product-detail">${prod.quantity || 0}</span></div>
                                <div><strong>Ubicación:</strong> <span class="product-detail">${prod.bodegaId || 'N/A'}/${prod.locationId || 'N/A'}</span></div>
                            </div>
                        `).join('')}
                    ` : '<p style="font-style: italic; color: #6c757d;">Sin productos específicos en este registro.</p>'}
                </div>
                <button type="button" class="delete-entry-button" data-id="${salidaId}">Eliminar</button>
            `;
            historyListDiv.appendChild(salidaCard);
        });

        // Añadir event listeners a los botones de eliminar entrada
        document.querySelectorAll('.delete-entry-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const idToDelete = event.target.dataset.id;
                deleteEntry(idToDelete);
            });
        });
    }

    // Eliminar una entrada de historial individual
    async function deleteEntry(salidaId) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta entrada del historial? Esta acción es irreversible.')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'historial_salidas', salidaId));
            showMessage('Entrada eliminada con éxito.', 'success');

            // Actualizar los datos locales y volver a renderizar
            await loadHistory();
            // Asegurarse de que la pestaña activa se mantenga si todavía hay datos para ella
            if (currentActiveMonth && groupedHistoryByMonth[currentActiveMonth]) {
                setActiveTab(currentActiveMonth);
            } else {
                // Si el mes actual se quedó sin entradas, recargar todo para buscar un nuevo mes activo
                await loadHistory(); 
            }

        } catch (error) {
            console.error('Error al eliminar la entrada:', error);
            showMessage('Error al eliminar la entrada. Revisa la consola.', 'error');
        }
    }

    // Eliminar todas las entradas para el mes seleccionado
    async function deleteMonth() {
        if (!currentActiveMonth) {
            showMessage('No hay un mes seleccionado para eliminar.', 'warning');
            return;
        }

        if (!confirm(`¡Advertencia! Estás a punto de eliminar TODO el historial de ${currentActiveMonthYear}. Esta acción es irreversible y no se puede deshacer. ¿Continuar?`)) {
            return;
        }

        deleteMonthBtn.disabled = true; // Deshabilitar durante la operación

        try {
            const [year, month] = currentActiveMonth.split('-');
            const q = query(collection(db, 'historial_salidas'), 
                            where('fecha', '>=', new Date(parseInt(year), parseInt(month) - 1, 1)),
                            where('fecha', '<', new Date(parseInt(year), parseInt(month), 1)));
            
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db);
            let deletedCount = 0;

            querySnapshot.forEach((docSnap) => {
                batch.delete(doc(db, 'historial_salidas', docSnap.id));
                deletedCount++;
            });

            if (deletedCount > 0) {
                await batch.commit();
                showMessage(`Se eliminaron ${deletedCount} entradas del historial para ${currentActiveMonthYear}.`, 'success', 7000);
            } else {
                showMessage(`No se encontraron entradas para eliminar en ${currentActiveMonthYear}.`, 'info');
            }
            
            // Recargar todo el historial para reflejar los cambios
            await loadHistory();

        } catch (error) {
            console.error('Error al eliminar el mes completo:', error);
            showMessage(`Error al eliminar el historial de ${currentActiveMonthYear}: ${error.message}. Revisa la consola.`, 'error', 7000);
        } finally {
            deleteMonthBtn.disabled = false; // Re-habilitar el botón
        }
    }

    // --- Event Listeners ---

    // Event listener para el botón de regresar al menú principal
    if (backToMainButton) {
        backToMainButton.addEventListener('click', () => {
            window.location.href = 'index.html'; // Asegúrate de que esta ruta sea la correcta
        });
    }

    // Event listener para el botón de eliminar mes completo
    deleteMonthBtn.addEventListener('click', deleteMonth);

    // Cargar el historial al cargar la página
    await loadHistory();
});