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

// Elementos DOM dos tweets
const tweetForm = document.querySelector('[data-js="tweet-form"]');
const tweetTextarea = document.querySelector('[data-js="tweet-description"]');
const mediaInput = document.querySelector('[data-js="media-url-input"]');
const tweetsContainer = document.querySelector('[data-js="tweets"]');
const characterCount = document.querySelector('.character-count');
const tweetButton = document.querySelector('[data-js="tweet-button"]');
const trendingHashtags = document.getElementById('trending-hashtags');
const notificationsBell = document.querySelector('.notifications-bell');
const notificationsPanel = document.querySelector('.notifications-panel');
const notificationsCount = document.querySelector('.notifications-count');

// Elementos DOM da modal de comentários
const commentsModal = document.getElementById('commentsModal');
const commentsList = document.getElementById('commentsList');
const closeModalButton = document.querySelector('.close-modal');

// Elementos DOM para criação de polls
const createPollButton = document.getElementById('createPollButton');
const pollModal = document.getElementById('pollModal');
const pollForm = document.getElementById('pollForm');
const pollQuestion = document.getElementById('pollQuestion');
const pollOptionsContainer = document.getElementById('pollOptionsContainer');
const addOptionButton = document.getElementById('addOptionButton');
const pollsContainer = document.querySelector('[data-js="polls"]');

// Variáveis globais
let currentUser = null;
const hashtagsMap = new Map();
let currentHashtagFilter = null; // Para armazenar a hashtag filtrada

// Função para analisar conteúdo com Gemini
const analyzeContentWithGemini = async (text, mediaUrls) => {
  const apiKey = "AIzaSyCRi9YnfvOWjezLAeGpNOaImDk7W4xQXOA"; // Sua chave de API Gemini
  const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
  let inputText = `Analise o seguinte conteúdo para verificar se contém material adulto (+18): "${text}". Responda apenas com "SEGURO" ou "NÃO SEGURO".`;

  const response = await fetch(`${apiUrl}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: inputText }] }] })
  });

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text.includes("NÃO SEGURO");
};

// Inicializa a aplicação e verifica autenticação
const initApp = () => {
  auth.onAuthStateChanged(async user => {
    if (user) {
      currentUser = user;
      // Verificar se o usuário já existe no Firestore
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (!userDoc.exists) {
        await db.collection('users').doc(user.uid).set({
          username: user.displayName || 'Usuário Anônimo',
          profilePicture: user.photoURL || 'https://via.placeholder.com/50',
          verified: false,
          email: user.email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      loadTweets();
      loadPolls();
      setupEventListeners();
      setupTweetActions();
      setupPollEventListeners();
    } else {
      window.location.href = '/log/';
    }
  });
};

const setupEventListeners = () => {
  // Eventos dos tweets
  tweetTextarea.addEventListener('input', updateCharacterCount);
  tweetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await postTweet();
  });
  mediaInput.addEventListener('input', updateMediaPreview);
  tweetsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('hashtag')) {
      e.preventDefault();
      const hashtag = e.target.textContent.slice(1);
      filterTweetsByHashtag(hashtag);
    } else if (e.target.classList.contains('mention')) {
      e.preventDefault();
      const username = e.target.textContent.slice(1);
      window.location.href = `/Perfil/?user=${username}`;
    }
  });

  // Eventos da criação de polls
  if (createPollButton) {
    createPollButton.addEventListener('click', () => {
      if (pollModal) {
        pollModal.style.display = 'block';
        // Limpa o formulário e adiciona duas opções iniciais
        if (pollForm) pollForm.reset();
        if (pollOptionsContainer) {
          pollOptionsContainer.innerHTML = `
            <input type="text" class="poll-option" placeholder="Opção 1" required>
            <input type="text" class="poll-option" placeholder="Opção 2" required>
          `;
        }
      }
    });
  }

  // Botão para fechar a modal de poll
  const closePollButton = pollModal?.querySelector('.close-modal');
  if (closePollButton) {
    closePollButton.addEventListener('click', () => {
      if (pollModal) {
        pollModal.style.display = 'none';
      }
    });
  }

  // Adicionar nova opção dinamicamente
  if (addOptionButton) {
    addOptionButton.addEventListener('click', () => {
      const optionCount = pollOptionsContainer?.querySelectorAll('.poll-option').length || 0;
      if (optionCount < 4) { // Limite de 4 opções
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'poll-option';
        newInput.placeholder = `Opção ${optionCount + 1}`;
        newInput.required = true;
        pollOptionsContainer?.appendChild(newInput);
      } else {
        showToast('Máximo de 4 opções permitidas.', true);
      }
    });
  }

  // Envio da poll
  if (pollForm) {
    pollForm.addEventListener('submit', postPoll);
  }

  // Evento para envio de comentário nos tweets
  document.querySelector('#commentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addComment();
  });
};

const updateCharacterCount = () => {
  const remaining = 280 - tweetTextarea.value.length;
  characterCount.textContent = remaining;
  tweetButton.disabled = remaining < 0 || remaining === 280;
};

const postTweet = async () => {
  showLoading();
  try {
    const content = tweetTextarea.value.trim();
    const mediaUrls = mediaInput.value.split(',').map(url => url.trim()).filter(Boolean);
    const hashtags = extractHashtags(content);
    const platform = getPlatform();

    // Verifica se o conteúdo é seguro
    const isUnsafe = await analyzeContentWithGemini(content, mediaUrls);
    if (isUnsafe) {
      showToast('Seu post contém conteúdo +18 e não pode ser publicado.', true);
      hideLoading();
      return;
    }

    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data();

    await db.collection('tweets').add({
      content,
      mediaUrls,
      hashtags,
      likes: 0,
      likesUsers: [],
      retweets: 0,
      comments: [],
      sponsored: false,
      userId: currentUser.uid,
      username: userData.username || 'Usuário Anônimo',
      userHandle: userData.userHandle || '@zuser.dksocial.space',
      profilePicture: userData.profilePicture || 'https://i.pinimg.com/736x/62/01/0d/62010d848b790a2336d1542fcda51789.jpg',
      verified: userData.verified === true,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      platform
    });

    clearForm();
    showToast('Tweet postado com sucesso!');
    loadTweets();
  } catch (error) {
    showToast(`Erro ao postar tweet: ${error.message}`, true);
  } finally {
    hideLoading();
  }
};

const loadTweets = () => {
  let query = db.collection('tweets').orderBy('timestamp', 'desc');
  if (currentHashtagFilter) {
    query = query.where('hashtags', 'array-contains', currentHashtagFilter);
  }
  query.onSnapshot(snapshot => {
    tweetsContainer.innerHTML = '';
    hashtagsMap.clear();
    snapshot.forEach(doc => {
      const tweet = { id: doc.id, ...doc.data() };
      renderTweet(tweet);
      updateHashtags(tweet.hashtags);
    });
    renderTrendingHashtags();
  });
};

const renderTweet = (tweet) => {
  const tweetElement = document.createElement('div');
  tweetElement.className = 'tweet';
  let content = tweet.content;
  if (tweet.originalTweetId) {
    content = `Repostado de @${tweet.userHandle}: "${tweet.content}"`;
  }
  const timestamp = tweet.timestamp.toDate().toLocaleString();
  tweetElement.innerHTML = `
    <div class="tweet__header">
      <img src="${tweet.profilePicture || 'https://i.pinimg.com/736x/62/01/0d/62010d848b790a2336d1542fcda51789.jpg'}" 
           class="tweet__profile-pic" alt="Foto do perfil">
      <a href="./perfil.html?user=${tweet.userHandle}" class="tweet__username">${tweet.username}</a>
      ${tweet.verified === true ? `
        <svg class="verified-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#9b59b6" stroke-width="2" stroke-dasharray="4,4" />
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="#9b59b6"/>
        </svg>
      ` : ''}
      <span class="userhandle">@${tweet.userHandle}</span>
      <span class="tweet__platform">Lip Feito Em ${tweet.platform}</span>
    </div>
    <hr class="tweet__separator">
    ${renderMedia(tweet.mediaUrls)}
    <div class="tweet__content">
      ${parseContent(content)}
    </div>
    ${tweet.hashtags.length ? `<div class="tweet__hashtags">${tweet.hashtags.map(tag => `<a href="#" class="hashtag">#${tag}</a>`).join(' ')}</div>` : ''}
    <div class="tweet__actions">
      <button class="tweet__action" data-action="like" data-tweet-id="${tweet.id}" title="Curtir">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg> ${tweet.likes}
      </button>
      <button class="tweet__action" data-action="retweet" data-tweet-id="${tweet.id}" title="Repostar">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-repeat-2"><path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/></svg> ${tweet.retweets}
      </button>
      <button class="tweet__action" data-action="comment" data-tweet-id="${tweet.id}" title="Comentar">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-more"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg> (${tweet.comments.length})
      </button>
      <button class="tweet__action" data-action="share" data-tweet-id="${tweet.id}" title="Compartilhar">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-share-2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
      <button class="tweet__action" data-action="report" data-tweet-id="${tweet.id}" title="Reportar">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-warning"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v2"/><path d="M12 13h.01"/></svg>
      </button>
      ${tweet.userId === currentUser?.uid ? `
        <button class="tweet__action delete-button" data-action="delete" data-tweet-id="${tweet.id}">
         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
        </button>
      ` : ''}
    </div>
  `;
  tweetsContainer.appendChild(tweetElement);
};

const getPlatform = () => {
  const userAgent = navigator.userAgent;
  if (/windows/i.test(userAgent)) {
    return 'Windows | DKWeb';
  } else if (/iphone|ipad|ipod/i.test(userAgent)) {
    return 'iPhone | DKWeb';
  } else if (/macintosh|mac os x/i.test(userAgent)) {
    return 'Mac | DKWeb';
  } else if (/android/i.test(userAgent)) {
    return /wv/i.test(userAgent) ? 'Android | DKLite' : 'Android | DK';
  } else if (/linux/i.test(userAgent)) {
    return 'Linux | DKWeb';
  } else {
    return 'Outro';
  }
};

const renderMedia = (mediaUrls) => {
  return mediaUrls.map(url => `<a href="${url}" target="_blank"><img src="${url}" class="media-preview" alt="Mídia do tweet"></a>`).join('');
};

const setupTweetActions = () => {
  tweetsContainer.addEventListener('click', async (e) => {
    const actionButton = e.target.closest('[data-action]');
    if (!actionButton) return;

    const action = actionButton.getAttribute('data-action');
    const tweetId = actionButton.getAttribute('data-tweet-id');

    try {
      const tweetRef = db.collection('tweets').doc(tweetId);
      const tweetDoc = await tweetRef.get();
      const tweetData = tweetDoc.data();

      switch (action) {
        case 'like':
          // Verificar se o usuário já curtiu
          const userHasLiked = tweetData.likesUsers && tweetData.likesUsers.includes(currentUser.uid);
          
          if (userHasLiked) {
            // Se já curtiu, subtrai 1 e remove o usuário da lista
            await tweetRef.update({
              likes: tweetData.likes - 1,
              likesUsers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
          } else {
            // Se não curtiu, adiciona 1 e adiciona o usuário na lista
            await tweetRef.update({
              likes: tweetData.likes + 1,
              likesUsers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
          }
          break;

        case 'share':
          const shareUrl = `${window.location.origin}/feed/posts/${tweetId}`;
          await navigator.clipboard.writeText(shareUrl);
          showToast('Link copiado para a área de transferência!');
          break;

        case 'retweet':
          const hasRetweeted = tweetData.isRetweetedByUser && tweetData.isRetweetedByUser.includes(currentUser.uid);
        
          if (hasRetweeted) {
            // Remover repostagem
            await tweetRef.update({
              retweets: tweetData.retweets - 1,
              isRetweetedByUser: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
          } else {
            await handleRetweet(tweetData, tweetId);
            await tweetRef.update({
              retweets: tweetData.retweets + 1,
              isRetweetedByUser: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
          }
          break;

        case 'report':
          // Solicita confirmação do usuário
          if (confirm("Deseja realmente denunciar este tweet?")) {
            try {
              // Chama a função de verificação
              const isUnsafe = await analyzeContentWithGemini(tweetData.content, tweetData.mediaUrls);
              
              if (isUnsafe) {
                // Deleta o tweet do banco de dados
                await tweetRef.delete();
                showToast("Tweet deletado por conter conteúdo inadequado.");
              } else {
                showToast("Conteúdo não identificado como inadequado.", true);
              }
            } catch (error) {
              console.error("Erro ao analisar ou deletar o tweet:", error);
              showToast("Ocorreu um erro ao processar a denúncia.", true);
            }
          }
          break;

        case 'comment':
          await openCommentsModal(tweetId); // Abrir a modal de comentários
          break;

        default:
          break;
      }

      showToast(`Ação "${action}" realizada com sucesso!`);
      loadTweets(); // Recarrega os tweets para atualizar as contagens
    } catch (error) {
      showToast(`Erro ao realizar ação: ${error.message}`, true);
    }

    if (action === 'delete') {
      if (confirm("Tem certeza de que deseja excluir este post?")) {
        try {
          await db.collection('tweets').doc(tweetId).delete();
          showToast("Post deletado com sucesso!");
          loadTweets(); // Recarregar os tweets
        } catch (error) {
          showToast(`Erro ao deletar post: ${error.message}`, true);
        }
      }
    }
  });
};

const parseContent = (content) => {
  // Substitui **texto** por <strong>texto</strong> (negrito)
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Substitui *texto* por <em>texto</em> (itálico)
  content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Substitui ~~texto~~ por <s>texto</s> (tachado)
  content = content.replace(/~~(.*?)~~/g, '<s>$1</s>');

  // Substitui \n\n por </p><p> (parágrafo)
  content = content.replace(/\n\n/g, '</p><p>');

  // Adiciona <p> no início e no final para garantir que o conteúdo seja envolvido em parágrafos
  content = `<p>${content}</p>`;

  // Links para hashtags
  content = content.replace(/#([^\s#]+)/g, '<a href="#" class="hashtag">#$1</a>');

  // Links para menções (@usuário)
  content = content.replace(/@([^\s]+)/g, (match, username) => {
    return `<a href="/Perfil/?user=${encodeURIComponent(username)}" class="mention">@${username}</a>`;
  });

  return content;
};

const updateMediaPreview = () => {
  const previewContainer = document.querySelector('.media-preview');
  previewContainer.innerHTML = mediaInput.value
    .split(',')
    .map(url => url.trim())
    .filter(Boolean)
    .map(url => `<a href="${url}" target="_blank"><img src="${url}" class="media-preview-item"></a>`)
    .join('');
};

const extractHashtags = (content) => {
  return [...new Set(content.match(/#\w+/g) || [])].map(tag => tag.slice(1));
};

const updateHashtags = (hashtags) => {
  hashtags.forEach(tag => {
    hashtagsMap.set(tag, (hashtagsMap.get(tag) || 0) + 1);
  });
};

const renderTrendingHashtags = () => {
  const sortedHashtags = [...hashtagsMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  trendingHashtags.innerHTML = `
    <h2>O que está acontecendo</h2>
    ${sortedHashtags.map(([tag, count]) => `
      <div class="trending-item">
        <a href="#" class="hashtag">#${tag}</a>
        <span>${count} posts</span>
      </div>
    `).join('')}
  `;
};

const filterTweetsByHashtag = (hashtag) => {
  currentHashtagFilter = hashtag;
  loadTweets();
};

const clearForm = () => {
  tweetTextarea.value = '';
  mediaInput.value = '';
  updateCharacterCount();
  updateMediaPreview();
};

const showLoading = () => {
  document.querySelector('.loading-spinner').style.display = 'block';
};

const hideLoading = () => {
  document.querySelector('.loading-spinner').style.display = 'none';
};

const showToast = (message, isError = false) => {
  Toastify({
    text: message,
    duration: 3000,
    gravity: 'top',
    position: 'right',
    backgroundColor: isError ? '#e74c3c' : '#2ecc71'
  }).showToast();
};

const toggleNotificationsPanel = () => {
  notificationsPanel.style.display =
    notificationsPanel.style.display === 'block' ? 'none' : 'block';
};

// Função para abrir a modal de comentários e carregar os dados
const openCommentsModal = async (tweetId) => {
  try {
    commentsModal.setAttribute('data-tweet-id', tweetId);
    commentsList.innerHTML = '<p>Carregando comentários...</p>';
    const tweetRef = db.collection('tweets').doc(tweetId);
    const tweetDoc = await tweetRef.get();
    const tweetData = tweetDoc.data();

    if (!tweetData.comments || tweetData.comments.length === 0) {
      commentsList.innerHTML = '<p>Sem comentários ainda. Seja o primeiro!</p>';
    } else {
      commentsList.innerHTML = '';
      tweetData.comments.forEach(async (comment) => {
        const userDoc = await db.collection('users').doc(comment.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        renderComment(comment, userData);
      });
    }
    commentsModal.style.display = 'block';
  } catch (error) {
    showToast(`Erro ao carregar comentários: ${error.message}`, true);
  }
};

const renderComment = (comment, userData) => {
  const commentElement = document.createElement('div');
  commentElement.className = 'comment';
  commentElement.innerHTML = `
    <div class="comment__header">
      <img src="${userData.profilePicture || 'https://i.pinimg.com/736x/62/01/0d/62010d848b790a2336d1542fcda51789.jpg'}" class="comment__profile-pic" alt="Foto do perfil">
      <span class="comment__username">${userData.username || 'Usuário Anônimo'}</span>
    </div>
    <div class="comment__content">${comment.comment}</div>
    <hr>
  `;
  commentsList.appendChild(commentElement);
};

const handleRetweet = async (originalTweetData, originalTweetId) => {
  try {
    const originalUsername = originalTweetData.username;
    const originalContent = originalTweetData.content;
    const retweetContent = `Repostado de @${originalUsername}: "${originalContent}"`;
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data();

    await db.collection('tweets').add({
      content: retweetContent,
      mediaUrls: originalTweetData.mediaUrls,
      hashtags: originalTweetData.hashtags,
      likes: 0,
      likesUsers: [],
      retweets: 0,
      comments: [],
      userId: currentUser.uid,
      username: userData.username || 'Usuário Anônimo',
      profilePicture: userData.profilePicture || 'https://via.placeholder.com/50',
      verified: userData.verified === true,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      originalTweetId: originalTweetId
    });

    await db.collection('tweets').doc(originalTweetId).update({
      retweets: firebase.firestore.FieldValue.increment(1)
    });
    showToast('Tweet repostado com sucesso!');
    loadTweets();
  } catch (error) {
    showToast(`Erro ao repostar tweet: ${error.message}`, true);
  }
};

const addComment = async () => {
  const tweetId = commentsModal.getAttribute('data-tweet-id');
  const commentInput = document.querySelector('#commentInput');
  const commentText = commentInput.value.trim();
  if (!commentText) return showToast('O comentário não pode estar vazio.', true);
  if (!currentUser) return showToast('É necessário estar logado.', true);
  try {
    const newComment = {
      uid: currentUser.uid,
      comment: commentText
    };
    await db.collection('tweets').doc(tweetId).update({
      comments: firebase.firestore.FieldValue.arrayUnion(newComment)
    });
    commentInput.value = '';
    showToast('Comentário adicionado!');
    openCommentsModal(tweetId);
  } catch (error) {
    showToast(`Erro ao adicionar comentário: ${error.message}`, true);
  }
};

// ----------------------
// FUNÇÕES DE POLLS
// ----------------------

// Envia a enquete para o Firebase
const postPoll = async (e) => {
  e.preventDefault();
  showLoading();
  try {
    const question = pollQuestion.value.trim();
    const optionInputs = pollOptionsContainer.querySelectorAll('.poll-option');
    const options = [];
    optionInputs.forEach(input => {
      const text = input.value.trim();
      if (text) {
        options.push({ text, votes: 0 });
      }
    });
    if (!question || options.length < 2) {
      showToast('A enquete precisa de uma pergunta e pelo menos duas opções.', true);
      hideLoading();
      return;
    }

    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data();

    // Adiciona data de término (24 horas a partir de agora)
    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 24);

    await db.collection('polls').add({
      question,
      options,
      likes: 0,
      likesUsers: [],
      comments: [],
      userId: currentUser.uid,
      username: userData.username || 'Usuário Anônimo',
      userHandle: userData.userHandle || '@zuser.dksocial.space',
      profilePicture: userData.profilePicture || 'https://i.pinimg.com/736x/62/01/0d/62010d848b790a2336d1542fcda51789.jpg',
      verified: userData.verified === true,
      platform: getPlatform(),
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      endDate: endDate,
      isActive: true
    });

    pollForm.reset();
    pollOptionsContainer.innerHTML = `
      <input type="text" class="poll-option" placeholder="Opção 1" required>
      <input type="text" class="poll-option" placeholder="Opção 2" required>
    `;
    pollModal.style.display = 'none';
    showToast('Enquete postada com sucesso!');
    loadPolls();
  } catch (error) {
    showToast(`Erro ao postar enquete: ${error.message}`, true);
  } finally {
    hideLoading();
  }
};

// Carrega as polls do Firebase
const loadPolls = () => {
  db.collection('polls').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
    pollsContainer.innerHTML = '';
    snapshot.forEach(doc => {
      const poll = { id: doc.id, ...doc.data() };
      renderPoll(poll);
    });
  });
};

// Renderiza uma poll na interface
const renderPoll = (poll) => {
  const pollElement = document.createElement('div');
  pollElement.className = 'tweet';
  const timestamp = poll.timestamp ? poll.timestamp.toDate().toLocaleString() : '';
  const endDate = poll.endDate ? poll.endDate.toDate() : null;
  const isActive = poll.isActive && endDate && endDate > new Date();
  
  // Formata a data de término
  const formatEndDate = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = date - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  pollElement.innerHTML = `
    <div class="tweet__header">
      <img src="${poll.profilePicture || 'https://i.pinimg.com/736x/62/01/0d/62010d848b790a2336d1542fcda51789.jpg'}" 
           class="tweet__profile-pic" alt="Foto do perfil">
      <a href="./perfil.html?user=${poll.userHandle || poll.username}" class="tweet__username">${poll.username}</a>
      ${poll.verified === true ? `
        <svg class="verified-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#9b59b6" stroke-width="2" stroke-dasharray="4,4" />
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="#9b59b6"/>
        </svg>
      ` : ''}
      <span class="userhandle">@${poll.userHandle || poll.username}</span>
      <span class="tweet__platform">Poll Feito Em ${poll.platform || getPlatform()}</span>
    </div>
    <hr class="tweet__separator">
    <div class="tweet__content">
      <h3 class="tweet__question">${poll.question}</h3>
      <div class="tweet__poll-status">
        ${isActive ? 
          `<span class="poll-status active">Termina em: ${formatEndDate(endDate)}</span>` : 
          `<span class="poll-status ended">Enquete encerrada</span>`
        }
      </div>
      <div class="tweet__options">
        ${poll.options.map((option, index) => {
          const totalVotes = poll.options.reduce((acc, curr) => acc + curr.votes, 0);
          const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
          
          return `
            <div class="tweet__option">
              <div class="tweet__option-bar">
                <div class="tweet__option-text">${option.text}</div>
                <div class="tweet__option-votes">${option.votes} votos (${percentage.toFixed(1)}%)</div>
              </div>
              <div class="tweet__option-progress">
                <div class="tweet__option-progress-bar" style="width: ${percentage}%"></div>
              </div>
              ${isActive ? `
                <button class="tweet__vote-button" data-action="vote" data-poll-id="${poll.id}" data-option-index="${index}">
                  Votar
                </button>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
    <div class="tweet__actions">
      <button class="tweet__action" data-action="like" data-poll-id="${poll.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-thumbs-up"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg> ${poll.likes}
      </button>
      <button class="tweet__action" data-action="comment" data-poll-id="${poll.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-more"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg> (${poll.comments.length})
      </button>
      <button class="tweet__action" data-action="report" data-poll-id="${poll.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-warning"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v2"/><path d="M12 13h.01"/></svg>
      </button>
      ${poll.userId === currentUser?.uid ? `
        <button class="tweet__action delete-button" data-action="delete" data-poll-id="${poll.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
        </button>
      ` : ''}
    </div>
  `;
  pollsContainer.appendChild(pollElement);
};

// Lida com as ações na poll (votar, curtir e comentar)
const handlePollActions = async (e) => {
  const actionButton = e.target.closest('[data-action]');
  if (!actionButton) return;
  const action = actionButton.getAttribute('data-action');
  const pollId = actionButton.getAttribute('data-poll-id');
  const pollRef = db.collection('polls').doc(pollId);
  const pollDoc = await pollRef.get();
  const pollData = pollDoc.data();
  
  switch (action) {
    case 'vote':
      const optionIndex = parseInt(actionButton.getAttribute('data-option-index'));
      const updatedOptions = [...pollData.options];
      const userVotes = pollData.userVotes || {};
      
      // Verifica se o usuário já votou nesta opção
      if (userVotes[currentUser.uid] === optionIndex) {
        // Remove o voto
        updatedOptions[optionIndex].votes--;
        userVotes[currentUser.uid] = null;
        showToast('Voto removido!');
      } else {
        // Se o usuário já votou em outra opção, remove o voto anterior
        if (userVotes[currentUser.uid] !== undefined) {
          updatedOptions[userVotes[currentUser.uid]].votes--;
        }
        // Adiciona o novo voto
        updatedOptions[optionIndex].votes++;
        userVotes[currentUser.uid] = optionIndex;
        showToast('Voto computado!');
      }

      await pollRef.update({ 
        options: updatedOptions,
        userVotes: userVotes
      });
      break;

    case 'like':
      const userHasLiked = pollData.likesUsers && pollData.likesUsers.includes(currentUser.uid);
      if (userHasLiked) {
        await pollRef.update({
          likes: pollData.likes - 1,
          likesUsers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
        });
      } else {
        await pollRef.update({
          likes: pollData.likes + 1,
          likesUsers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
        });
      }
      break;

    case 'comment':
      await openCommentsModalPoll(pollId);
      break;

    case 'report':
      if (confirm("Deseja realmente denunciar esta enquete?")) {
        try {
          const isUnsafe = await analyzeContentWithGemini(pollData.question, []);
          if (isUnsafe) {
            await pollRef.delete();
            showToast("Enquete deletada por conter conteúdo inadequado.");
          } else {
            showToast("Conteúdo não identificado como inadequado.", true);
          }
        } catch (error) {
          console.error("Erro ao analisar ou deletar a enquete:", error);
          showToast("Ocorreu um erro ao processar a denúncia.", true);
        }
      }
      break;

    case 'delete':
      if (confirm("Tem certeza de que deseja excluir esta enquete?")) {
        try {
          await pollRef.delete();
          showToast("Enquete deletada com sucesso!");
          loadPolls();
        } catch (error) {
          showToast(`Erro ao deletar enquete: ${error.message}`, true);
        }
      }
      break;

    default:
      break;
  }
};

// Exemplo de função para abrir modal de comentários em polls (pode ser adaptada conforme sua interface)
const openCommentsModalPoll = async (pollId) => {
  try {
    commentsModal.setAttribute('data-poll-id', pollId);
    commentsList.innerHTML = '<p>Carregando comentários...</p>';
    const pollRef = db.collection('polls').doc(pollId);
    const pollDoc = await pollRef.get();
    const pollData = pollDoc.data();
    if (!pollData.comments || pollData.comments.length === 0) {
      commentsList.innerHTML = '<p>Sem comentários ainda. Seja o primeiro!</p>';
    } else {
      commentsList.innerHTML = '';
      pollData.comments.forEach(async (comment) => {
        const userDoc = await db.collection('users').doc(comment.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        renderComment(comment, userData);
      });
    }
    commentsModal.style.display = 'block';
  } catch (error) {
    showToast(`Erro ao carregar comentários: ${error.message}`, true);
  }
};

// Listener para ações na área de polls
pollsContainer.addEventListener('click', handlePollActions);

// Verificação de usuário banido ou não logado
auth.onAuthStateChanged((user) => {
  if (user) {
    const uid = user.uid;
    db.collection('users').doc(uid).get()
      .then((doc) => {
        if (doc.exists) {
          const userData = doc.data();
          if (userData.banned === true) {
            window.location.href = '/banned.html';
          } else {
            console.log('Usuário não está banido.');
          }
        } else {
          console.log('Documento do usuário não encontrado.');
        }
      })
      .catch((error) => {
        console.error('Erro ao buscar dados do usuário:', error);
      });
  } else {
    window.location.href = '/Log/';
  }
});

// Inicializa a aplicação ao carregar o DOM
document.addEventListener('DOMContentLoaded', initApp);

// Abre a modal de enquete
document.getElementById('createPollButton').addEventListener('click', () => {
  document.getElementById('pollModal').style.display = 'block';
});

// Fecha as modais ao clicar no "x" (botão fechar)
document.querySelectorAll('.close-modal').forEach(button => {
  button.addEventListener('click', (e) => {
    const targetModal = e.target.getAttribute('data-target');
    document.getElementById(targetModal).style.display = 'none';
  });
});

// Opcional: fecha a modal se clicar fora do conteúdo
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});

// Função para abrir a modal de polls
const openPollModal = () => {
  if (pollModal) {
    pollModal.style.display = 'block';
    // Limpa o formulário e adiciona duas opções iniciais
    if (pollForm) pollForm.reset();
    if (pollOptionsContainer) {
      pollOptionsContainer.innerHTML = `
        <input type="text" class="poll-option" placeholder="Opção 1" required>
        <input type="text" class="poll-option" placeholder="Opção 2" required>
      `;
    }
  }
};

// Função para fechar a modal de polls
const closePollModal = () => {
  if (pollModal) {
    pollModal.style.display = 'none';
  }
};

// Configuração dos event listeners para polls
const setupPollEventListeners = () => {
  // Abrir modal
  if (createPollButton) {
    createPollButton.addEventListener('click', () => {
      openPollModal();
    });
  }

  // Fechar modal
  const closePollButton = pollModal?.querySelector('.close-modal');
  if (closePollButton) {
    closePollButton.addEventListener('click', () => {
      closePollModal();
    });
  }

  // Fechar modal ao clicar fora
  window.addEventListener('click', (e) => {
    if (e.target === pollModal) {
      closePollModal();
    }
  });

  // Adicionar nova opção
  if (addOptionButton) {
    addOptionButton.addEventListener('click', () => {
      const optionCount = pollOptionsContainer?.querySelectorAll('.poll-option').length || 0;
      if (optionCount < 4) { // Limite de 4 opções
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'poll-option';
        newInput.placeholder = `Opção ${optionCount + 1}`;
        newInput.required = true;
        pollOptionsContainer?.appendChild(newInput);
      } else {
        showToast('Máximo de 4 opções permitidas.', true);
      }
    });
  }

  // Envio do formulário
  if (pollForm) {
    pollForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showLoading();
      try {
        const question = pollQuestion?.value.trim();
        const optionInputs = pollOptionsContainer?.querySelectorAll('.poll-option');
        const options = [];
        
        optionInputs?.forEach(input => {
          const text = input.value.trim();
          if (text) {
            options.push({ text, votes: 0 });
          }
        });

        if (!question || options.length < 2) {
          showToast('A enquete precisa de uma pergunta e pelo menos duas opções.', true);
          hideLoading();
          return;
        }

        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();

        await db.collection('polls').add({
          question,
          options,
          likes: 0,
          likesUsers: [],
          comments: [],
          userId: currentUser.uid,
          username: userData.username || 'Usuário Anônimo',
          profilePicture: userData.profilePicture || 'https://via.placeholder.com/50',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        closePollModal();
        showToast('Enquete criada com sucesso!');
        loadPolls();
      } catch (error) {
        showToast(`Erro ao criar enquete: ${error.message}`, true);
      } finally {
        hideLoading();
      }
    });
  }
};
