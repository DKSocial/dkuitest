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
const googleButton = document.getElementById('google-login');
const githubButton = document.getElementById('github-login');

// Função para atualizar o status no Firestore
async function updateLoginStatus(userData) {
    try {
        await db.collection('mobileLogins').doc(sessionId).set({
            status: 'completed',
            user: {
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                photoURL: userData.photoURL
            },
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        statusElement.textContent = 'Login realizado com sucesso! Você pode fechar esta página.';
        statusElement.classList.add('active');
        
        // Desabilitar botões após login
        googleButton.style.display = 'none';
        githubButton.style.display = 'none';
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        statusElement.textContent = 'Erro ao processar login. Tente novamente.';
        statusElement.classList.add('active');
    }
}

// Login com Google
googleButton.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        await updateLoginStatus(result.user);
    } catch (error) {
        console.error('Erro no login com Google:', error);
        statusElement.textContent = 'Erro no login com Google. Tente novamente.';
        statusElement.classList.add('active');
    }
});

// Login com GitHub
githubButton.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        const provider = new firebase.auth.GithubAuthProvider();
        const result = await auth.signInWithPopup(provider);
        await updateLoginStatus(result.user);
    } catch (error) {
        console.error('Erro no login com GitHub:', error);
        statusElement.textContent = 'Erro no login com GitHub. Tente novamente.';
        statusElement.classList.add('active');
    }
});

// Verificar se a sessão já foi usada
db.collection('mobileLogins').doc(sessionId).get().then(doc => {
    if (doc.exists && doc.data().status === 'completed') {
        statusElement.textContent = 'Esta sessão já foi utilizada. Por favor, gere um novo QR code.';
        statusElement.classList.add('active');
        googleButton.style.display = 'none';
        githubButton.style.display = 'none';
    }
}); 