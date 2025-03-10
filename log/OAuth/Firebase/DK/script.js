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

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Função para gerar um user handle a partir do email
function generateUserHandle(email) {
    return email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

// Função para salvar dados do usuário no Firestore
async function saveUserData(user) {
    if (!user) return;

    const userDocRef = db.collection("users").doc(user.uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
        const userData = {
            username: user.displayName || "Usuário sem nome",
            profilePicture: user.photoURL || "",
            userHandle: generateUserHandle(user.email),
            email: user.email
        };
        await userDocRef.set(userData);
    }
}

// Login com Google
document.getElementById("google-login").addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => {
            saveUserData(result.user);
            localStorage.setItem('isLoggedIn', 'true');
            alert("Login com Google realizado com sucesso!");
            window.location.href = '/feed/';
        })
        .catch(error => console.error("Erro ao autenticar com Google:", error));
});

// Login com GitHub
document.getElementById("github-login").addEventListener("click", () => {
    const provider = new firebase.auth.GithubAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => {
            saveUserData(result.user);
            localStorage.setItem('isLoggedIn', 'true');
            alert("Login com GitHub realizado com sucesso!");
            window.location.href = '/feed/';
        })
        .catch(error => console.error("Erro ao autenticar com GitHub:", error));
});

// Função para abrir modais
function openModal(modalId) {
    document.getElementById(modalId).style.display = "flex";
}

// Função para fechar modais
function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
}

// Event listeners para abrir modais
document.getElementById("register-link").addEventListener("click", () => openModal("register-modal"));
document.getElementById("tos-link").addEventListener("click", () => openModal("tos-modal"));
document.getElementById("login-link").addEventListener("click", () => openModal("login-modal"));

// Event listeners para fechar modais
document.querySelectorAll(".close").forEach(button => {
    button.addEventListener("click", () => closeModal(button.parentElement.parentElement.id));
});

// Função para registrar um novo usuário com email e senha
document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await saveUserData(userCredential.user);
        closeModal("register-modal");
        openModal("profile-modal"); // Abre a modal de perfil após o registro
        alert("Registro realizado com sucesso! Complete seu perfil.");
    } catch (error) {
        console.error("Erro ao registrar:", error);
        alert("Erro ao registrar: " + error.message);
    }
});

// Função para fazer login com email e senha
document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        closeModal("login-modal");
        localStorage.setItem('isLoggedIn', 'true');
        alert("Login realizado com sucesso!");
        window.location.href = '/feed/';
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        alert("Erro ao fazer login: " + error.message);
    }
});

// Função para salvar as informações do perfil
document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const username = document.getElementById("username").value;
    const profilePictureInput = document.getElementById("profile-picture");

    // Verifica se uma imagem foi selecionada
    if (profilePictureInput.files.length === 0) {
        alert("Por favor, selecione uma imagem de perfil.");
        return;
    }

    const file = profilePictureInput.files[0];

    // Converte a imagem para Base64
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64Image = reader.result; // Resultado no formato data:image/png;base64,...

        try {
            const userDocRef = db.collection("users").doc(user.uid);
            await userDocRef.update({
                username: username,
                profilePicture: base64Image // Salva a imagem em Base64
            });
            closeModal("profile-modal");
            alert("Perfil atualizado com sucesso!");
            localStorage.setItem('isLoggedIn', 'true');
            window.location.href = '/feed/';
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            alert("Erro ao salvar perfil: " + error.message);
        }
    };

    reader.readAsDataURL(file); // Inicia a leitura do arquivo como Base64
});

// Exibe o preview da imagem selecionada
document.getElementById("profile-picture").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const preview = document.getElementById("profile-picture-preview");
            preview.src = reader.result;
            preview.style.display = "block";
        };
        reader.readAsDataURL(file);
    }
});