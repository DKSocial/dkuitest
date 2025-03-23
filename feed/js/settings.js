// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA_d2rRI7GWGvrcGq4KuiZiVhWAKWAkFjQ",
  authDomain: "dksocialbr.firebaseapp.com",
  projectId: "dksocialbr",
  storageBucket: "dksocialbr.appspot.com",
  messagingSenderId: "920583441447",
  appId: "1:920583441447:web:5a28bc09a21cbeaa679202",
  measurementId: "G-WDP6ME7D1P"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Elementos DOM
const languageSelect = document.getElementById('languageSelect');
const themeOptions = document.querySelectorAll('.theme-option');
const pushNotifications = document.getElementById('pushNotifications');
const emailNotifications = document.getElementById('emailNotifications');
const privateAccount = document.getElementById('privateAccount');
const showLocation = document.getElementById('showLocation');
const deactivateAccountBtn = document.getElementById('deactivateAccount');
const deleteAccountBtn = document.getElementById('deleteAccount');

let currentUser = null;

// Inicializar a aplicação
const initApp = () => {
  auth.onAuthStateChanged(async user => {
    if (user) {
      currentUser = user;
      loadUserSettings();
    } else {
      window.location.href = '/log/';
    }
  });
};

// Carregar configurações do usuário
const loadUserSettings = async () => {
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data();

    if (userData.settings) {
      // Idioma
      if (userData.settings.language) {
        languageSelect.value = userData.settings.language;
      }

      // Tema
      if (userData.settings.theme) {
        document.body.classList.toggle('dark-theme', userData.settings.theme === 'dark');
        themeOptions.forEach(option => {
          option.classList.toggle('active', option.dataset.theme === userData.settings.theme);
        });
      }

      // Notificações
      if (userData.settings.pushNotifications !== undefined) {
        pushNotifications.checked = userData.settings.pushNotifications;
      }
      if (userData.settings.emailNotifications !== undefined) {
        emailNotifications.checked = userData.settings.emailNotifications;
      }

      // Privacidade
      if (userData.settings.privateAccount !== undefined) {
        privateAccount.checked = userData.settings.privateAccount;
      }
      if (userData.settings.showLocation !== undefined) {
        showLocation.checked = userData.settings.showLocation;
      }
    }
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    showToast('Erro ao carregar configurações', true);
  }
};

// Salvar configurações
const saveSettings = async (settings) => {
  try {
    await db.collection('users').doc(currentUser.uid).update({
      settings: settings
    });
    showToast('Configurações salvas com sucesso!');
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    showToast('Erro ao salvar configurações', true);
  }
};

// Event Listeners
languageSelect.addEventListener('change', async () => {
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const userData = userDoc.data();
  const currentSettings = userData.settings || {};
  
  await saveSettings({
    ...currentSettings,
    language: languageSelect.value
  });
});

themeOptions.forEach(option => {
  option.addEventListener('click', async () => {
    const theme = option.dataset.theme;
    document.body.classList.toggle('dark-theme', theme === 'dark');
    
    themeOptions.forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');

    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data();
    const currentSettings = userData.settings || {};
    
    await saveSettings({
      ...currentSettings,
      theme: theme
    });
  });
});

// Notificações
pushNotifications.addEventListener('change', async () => {
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const userData = userDoc.data();
  const currentSettings = userData.settings || {};
  
  await saveSettings({
    ...currentSettings,
    pushNotifications: pushNotifications.checked
  });
});

emailNotifications.addEventListener('change', async () => {
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const userData = userDoc.data();
  const currentSettings = userData.settings || {};
  
  await saveSettings({
    ...currentSettings,
    emailNotifications: emailNotifications.checked
  });
});

// Privacidade
privateAccount.addEventListener('change', async () => {
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const userData = userDoc.data();
  const currentSettings = userData.settings || {};
  
  await saveSettings({
    ...currentSettings,
    privateAccount: privateAccount.checked
  });
});

showLocation.addEventListener('change', async () => {
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const userData = userDoc.data();
  const currentSettings = userData.settings || {};
  
  await saveSettings({
    ...currentSettings,
    showLocation: showLocation.checked
  });
});

// Desativar conta
deactivateAccountBtn.addEventListener('click', async () => {
  if (confirm('Tem certeza que deseja desativar sua conta? Você poderá reativá-la posteriormente.')) {
    try {
      await db.collection('users').doc(currentUser.uid).update({
        deactivated: true,
        deactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Conta desativada com sucesso!');
      setTimeout(() => {
        auth.signOut();
        window.location.href = '/log/';
      }, 2000);
    } catch (error) {
      console.error('Erro ao desativar conta:', error);
      showToast('Erro ao desativar conta', true);
    }
  }
});

// Excluir conta
deleteAccountBtn.addEventListener('click', async () => {
  if (confirm('ATENÇÃO: Esta ação não pode ser desfeita. Todos os seus dados serão excluídos permanentemente. Tem certeza?')) {
    try {
      // Excluir dados do usuário
      await db.collection('users').doc(currentUser.uid).delete();
      
      // Excluir posts do usuário
      const postsSnapshot = await db.collection('tweets').where('userId', '==', currentUser.uid).get();
      const batch = db.batch();
      postsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      // Excluir conta do Firebase Auth
      await currentUser.delete();
      
      showToast('Conta excluída com sucesso!');
      setTimeout(() => {
        window.location.href = '/log/';
      }, 2000);
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      showToast('Erro ao excluir conta', true);
    }
  }
});

// Função para mostrar notificações
const showToast = (message, isError = false) => {
  Toastify({
    text: message,
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor: isError ? "#e74c3c" : "#2ecc71"
  }).showToast();
};

// Inicializar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initApp); 