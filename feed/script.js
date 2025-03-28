// Importação do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA_d2rRI7GWGvrcGq4KuiZiVhWAKWAkFjQ",
    authDomain: "dksocialbr.firebaseapp.com",
    projectId: "dksocialbr",
    storageBucket: "dksocialbr.appspot.com",
    messagingSenderId: "920583441447",
    appId: "1:920583441447:web:5a28bc09a21cbeaa679202",
    measurementId: "G-WDP6ME7D1P"
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Elementos do DOM
const loadingProfilePic = document.getElementById('loadingProfilePic');
const loadingUsername = document.getElementById('loadingUsername');
const loadingContainer = document.querySelector('.loading-container');

// Função para carregar dados do usuário
async function loadUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Atualiza a foto de perfil
            if (userData.profilePicture) {
                loadingProfilePic.src = userData.profilePicture;
            }
            
            // Atualiza o nome de usuário
            if (userData.username) {
                loadingUsername.textContent = userData.username;
            }
        }
    } catch (error) {
        console.error("Erro ao carregar dados do usuário:", error);
    }
}

// Função para carregar posts
async function loadPosts() {
    try {
        const postsCollection = collection(db, 'posts');
        const postsSnapshot = await getDocs(postsCollection);
        return postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao carregar posts:", error);
        return [];
    }
}

// Função para carregar polls
async function loadPolls() {
    try {
        const pollsCollection = collection(db, 'polls');
        const pollsSnapshot = await getDocs(pollsCollection);
        return pollsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao carregar polls:", error);
        return [];
    }
}

// Função para esconder a tela de loading
function hideLoadingScreen() {
    if (loadingContainer) {
        loadingContainer.style.opacity = '0';
        setTimeout(() => {
            loadingContainer.style.display = 'none';
        }, 500); // Espera 500ms para a animação de fade out
    }
}

// Função principal para carregar todos os dados
async function loadAllData(userId) {
    try {
        // Define um timeout de 15 segundos para esconder a tela de loading
        setTimeout(() => {
            hideLoadingScreen();
        }, 15000);

        // Carrega dados do usuário
        await loadUserData(userId);
        
        // Carrega posts e polls em paralelo
        const [posts, polls] = await Promise.all([
            loadPosts(),
            loadPolls()
        ]);
        
        return { posts, polls };
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        hideLoadingScreen(); // Esconde a tela mesmo em caso de erro
        return { posts: [], polls: [] };
    }
}

// Observador do estado de autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadAllData(user.uid);
    } else {
        // Redireciona para a página de login se não estiver autenticado
        window.location.href = '/log/';
    }
}); 