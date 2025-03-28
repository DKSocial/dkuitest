// sw.js
const CACHE_NAME = "offline-v1";
const OFFLINE_URL = "offline.html"; // Nome da página de offline

// Instala o Service Worker e armazena a página offline em cache
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([OFFLINE_URL, "/", "/index.html"]); // Adicione outros assets necessários
        })
    );
});

// Intercepta as requisições para verificar se está offline
self.addEventListener("fetch", (event) => {
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Se offline, retorna a página de offline
                return caches.match(OFFLINE_URL);
            })
        );
    } else {
        // Para outros recursos (CSS, JS, imagens), use o cache
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    }
});
