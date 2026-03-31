/* --- 1. ГАЛЕРЕЯ: ОБМІН КАРТИНКАМИ МІСЦЯМИ --- */
function swapImages(smallImg) {
    const mainImg = document.getElementById('main-photo');
    if (mainImg && smallImg) {
        const tempSrc = mainImg.src;
        mainImg.src = smallImg.src;
        smallImg.src = tempSrc;
    }
}

/* --- 2. МОДАЛЬНЕ ВІКНО: ЗАПИС --- */
function openModal() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Забороняємо скрол
    }
}

function closeModal() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Повертаємо скрол
    }
}

// Закриття модалки при кліку на фон (сіру зону)
window.onclick = function(event) {
    const bookingModal = document.getElementById('booking-modal');
    const portfolioOverlay = document.querySelector('.portfolio-overlay');

    if (event.target == bookingModal) {
        closeModal();
    }
};

/* --- 3. СЛАЙДЕР КОМАНДИ (SWIPER) --- */
if (document.querySelector('.team-slider')) {
    const teamSwiper = new Swiper('.team-slider', {
        slidesPerView: 4, 
        spaceBetween: 20, 
        loop: true,
        pagination: {
            el: '.team-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.team-next',
            prevEl: '.team-prev',
        },
        breakpoints: {
            320: { slidesPerView: 1 },
            768: { slidesPerView: 2 },
            1024: { slidesPerView: 4 }
        }
    });
}


/* --- 5. ПОРТФОЛІО: POPUP ГАЛЕРЕЯ --- */
document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.querySelector('.popup-gallery');
    if (!gallery) return;

    const links = Array.from(gallery.querySelectorAll('a'));
    let currentIndex = 0;

    const overlay = document.createElement('div');
    overlay.className = 'portfolio-overlay';
    
    const popupImg = document.createElement('img');
    popupImg.className = 'portfolio-popup-img';
    
    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-portfolio-popup';
    closeBtn.innerHTML = '&times;';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'nav-btn prev-btn';
    prevBtn.innerHTML = '&#10094;'; 
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'nav-btn next-btn';
    nextBtn.innerHTML = '&#10095;'; 

    overlay.append(closeBtn, prevBtn, nextBtn, popupImg);
    document.body.appendChild(overlay);

    function updateImage(index) {
        currentIndex = index;
        popupImg.src = links[currentIndex].getAttribute('href');
    }

    links.forEach((link, index) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            updateImage(index);
            overlay.classList.add('show');
        });
    });

    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let index = currentIndex - 1;
        if (index < 0) index = links.length - 1;
        updateImage(index);
    });

    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let index = currentIndex + 1;
        if (index >= links.length) index = 0;
        updateImage(index);
    });

    const closePopup = () => overlay.classList.remove('show');

    closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });

    document.addEventListener('keydown', (e) => {
        if (!overlay.classList.contains('show')) return;
        if (e.key === 'Escape') closePopup();
        if (e.key === 'ArrowLeft') prevBtn.click();
        if (e.key === 'ArrowRight') nextBtn.click();
    });
});

/* --- 6. ДОДАТКОВІ ЕФЕКТИ ШАПКИ --- */
window.addEventListener('scroll', () => {
    const header = document.querySelector('#main-header');
    if (header) {
        if (window.scrollY > 50) {
            header.style.height = '60px';
            header.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
        } else {
            header.style.height = '70px';
            header.style.boxShadow = 'none';
        }
    }
});
// Функція для показу красивих сповіщень
window.showToast = function(message, isError = false) {
    // Створюємо елемент
    const toast = document.createElement('div');
    toast.className = `mlvch-toast ${isError ? 'error' : ''}`;
    toast.textContent = message;

    // Додаємо на сторінку
    document.body.appendChild(toast);

    // Плавна поява (даємо браузеру 10 мілісекунд, щоб відмалювати елемент)
    setTimeout(() => toast.classList.add('show'), 10);

    // Плавне зникнення через 3 секунди
    setTimeout(() => {
        toast.classList.remove('show');
        // Видаляємо з коду сторінки після завершення анімації
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
};