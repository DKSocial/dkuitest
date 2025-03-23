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

// Inicialização do Firebase (apenas se ainda não estiver inicializado)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Estado global da aplicação
const state = {
  profileUserId: null,
  currentUser: null
};

// Utilitários
const utils = {
  getUserHandleFromURL() {
    try {
      const pathParts = window.location.pathname.split('/');
      const userHandle = pathParts[pathParts.length - 1];
      console.log('UserHandle da URL:', userHandle);
      return userHandle;
    } catch (error) {
      console.error('Erro ao obter userHandle da URL:', error);
      return null;
    }
  },

  validateUserHandle(userHandle) {
    const regex = /^[a-zA-Z0-9_-]+$/;
    if (userHandle.length < 3 || userHandle.length > 15) {
      return "UserHandle deve ter entre 3-15 caracteres.";
    }
    if (!regex.test(userHandle)) {
      return "Use apenas letras, números, _ ou -.";
    }
    return null;
  },

  async isUserHandleAvailable(userHandle) {
    try {
      const querySnapshot = await db.collection('users')
        .where('userHandle', '==', userHandle)
        .get();
      return querySnapshot.empty;
    } catch (error) {
      console.error("Erro ao verificar userHandle:", error);
      return false;
    }
  },

  generateProfileUrl(userHandle) {
    // Gera a URL completa do perfil usando o novo formato
    const baseUrl = window.location.origin;
    const profileUrl = `${baseUrl}/user/${userHandle}`;
    return profileUrl;
  }
};

// Gerenciador de UI
const ui = {
  updateProfileUI(userData) {
    console.log('Atualizando UI com dados:', userData);
    document.getElementById('profileName').textContent = userData.username || 'Nome não definido';
    document.getElementById('userHandle').textContent = `@${userData.userHandle}`;
    document.getElementById('bioText').textContent = userData.bio || 'Biografia não definida';
    document.getElementById('profileImage').src = userData.profilePicture || 'https://via.placeholder.com/100';
    
    // Adiciona o botão de compartilhar se não existir
    if (!document.getElementById('shareProfileButton')) {
      const shareButton = document.createElement('button');
      shareButton.id = 'shareProfileButton';
      shareButton.textContent = 'Compartilhar Perfil';
      shareButton.style.marginTop = '10px';
      document.querySelector('.profile-header').appendChild(shareButton);
      
      shareButton.addEventListener('click', () => {
        const profileUrl = utils.generateProfileUrl(userData.userHandle);
        navigator.clipboard.writeText(profileUrl).then(() => {
          alert('Link do perfil copiado para a área de transferência!');
        }).catch(err => {
          console.error('Erro ao copiar link:', err);
          alert('Erro ao copiar link. Tente novamente.');
        });
      });
    }
  },

  toggleButtons(isOwnProfile) {
    console.log('Alternando botões, é próprio perfil:', isOwnProfile);
    const editButton = document.getElementById('editProfileButton');
    const followButton = document.getElementById('followButton');
    
    editButton.style.display = isOwnProfile ? 'block' : 'none';
    followButton.style.display = isOwnProfile ? 'none' : 'block';
  },

  showModal(show = true) {
    document.getElementById('editProfileModal').style.display = show ? 'flex' : 'none';
  },

  populateEditForm(userData) {
    document.getElementById('editName').value = userData.username || '';
    document.getElementById('editUserHandle').value = userData.userHandle || '';
    document.getElementById('editBio').value = userData.bio || '';
    document.getElementById('editProfilePicture').value = userData.profilePicture || '';
  }
};

// Gerenciador de Perfil
const profileManager = {
  async loadProfileByUserHandle(userHandle) {
    console.log('Carregando perfil para userHandle:', userHandle);
    try {
      if (!userHandle) {
        throw new Error('UserHandle não fornecido');
      }

      const querySnapshot = await db.collection('users')
        .where('userHandle', '==', userHandle)
        .get();
      
      console.log('Resultado da query:', querySnapshot.empty ? 'Nenhum resultado' : 'Usuário encontrado');
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        state.profileUserId = doc.id;
        const userData = doc.data();
        
        console.log('Dados do usuário:', userData);
        
        ui.updateProfileUI(userData);
        await this.updateFollowerCount(state.profileUserId);
        await this.loadUserTweets(state.profileUserId);
        
        // Configura os botões após carregar o perfil
        const currentUser = auth.currentUser;
        const isOwnProfile = currentUser && currentUser.uid === state.profileUserId;
        ui.toggleButtons(isOwnProfile);
        
        if (!isOwnProfile && currentUser) {
          await this.checkIfFollowing(currentUser.uid, state.profileUserId);
        }
      } else {
        console.log("Nenhum usuário encontrado com esse userHandle.");
        ui.updateProfileUI({
          username: 'Usuário não encontrado',
          userHandle: userHandle,
          bio: 'Este perfil não existe ou foi removido.',
          profilePicture: 'https://via.placeholder.com/100'
        });
        ui.toggleButtons(false);
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      ui.updateProfileUI({
        username: 'Erro ao carregar perfil',
        userHandle: userHandle,
        bio: 'Ocorreu um erro ao carregar este perfil. Tente novamente mais tarde.',
        profilePicture: 'https://via.placeholder.com/100'
      });
      ui.toggleButtons(false);
      throw error;
    }
  },

  async loadProfileByUserId(userId) {
    console.log('Carregando perfil por ID:', userId);
    try {
      if (!userId) {
        throw new Error('ID do usuário não fornecido');
      }

      const doc = await db.collection('users').doc(userId).get();
      
      if (doc.exists) {
        state.profileUserId = doc.id;
        const userData = doc.data();
        console.log('Dados do usuário:', userData);
        
        ui.updateProfileUI(userData);
        await this.updateFollowerCount(state.profileUserId);
        await this.loadUserTweets(state.profileUserId);
        
        this.setupProfileButtons();
      } else {
        console.log("Usuário não encontrado no Firestore");
        throw new Error('Usuário não encontrado');
      }
    } catch (error) {
      console.error("Erro ao carregar perfil por ID:", error);
      throw error; // Re-throw para tratamento no nível superior
    }
  },

  async updateFollowerCount(userId) {
    try {
      const followersSnapshot = await db.collection('followers')
        .doc(userId)
        .collection('userFollowers')
        .get();
      document.getElementById('followerCount').textContent = followersSnapshot.size;
    } catch (error) {
      console.error("Erro ao carregar seguidores:", error);
    }
  },

  async checkIfFollowing(currentUserId, profileUserId) {
    try {
      const followDoc = await db.collection('followers')
        .doc(profileUserId)
        .collection('userFollowers')
        .doc(currentUserId)
        .get();
      
      const followButton = document.getElementById('followButton');
      if (followDoc.exists) {
        followButton.textContent = "Deixar de seguir";
        followButton.classList.add('unfollow');
      } else {
        followButton.textContent = "Seguir";
        followButton.classList.remove('unfollow');
      }
    } catch (error) {
      console.error("Erro ao verificar se está seguindo:", error);
    }
  },

  async toggleFollow(currentUserId, profileUserId) {
    const followRef = db.collection('followers')
      .doc(profileUserId)
      .collection('userFollowers')
      .doc(currentUserId);
      
    try {
      const followDoc = await followRef.get();
      if (followDoc.exists) {
        await followRef.delete();
      } else {
        await followRef.set({ timestamp: firebase.firestore.FieldValue.serverTimestamp() });
      }
      await this.updateFollowerCount(profileUserId);
      await this.checkIfFollowing(currentUserId, profileUserId);
    } catch (error) {
      console.error("Erro ao seguir/deixar de seguir:", error);
    }
  },

  setupProfileButtons() {
    const currentUser = auth.currentUser;
    const isOwnProfile = currentUser && currentUser.uid === state.profileUserId;
    
    console.log('Configurando botões:', {
      currentUser: currentUser?.uid,
      profileUserId: state.profileUserId,
      isOwnProfile
    });
    
    ui.toggleButtons(isOwnProfile);
    
    if (!isOwnProfile && currentUser) {
      this.checkIfFollowing(currentUser.uid, state.profileUserId);
    }
  },

  async loadUserTweets(userId) {
    console.log("Carregando tweets para o usuário:", userId);
  }
};

// Gerenciador de Edição de Perfil
const profileEditor = {
  async handleProfileUpdate(e) {
    e.preventDefault();
    const user = auth.currentUser;
    
    if (!user) {
      console.log('Usuário não está logado');
      return;
    }

    const newUserHandle = document.getElementById('editUserHandle').value.trim();
    const validationError = utils.validateUserHandle(newUserHandle);
    
    if (validationError) {
      alert(validationError);
      return;
    }

    const isAvailable = await utils.isUserHandleAvailable(newUserHandle);
    if (!isAvailable) {
      alert("Este userHandle já está em uso. Escolha outro.");
      return;
    }

    const updatedData = {
      username: document.getElementById('editName').value,
      userHandle: newUserHandle,
      bio: document.getElementById('editBio').value,
      profilePicture: document.getElementById('editProfilePicture').value
    };

    try {
      await db.collection('users').doc(user.uid).update(updatedData);
      alert('Perfil atualizado com sucesso!');
      ui.showModal(false);
      await profileManager.loadProfileByUserHandle(newUserHandle);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      alert('Erro ao atualizar perfil. Tente novamente.');
    }
  }
};

// Função para garantir que o Firebase esteja pronto
const ensureFirebaseReady = () => {
  return new Promise((resolve) => {
    if (firebase.apps.length) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (firebase.apps.length) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    }
  });
};

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM carregado, iniciando...');
  
  try {
    // Aguarda o Firebase estar pronto
    await ensureFirebaseReady();
    console.log('Firebase está pronto');
    
    // Inicialização da página
    const userHandle = utils.getUserHandleFromURL();
    if (userHandle) {
      console.log('Carregando perfil do userHandle:', userHandle);
      await profileManager.loadProfileByUserHandle(userHandle);
    } else {
      console.log('Nenhum userHandle na URL, verificando usuário logado');
      const currentUser = auth.currentUser;
      if (currentUser) {
        console.log('Usuário logado encontrado, carregando perfil');
        await profileManager.loadProfileByUserId(currentUser.uid);
      } else {
        console.log('Nenhum usuário logado');
      }
    }
  } catch (error) {
    console.error('Erro ao inicializar a página:', error);
  }

  // Event Listeners para botões
  document.getElementById('editProfileButton').addEventListener('click', () => {
    ui.showModal(true);
    const user = auth.currentUser;
    if (user) {
      db.collection('users').doc(user.uid).get()
        .then((doc) => {
          if (doc.exists) {
            ui.populateEditForm(doc.data());
          }
        })
        .catch((error) => {
          console.error('Erro ao carregar dados para edição:', error);
        });
    }
  });

  document.getElementById('cancelEditButton').addEventListener('click', () => {
    ui.showModal(false);
  });

  document.getElementById('followButton').addEventListener('click', () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("Você precisa estar logado para seguir alguém.");
      return;
    }
    profileManager.toggleFollow(currentUser.uid, state.profileUserId);
  });

  document.getElementById('imageUpload').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('editProfilePicture').value = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('editProfileForm').addEventListener('submit', profileEditor.handleProfileUpdate);
});

// Observador de autenticação
auth.onAuthStateChanged((user) => {
  console.log('Estado de autenticação alterado:', user ? 'Usuário logado' : 'Usuário deslogado');
  state.currentUser = user;
  
  if (user) {
    console.log('ID do usuário logado:', user.uid);
    // Não carrega automaticamente o perfil do usuário logado
    // Apenas configura os botões se já houver um perfil carregado
    if (state.profileUserId) {
      profileManager.setupProfileButtons();
    }
  } else {
    console.log('Nenhum usuário logado');
  }
}); 