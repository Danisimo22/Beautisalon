/* --- ЛОГІКА ОНЛАЙН-ЗАПИСУ MLVCH --- */

let allPrices = []; // Глобальна змінна для цін

// 1. Завантажуємо ціни з бази при старті скрипта
async function fetchPrices() {
    try {
        const response = await fetch('http://localhost:3000/api/prices');
        allPrices = await response.json();
        console.log("Прайс-лист завантажено успішно");
    } catch (e) {
        console.error("Помилка завантаження цін:", e);
    }
}
fetchPrices();

// 2. Відкриття модалки з АВТОЗАПОВНЕННЯМ
function openModal() {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;

    modal.style.display = 'flex';

    const savedUser = localStorage.getItem('salon_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            const nameField = document.getElementById('user-name');
            const surnameField = document.getElementById('user-surname');
            const phoneField = document.getElementById('user-phone');

            if (nameField) nameField.value = user.name || '';
            if (surnameField) surnameField.value = user.surname || '';
            if (phoneField) phoneField.value = user.phone || '';
        } catch (e) {
            console.error("Помилка автозаповнення:", e);
        }
    }
}

// 3. Закриття модалки
function closeModal() {
    const modal = document.getElementById('booking-modal');
    if (modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('booking-modal');
    if (event.target == modal) closeModal();
}

// 4. Оновлення списку послуг (БЕЗ завантаження майстрів)
async function updateSubServices() {
    const category = document.getElementById('select-category').value;
    const serviceSelect = document.getElementById('select-service');
    const wrapper = document.getElementById('sub-service-wrapper');
    const priceDisplay = document.getElementById('price-display');
    const masterSelect = document.getElementById('select-master');

    if (!serviceSelect || !wrapper) return;

    // Очищаємо список послуг
    serviceSelect.innerHTML = '<option value="" disabled selected>Яка саме процедура?</option>';
    
    // Очищаємо майстрів, просимо спочатку обрати процедуру
    if (masterSelect) {
        masterSelect.innerHTML = '<option value="" disabled selected>Спочатку оберіть процедуру</option>';
    }
    
    // Фільтруємо прайс по категорії
    const filtered = allPrices.filter(p => p.category === category);
    
    filtered.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = p.name;
        option.dataset.price = p.price; 
        serviceSelect.appendChild(option);
    });

    // Показуємо вибір послуги
    wrapper.style.display = 'block';
    wrapper.classList.remove('hidden-element');
    if (priceDisplay) priceDisplay.style.display = 'none';
}

// 5. Відображення ціни ТА фільтрація майстрів за ПРОЦЕДУРОЮ
function displayPrice() {
    const serviceSelect = document.getElementById('select-service');
    const priceDisplay = document.getElementById('price-display');
    const priceSpan = document.getElementById('service-price');

    if (!serviceSelect || !priceSpan) return;

    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    const price = selectedOption.dataset.price;
    const serviceName = selectedOption.value; // Наприклад: "Френч манікюр"

    if (price) {
        priceSpan.textContent = price;
        if (priceDisplay) {
            priceDisplay.style.display = 'block';
            priceDisplay.classList.remove('hidden-element');
        }
        
        // Тепер шукаємо майстрів, які роблять саме цю процедуру!
        loadMastersForService(serviceName);
    }
}

// 6. Завантаження майстрів з перевіркою по базі
async function loadMastersForService(serviceName) {
    const masterSelect = document.getElementById('select-master');
    if (!masterSelect) return;

    masterSelect.innerHTML = '<option value="" disabled selected>Шукаємо майстрів...</option>';

    try {
        const response = await fetch('http://localhost:3000/api/masters');
        if (!response.ok) throw new Error();
        const allMasters = await response.json();

        masterSelect.innerHTML = '<option value="" disabled selected>Оберіть майстра</option>';

        // Фільтруємо: перевіряємо чи є "Френч манікюр" в масиві specialization
        const filteredMasters = allMasters.filter(m => {
            if (!m.specialization) return false;
            const specs = Array.isArray(m.specialization) ? m.specialization : [m.specialization];
            return specs.includes(serviceName); // Точний пошук по базі
        });

        if (filteredMasters.length === 0) {
            masterSelect.innerHTML = '<option disabled>На жаль, немає вільних майстрів</option>';
            return;
        }

        filteredMasters.forEach(m => {
            const option = document.createElement('option');
            option.value = m.name;
            option.textContent = m.name;
            masterSelect.appendChild(option);
        });

    } catch (e) {
        console.error("Помилка:", e);
        masterSelect.innerHTML = '<option disabled>Помилка з\'єднання</option>';
    }
}

// 7. Перевірка зайнятого часу
async function checkAvailableSlots() {
    const master = document.getElementById('select-master')?.value;
    const date = document.getElementById('booking-date')?.value;
    const timeSelect = document.getElementById('booking-time');

    if (!timeSelect) return;

    const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    timeSelect.innerHTML = '<option value="" disabled selected>Оберіть час</option>';
    
    hours.forEach(h => {
        const option = document.createElement('option');
        option.value = h;
        option.textContent = h;
        timeSelect.appendChild(option);
    });

    if (master && date) {
        try {
            const res = await fetch(`http://localhost:3000/api/busy-slots?master=${encodeURIComponent(master)}&date=${date}`);
            const busy = await res.json();

            Array.from(timeSelect.options).forEach(opt => {
                if (busy.includes(opt.value)) {
                    opt.disabled = true;
                    opt.textContent += " (Зайнято)";
                    opt.style.color = "#ccc";
                }
            });
        } catch (err) {
            console.error("Помилка слотів:", err);
        }
    }
}

// Слухачі подій
document.addEventListener('change', (e) => {
    if (e.target.id === 'select-master' || e.target.id === 'booking-date') {
        checkAvailableSlots();
    }
});

// 8. ВІДПРАВКА ФОРМИ ЗАПИСУ
document.getElementById('booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        name: document.getElementById('user-name').value,
        surname: document.getElementById('user-surname').value,
        phone: document.getElementById('user-phone').value,
        service: document.getElementById('select-service').value,
        master: document.getElementById('select-master').value,
        date: document.getElementById('booking-date').value,
        time: document.getElementById('booking-time').value
    };

    try {
        const response = await fetch('http://localhost:3000/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Запис успішно створено! Чекаємо на вас.');
            closeModal();
            e.target.reset();
            document.getElementById('sub-service-wrapper').style.display = 'none';
            document.getElementById('price-display').style.display = 'none';
        } else {
            const err = await response.json();
            alert(err.message || 'Помилка бронювання.');
        }
    } catch (error) {
        alert('Сервер недоступний. Спробуйте пізніше.');
    }
});