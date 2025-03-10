document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("imageInput");
    const mediaInput = document.querySelector("[data-js='media-url-input']"); // Usando querySelector com data-js

    if (imageInput && mediaInput) {
        imageInput.addEventListener("change", handleImageUpload);
    } else {
        console.error("Elementos não encontrados na página!");
    }
});

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/dwhnhrdjh/image/upload"; // Seu Cloud Name
const CLOUDINARY_UPLOAD_PRESET = "DKSocial"; // Seu Upload Preset configurado no Cloudinary

const uploadImageToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(CLOUDINARY_UPLOAD_URL, {
            method: "POST",
            body: formData,
        });

        const data = await response.json();
        if (data.secure_url) {
            return data.secure_url; // Retorna a URL da imagem no Cloudinary
        } else {
            throw new Error("Erro ao fazer upload da imagem no Cloudinary");
        }
    } catch (error) {
        console.error("Erro no upload:", error);
        return null;
    }
};

const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(); // Função para mostrar carregamento

    const imgUrl = await uploadImageToCloudinary(file);
    if (imgUrl) {
        mediaInput.value = imgUrl; // Adiciona a URL da imagem no input de mídia
        updateMediaPreview(imgUrl); // Atualiza a pré-visualização da mídia
    } else {
        showToast("Erro ao enviar a imagem para o Cloudinary", true);
    }

    hideLoading(); // Função para ocultar carregamento
};
