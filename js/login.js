// login.js

// Importa 'auth' desde tu archivo de configuración de Firebase
import { auth } from './firebase-config.js';

// Importa funciones modulares específicas de Firebase Auth
// Estas son las funciones que vas a usar:
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

// --- Función para mostrar mensajes personalizados ---
// Esta función ahora espera que exista un div con id="notification-area"
function showMessage(message, type = 'info', duration = 3000) {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) {
        console.error('Elemento #notification-area no encontrado para mostrar mensajes.');
        return;
    }

    const notification = document.createElement('div');
    notification.className = `notification-message notification-${type}`;
    notification.textContent = message;
    notificationArea.appendChild(notification);

    // Forzar un reflow para asegurar que la transición funcione
    notification.offsetWidth;

    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => {
            notification.remove();
        }, { once: true });
    }, duration);
}
// --- Fin Función showMessage ---

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del formulario principal
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');
    const forgotPasswordLink = document.getElementById('forgot-password-link');

    // Referencias a elementos del modal de registro
    const registerModal = document.getElementById('register-modal');
    const closeRegisterModalButton = document.getElementById('close-register-modal');
    const newEmailInput = document.getElementById('new-email');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const confirmRegisterButton = document.getElementById('confirm-register-button');

    // Referencias a elementos del modal de "Olvidé Contraseña"
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const closeForgotPasswordModalButton = document.getElementById('close-forgot-password-modal');
    const resetEmailInput = document.getElementById('reset-email');
    const sendResetEmailButton = document.getElementById('send-reset-email-button');

    // --- Event Listeners para el formulario principal ---

    // Manejar el inicio de sesión
    loginButton.addEventListener('click', async (e) => {
        e.preventDefault(); // Evita que el formulario se envíe y recargue la página
        const email = emailInput.value;
        const password = passwordInput.value;

        if (!email || !password) {
            showMessage('Por favor, ingresa correo y contraseña.', 'warning');
            return;
        }

        try {
            // Usa la función modular signInWithEmailAndPassword
            await signInWithEmailAndPassword(auth, email, password);
            console.log('Inicio de sesión exitoso.');
            showMessage('Inicio de sesión exitoso. ¡Bienvenido!', 'success', 3000);
            setTimeout(() => {
                window.location.href = 'index.html'; // Redirige
            }, 3000);
        } catch (error) {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error('Error de inicio de sesión:', errorCode, errorMessage);
            let displayMessage = 'Error al iniciar sesión.';

            if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
                displayMessage = 'Correo o contraseña incorrectos.';
            } else if (errorCode === 'auth/invalid-email') {
                displayMessage = 'Formato de correo electrónico inválido.';
            } else if (errorCode === 'auth/too-many-requests') {
                displayMessage = 'Demasiados intentos de inicio de sesión. Intenta más tarde.';
            }

            showMessage(displayMessage, 'error', 4000);
        }
    });

    // Abrir el modal de registro
    registerButton.addEventListener('click', () => {
        registerModal.style.display = 'block';
        // Limpiar campos del modal de registro al abrirlo
        newEmailInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
    });

    // Abrir el modal de "Olvidé Contraseña"
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.style.display = 'block';
        resetEmailInput.value = ''; // Limpiar campo al abrir
    });

    // --- Event Listeners para el modal de Registro ---

    // Cerrar modal de registro
    closeRegisterModalButton.addEventListener('click', () => {
        registerModal.style.display = 'none';
    });

    // Registrar nuevo usuario (dentro del modal de registro)
    confirmRegisterButton.addEventListener('click', async () => {
        const email = newEmailInput.value;
        const password = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Validaciones del formulario de registro
        if (!email || !password || !confirmPassword) {
            showMessage('Todos los campos son obligatorios.', 'warning');
            return;
        }
        if (password !== confirmPassword) {
            showMessage('Las contraseñas no coinciden.', 'warning');
            return;
        }
        if (password.length < 6) {
            showMessage('La contraseña debe tener al menos 6 caracteres.', 'warning');
            return;
        }

        try {
            // Usa la función modular createUserWithEmailAndPassword
            await createUserWithEmailAndPassword(auth, email, password);
            console.log('Usuario registrado exitosamente.');
            showMessage('Registro exitoso. ¡Ahora puedes iniciar sesión con tu nueva cuenta!', 'success', 4000);
            registerModal.style.display = 'none'; // Cierra el modal después del registro

            // Opcional: pre-rellenar el email en el formulario de login principal para facilitar el inicio de sesión
            emailInput.value = email;
            passwordInput.value = ''; // No pre-rellenar la contraseña por seguridad
        } catch (error) {
            const errorCode = error.code;
            console.error('Error de registro:', errorCode, error.message);
            let displayMessage = 'Error al registrar usuario.';

            if (errorCode === 'auth/email-already-in-use') {
                displayMessage = 'El correo electrónico ya está en uso.';
            } else if (errorCode === 'auth/weak-password') {
                displayMessage = 'La contraseña es demasiado débil.';
            } else if (errorCode === 'auth/invalid-email') {
                displayMessage = 'Formato de correo electrónico inválido.';
            } else if (errorCode === 'auth/network-request-failed') {
                displayMessage = 'Error de red. Por favor, verifica tu conexión a internet.';
            }

            showMessage(displayMessage, 'error', 4000);
        }
    });

    // --- Event Listeners para el modal de "Olvidé Contraseña" ---

    // Cerrar modal de "Olvidé Contraseña"
    closeForgotPasswordModalButton.addEventListener('click', () => {
        forgotPasswordModal.style.display = 'none';
    });

    // Cerrar modal al hacer clic fuera de él
    window.addEventListener('click', (e) => {
        if (e.target == registerModal) {
            registerModal.style.display = 'none';
        }
        if (e.target == forgotPasswordModal) {
            forgotPasswordModal.style.display = 'none';
        }
    });

    // Enviar correo de restablecimiento
    sendResetEmailButton.addEventListener('click', async () => {
        const resetEmail = resetEmailInput.value;
        if (!resetEmail) {
            showMessage('Por favor, ingresa tu correo electrónico para restablecer la contraseña.', 'warning');
            return;
        }

        try {
            // Usa la función modular sendPasswordResetEmail
            await sendPasswordResetEmail(auth, resetEmail);
            showMessage('Se ha enviado un correo electrónico de restablecimiento a ' + resetEmail + '. Revisa tu bandeja de entrada.', 'success', 5000);
            forgotPasswordModal.style.display = 'none'; // Cierra el modal
        } catch (error) {
            const errorCode = error.code;
            console.error('Error al enviar correo de restablecimiento:', errorCode, error.message);
            let displayMessage = 'Error al enviar el correo de restablecimiento.';

            if (errorCode === 'auth/user-not-found') {
                displayMessage = 'No hay un usuario registrado con ese correo electrónico.';
            } else if (errorCode === 'auth/invalid-email') {
                displayMessage = 'Formato de correo electrónico inválido.';
            } else if (errorCode === 'auth/network-request-failed') {
                displayMessage = 'Error de red. Verifica tu conexión.';
            }

            showMessage(displayMessage, 'error', 5000);
        }
    });
});