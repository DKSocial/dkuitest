const firebaseConfig = {
    apiKey: "AIzaSyA_d2rRI7GWGvrcGq4KuiZiVhWAKWAkFjQ",
    authDomain: "dksocialbr.firebaseapp.com",
    databaseURL: "https://dksocialbr-default-rtdb.firebaseio.com",
    projectId: "dksocialbr",
    storageBucket: "dksocialbr.firebasestorage.app",
    messagingSenderId: "920583441447",
    appId: "1:920583441447:web:5a28bc09a21cbeaa679202",
    measurementId: "G-WDP6ME7D1P"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Obter o ID da sessão da URL
const sessionId = window.location.pathname.split('/').pop();

// Elementos da UI
const statusElement = document.getElementById('status');
const confirmButton = document.getElementById('confirm-login');
const userInfo = document.getElementById('user-info');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const deviceType = document.getElementById('device-type');
const browser = document.getElementById('browser');
const locationText = document.getElementById('location');
const locationMap = document.getElementById('location-map');

// Função para obter informações do dispositivo
function getDeviceInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        deviceType: /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile/.test(navigator.userAgent) ? 'Celular' : 'Computador',
        browser: navigator.userAgent.match(/(firefox|msie|chrome|safari|opera|edge)\/?\s*([\d.]+)/i)?.[1] || 'unknown'
    };
}

// Função para obter localização
async function getLocation() {
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        // Criar mapa com a localização
        const mapUrl = `https://www.google.com/maps/embed/v1/place?key=YOUR_GOOGLE_MAPS_API_KEY&q=${position.coords.latitude},${position.coords.longitude}&zoom=15`;
        locationMap.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0" src="${mapUrl}" allowfullscreen></iframe>`;
        
        return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
        };
    } catch (error) {
        console.error('Erro ao obter localização:', error);
        return null;
    }
}

// Função para atualizar a UI com as informações
async function updateUI() {
    const deviceInfo = getDeviceInfo();
    const location = await getLocation();
    
    // Atualizar informações do dispositivo
    deviceType.textContent = deviceInfo.deviceType;
    browser.textContent = deviceInfo.browser;
    
    if (location) {
        locationText.textContent = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    } else {
        locationText.textContent = 'Não disponível';
    }
    
    // Verificar se há usuário logado
    const currentUser = auth.currentUser;
    if (currentUser) {
        userInfo.style.display = 'flex';
        userPhoto.src = currentUser.photoURL || '/default-avatar.png';
        userName.textContent = currentUser.displayName || currentUser.email;
        
        // Habilitar botão de confirmação
        confirmButton.disabled = false;
    } else {
        statusElement.textContent = 'Você precisa estar logado para continuar.';
        statusElement.classList.add('active');
        confirmButton.disabled = true;
    }
}

// Função para atualizar o status no Firestore
async function updateLoginStatus() {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('Usuário não está logado');
        }
        
        const deviceInfo = getDeviceInfo();
        const location = await getLocation();
        
        await db.collection('mobileLogins').doc(sessionId).set({
            status: 'completed',
            user: {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL
            },
            device: {
                ...deviceInfo,
                location: location
            },
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        statusElement.textContent = 'Login confirmado! Você pode fechar esta página.';
        statusElement.classList.add('active');
        confirmButton.disabled = true;
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        statusElement.textContent = 'Erro ao processar login. Tente novamente.';
        statusElement.classList.add('active');
    }
}

// Evento do botão de confirmação
confirmButton.addEventListener('click', updateLoginStatus);

// Verificar se a sessão já foi usada
db.collection('mobileLogins').doc(sessionId).get().then(doc => {
    if (doc.exists && doc.data().status === 'completed') {
        statusElement.textContent = 'Esta sessão já foi utilizada. Por favor, gere um novo QR code.';
        statusElement.classList.add('active');
        confirmButton.disabled = true;
    }
});

// Inicializar a UI
updateUI(); 