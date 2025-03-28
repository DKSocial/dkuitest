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
        if (doc.exists && doc.data().status === 'completed') {
            // Login bem-sucedido
            const userData = doc.data().user;
            
            // Atualizar o estado do usuário no Firebase Auth
            firebase.auth().signInWithCustomToken(userData.uid).then(() => {
                window.location.href = '/feed'; // Redirecionar para o feed
            }).catch((error) => {
                console.error('Erro ao fazer login:', error);
            });
        }
    });
}

// Inicializar quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    checkMobileLogin();
}); 