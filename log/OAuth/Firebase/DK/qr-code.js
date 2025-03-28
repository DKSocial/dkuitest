// Configuração do QR Code
const qrCode = new QRCode(document.getElementById("qrcode"), {
    text: window.location.href,
    width: 200,
    height: 200,
    colorDark: "#7A4DA1",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
});

// Verificar status do login mobile
function checkMobileLogin() {
    const db = firebase.firestore();
    const loginRef = db.collection('mobileLogins');
    
    // Criar um ID único para esta sessão
    const sessionId = Math.random().toString(36).substring(7);
    
    // Atualizar o QR code com o ID da sessão
    qrCode.clear();
    qrCode.makeCode(`${window.location.origin}/mobile-login/${sessionId}`);
    
    // Monitorar mudanças no status do login
    loginRef.doc(sessionId).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            
            if (data.status === 'pending') {
                // Mostrar modal de confirmação
                showConfirmationModal(data);
            } else if (data.status === 'completed') {
                // Login bem-sucedido
                const userData = data.user;
                
                // Fazer login com os dados do usuário
                firebase.auth().signInWithCustomToken(userData.uid).then(() => {
                    window.location.href = '/feed'; // Redirecionar para o feed
                }).catch((error) => {
                    console.error('Erro ao fazer login:', error);
                });
            }
        }
    });
}

// Função para mostrar modal de confirmação
function showConfirmationModal(data) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'confirmation-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Confirmar Login</h2>
            <div class="device-info">
                <p><strong>Dispositivo:</strong> ${data.device.deviceType === 'mobile' ? 'Celular' : 'Computador'}</p>
                <p><strong>Navegador:</strong> ${data.device.browser}</p>
                <p><strong>Localização:</strong> ${data.device.location ? 
                    `${data.device.location.latitude.toFixed(4)}, ${data.device.location.longitude.toFixed(4)}` : 
                    'Não disponível'}</p>
            </div>
            <div class="buttons">
                <button id="confirm-login" class="button">Confirmar Login</button>
                <button id="cancel-login" class="button cancel">Cancelar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Adicionar estilos
    const style = document.createElement('style');
    style.textContent = `
        .device-info {
            margin: 20px 0;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 8px;
        }
        .device-info p {
            margin: 5px 0;
            color: #4B286D;
        }
        .buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        .button.cancel {
            background-color: #ff4444;
            color: white;
        }
    `;
    document.head.appendChild(style);
    
    // Eventos dos botões
    document.getElementById('confirm-login').addEventListener('click', async () => {
        const db = firebase.firestore();
        await db.collection('mobileLogins').doc(sessionId).update({
            status: 'completed'
        });
        modal.remove();
    });
    
    document.getElementById('cancel-login').addEventListener('click', async () => {
        const db = firebase.firestore();
        await db.collection('mobileLogins').doc(sessionId).delete();
        modal.remove();
    });
}

// Inicializar quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    checkMobileLogin();
}); 