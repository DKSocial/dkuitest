// Configurações e constantes
const CONFIG = {
  firebase: {
    apiKey: "AIzaSyA_d2rRI7GWGvrcGq4KuiZiVhWAKWAkFjQ",
    authDomain: "dksocialbr.firebaseapp.com",
    projectId: "dksocialbr",
    storageBucket: "dksocialbr.appspot.com",
    messagingSenderId: "920583441447",
    appId: "1:920583441447:web:5a28bc09a21cbeaa679202",
    measurementId: "G-WDP6ME7D1P"
  },
  messages: {
    success: {
      settingsSaved: 'Configurações salvas com sucesso!',
      accountDeactivated: 'Conta desativada com sucesso!',
      accountDeleted: 'Conta excluída com sucesso!'
    },
    error: {
      loadSettings: 'Erro ao carregar configurações',
      saveSettings: 'Erro ao salvar configurações',
      deactivateAccount: 'Erro ao desativar conta',
      deleteAccount: 'Erro ao excluir conta'
    },
    confirm: {
      deactivate: 'Tem certeza que deseja desativar sua conta? Você poderá reativá-la posteriormente.',
      delete: 'ATENÇÃO: Esta ação não pode ser desfeita. Todos os seus dados serão excluídos permanentemente. Tem certeza?'
    }
  }
};

// Classe principal para gerenciar as configurações
class SettingsManager {
  constructor() {
    this.currentUser = null;
    this.db = null;
    this.auth = null;
    this.elements = {
      themeOptions: document.querySelectorAll('.theme-option'),
      privateAccount: document.getElementById('privateAccount'),
      showLocation: document.getElementById('showLocation'),
      deactivateAccountBtn: document.getElementById('deactivateAccount'),
      deleteAccountBtn: document.getElementById('deleteAccount')
    };
    
    this.init();
  }

  init() {
    firebase.initializeApp(CONFIG.firebase);
    this.db = firebase.firestore();
    this.auth = firebase.auth();
    
    this.setupAuthListener();
    this.setupEventListeners();
  }

  setupAuthListener() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.currentUser = user;
        await this.loadUserSettings();
      } else {
        window.location.href = '/log/';
      }
    });
  }

  setupEventListeners() {
    // Tema
    this.elements.themeOptions.forEach(option => {
      option.addEventListener('click', () => this.handleThemeChange(option));
    });

    // Privacidade
    this.elements.privateAccount.addEventListener('change', () => this.handlePrivacyChange());
    this.elements.showLocation.addEventListener('change', () => this.handleLocationChange());

    // Gerenciamento de conta
    this.elements.deactivateAccountBtn.addEventListener('click', () => this.handleAccountDeactivation());
    this.elements.deleteAccountBtn.addEventListener('click', () => this.handleAccountDeletion());
  }

  async loadUserSettings() {
    try {
      const userDoc = await this.db.collection('users').doc(this.currentUser.uid).get();
      const userData = userDoc.data();

      if (userData?.settings) {
        this.applyUserSettings(userData.settings);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      this.showToast(CONFIG.messages.error.loadSettings, true);
    }
  }

  applyUserSettings(settings) {
    // Aplicar tema
    if (settings.theme) {
      this.applyTheme(settings.theme);
      this.elements.themeOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.theme === settings.theme);
      });
    }

    // Aplicar configurações de privacidade
    if (settings.privateAccount !== undefined) {
      this.elements.privateAccount.checked = settings.privateAccount;
    }
    if (settings.showLocation !== undefined) {
      this.elements.showLocation.checked = settings.showLocation;
    }
  }

  async handleThemeChange(option) {
    const theme = option.dataset.theme;
    this.applyTheme(theme);
    
    this.elements.themeOptions.forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');

    await this.updateSettings({ theme });
  }

  async handlePrivacyChange() {
    await this.updateSettings({
      privateAccount: this.elements.privateAccount.checked
    });
  }

  async handleLocationChange() {
    await this.updateSettings({
      showLocation: this.elements.showLocation.checked
    });
  }

  async updateSettings(newSettings) {
    try {
      const userDoc = await this.db.collection('users').doc(this.currentUser.uid).get();
      const userData = userDoc.data();
      const currentSettings = userData.settings || {};
      
      await this.db.collection('users').doc(this.currentUser.uid).update({
        settings: { ...currentSettings, ...newSettings }
      });
      
      this.showToast(CONFIG.messages.success.settingsSaved);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      this.showToast(CONFIG.messages.error.saveSettings, true);
    }
  }

  async handleAccountDeactivation() {
    if (confirm(CONFIG.messages.confirm.deactivate)) {
      try {
        await this.db.collection('users').doc(this.currentUser.uid).update({
          deactivated: true,
          deactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        this.showToast(CONFIG.messages.success.accountDeactivated);
        setTimeout(() => {
          this.auth.signOut();
          window.location.href = '/log/';
        }, 2000);
      } catch (error) {
        console.error('Erro ao desativar conta:', error);
        this.showToast(CONFIG.messages.error.deactivateAccount, true);
      }
    }
  }

  async handleAccountDeletion() {
    if (confirm(CONFIG.messages.confirm.delete)) {
      try {
        // Excluir dados do usuário
        await this.db.collection('users').doc(this.currentUser.uid).delete();
        
        // Excluir posts do usuário
        const postsSnapshot = await this.db.collection('tweets')
          .where('userId', '==', this.currentUser.uid)
          .get();
        
        const batch = this.db.batch();
        postsSnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        // Excluir conta do Firebase Auth
        await this.currentUser.delete();
        
        this.showToast(CONFIG.messages.success.accountDeleted);
        setTimeout(() => {
          window.location.href = '/log/';
        }, 2000);
      } catch (error) {
        console.error('Erro ao excluir conta:', error);
        this.showToast(CONFIG.messages.error.deleteAccount, true);
      }
    }
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  showToast(message, isError = false) {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: isError ? "#e74c3c" : "#2ecc71"
    }).showToast();
  }
}

// Inicializar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  new SettingsManager();
}); 
