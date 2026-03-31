/* --- ЛОГІКА АКАУНТА: ВХІД, РЕЄСТРАЦІЯ ТА ПРОФІЛЬ --- */

// 1. Функція для відображення/приховування пароля
function togglePassword(inputId, imgId) {
    const passwordInput = document.getElementById(inputId);
    const toggleImg = document.getElementById(imgId);

    if (!passwordInput || !toggleImg) return;

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleImg.src = "img/hide.png"; 
    } else {
        passwordInput.type = "password";
        toggleImg.src = "img/view.png"; 
    }
}

// 2. Пошук записів за номером телефону (без логіну - швидкий перегляд)
async function getMyBookings() {
    const phoneInput = document.getElementById('search-phone');
    const resultDiv = document.getElementById('bookings-result');
    
    if (!phoneInput || !resultDiv) return;
    const phone = phoneInput.value.trim();

    if (!phone) {
        alert("Будь ласка, введіть номер телефону");
        return;
    }

    resultDiv.innerHTML = "<p>Шукаємо ваші записи...</p>";

    try {
        const response = await fetch(`http://localhost:3000/api/my-bookings?phone=${encodeURIComponent(phone)}`);
        const bookings = await response.json();

        if (bookings.length === 0) {
            resultDiv.innerHTML = "<p style='color: #888;'>Записів не знайдено.</p>";
            return;
        }

        let html = '<h4 style="margin-top:20px;">Ваші візити:</h4>';
        bookings.forEach(b => {
            html += `
                <div class="booking-item">
                    <p><strong>${b.date}</strong> о ${b.time} — ${b.service} (${b.master})</p>
                </div>`;
        });
        resultDiv.innerHTML = html;
    } catch (error) {
        alert("Помилка з’єднання з сервером.");
    }
}

// 3. Реєстрація нового користувача
async function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const surname = document.getElementById('reg-surname').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPass = document.getElementById('confirm-password').value;

    if (!name || !surname || !phone || !password) {
        alert("Заповніть усі поля!");
        return;
    }

    if (password !== confirmPass) {
        alert("Паролі не збігаються!");
        return;
    }

    const userData = { name, surname, phone, password };

    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            alert('Реєстрація успішна! Тепер увійдіть у свій акаунт.');
            location.reload(); 
        } else {
            const error = await response.json();
            alert(error.message || "Помилка реєстрації");
        }
    } catch (error) {
        alert("Сервер не відповідає.");
    }
}

// 4. Функція ВХОДУ (Login)
// 4. Функція ВХОДУ (спрацьовує при натисканні кнопки)
async function handleLogin() {
    const phone = document.getElementById('search-phone').value.trim();
    const password = document.getElementById('login-password')?.value; 

    if (!phone || !password) {
        alert("Введіть телефон та пароль!");
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phone, password })
        });

        const result = await response.json();

        if (response.ok) {
            // Зберігаємо ПОВНИЙ об'єкт (включаючи роль: admin або client)
            localStorage.setItem('salon_user', JSON.stringify(result.user));
            
            // Викликаємо перевірку, щоб відразу перенаправити адміна
            checkAuth(); 
        } else {
            alert(result.message || "Невірні дані для входу");
        }
    } catch (error) {
        alert("Помилка авторизації. Перевірте сервер.");
    }
}


// 5. Завантаження записів та ПІДРАХУНОК СУМИ (З ВІДОБРАЖЕННЯМ СТАТУСУ)
async function loadUserBookings(phone) {
    const activeResult = document.getElementById('profile-bookings-result');
    const historyResult = document.getElementById('profile-history-result');
    const totalPriceSpan = document.getElementById('total-bookings-price');
    
    if (!activeResult || !historyResult) return;

    try {
        const response = await fetch(`http://localhost:3000/api/my-bookings?phone=${encodeURIComponent(phone)}&t=${Date.now()}`);
        const bookings = await response.json();

        let activeHtml = '';
        let historyHtml = '';
        let totalSum = 0;

        bookings.forEach(b => {
            const priceVal = parseFloat(b.price) || 0;
            const priceDisplay = b.price ? `${b.price}€` : "---";

            // Якщо статус "completed", відправляємо в історію
            if (b.status === "completed") {
                historyHtml += `
                    <div class="booking-item history-item" style="opacity: 0.7; border-left-color: #bdc3c7;">
                        <div class="booking-info">
                            <span style="color: #888;">${b.date}</span>
                            <strong style="text-decoration: line-through;">${b.service}</strong>
                            <p>Майстер: ${b.master} | <span style="color: #27ae60;">Візит завершено</span></p>
                        </div>
                        <div class="booking-price-box">
                            <span class="booking-price">${priceDisplay}</span>
                        </div>
                    </div>`;
            } else {
                // Всі інші статуси (pending, confirmed) - в активні
                totalSum += priceVal;
                const isConfirmed = b.status === "confirmed";
                const statusText = isConfirmed ? "Підтверджено" : "В обробці";
                const statusColor = isConfirmed ? "#27ae60" : "#f1c40f";

                activeHtml += `
                    <div class="booking-item">
                        <div class="booking-info">
                            <div>
                                <span style="color: #888;">${b.date} о ${b.time}</span>
                                <span style="margin-left:10px; font-size:11px; font-weight:700; color:${statusColor}; text-transform:uppercase;">
                                    ● ${statusText}
                                </span>
                            </div>
                            <strong>${b.service}</strong>
                            <p>Майстер: ${b.master}</p>
                        </div>
                        <div class="booking-price-box">
                            <span class="booking-price">${priceDisplay}</span>
                        </div>
                        <button onclick="cancelBooking('${b._id}')" class="btn-cancel">Скасувати</button>
                    </div>`;
            }
        });

        activeResult.innerHTML = activeHtml || "<p class='empty-msg'>У вас немає активних записів.</p>";
        historyResult.innerHTML = historyHtml || "<p class='empty-msg'>Історія порожня.</p>";
        
        if (totalPriceSpan) totalPriceSpan.textContent = totalSum;

    } catch (e) {
        console.error("Помилка:", e);
    }
}

// 6. Скасування запису
async function cancelBooking(id) {
    if (!confirm("Ви впевнені, що хочете скасувати цей візит?")) return;

    try {
        const response = await fetch(`http://localhost:3000/api/cancel-booking/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert("Запис скасовано.");
            const user = JSON.parse(localStorage.getItem('salon_user'));
            loadUserBookings(user.phone); // Оновлюємо список без перезавантаження сторінки
        } else {
            alert("Не вдалося скасувати запис.");
        }
    } catch (e) {
        alert("Помилка з'єднання з сервером.");
    }
}

// 7. Оновлення профілю (Email та Адреса)
async function updateProfile() {
    const phone = document.getElementById('user-display-phone').textContent;
    const email = document.getElementById('user-email').value.trim();
    const address = document.getElementById('user-address').value.trim();

    try {
        const response = await fetch('http://localhost:3000/api/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, email, address })
        });

        if (response.ok) {
            // Оновлюємо дані в localStorage
            const userData = JSON.parse(localStorage.getItem('salon_user'));
            userData.email = email;
            userData.address = address;
            localStorage.setItem('salon_user', JSON.stringify(userData));

            alert('Дані успішно збережено!');
        }
    } catch (e) {
        alert('Помилка при збереженні.');
    }
}

// Вихід
function logout() {
    localStorage.removeItem('salon_user');
    location.reload();
}



/* --- ЄДИНА ТА ПРАВИЛЬНА ПЕРЕВІРКА АВТОРИЗАЦІЇ --- */
function checkAuth() {
    const savedUser = localStorage.getItem('salon_user');
    const authContainer = document.getElementById('auth-container');
    const profile = document.getElementById('user-profile');
    
    if (savedUser) {
        const user = JSON.parse(savedUser);
        
        // 1. ПЕРЕВІРКА РОЛІ (Якщо адмін - миттєво тікаємо звідси на admin.html)
        if (user.role === 'admin') {
            console.log("Виявлено адміна! Перенаправлення...");
            window.location.href = 'admin.html';
            return;
        }

        // 2. ЯКЩО КЛІЄНТ (Показуємо профіль)
        if (profile) {
            if (authContainer) authContainer.style.display = 'none';
            profile.style.display = 'block';
            
            document.getElementById('welcome-name').textContent = user.name.toUpperCase();
            document.getElementById('user-display-phone').textContent = user.phone;
            
            // Заповнюємо Email та Адресу
            if(document.getElementById('user-email')) document.getElementById('user-email').value = user.email || '';
            if(document.getElementById('user-address')) document.getElementById('user-address').value = user.address || '';
            
            // 1. Завантажуємо візити (манікюр тощо)
            loadUserBookings(user.phone);

            // 2. !!! ДОДАЙ ЦЕЙ РЯДОК, ЩОБ ЗАМОВЛЕННЯ ТОВАРІВ ТАКОЖ ЗАВАНТАЖИЛИСЯ !!!
            loadUserOrders(user.phone);
        }
    }
}

// Запуск при завантаженні сторінки
window.addEventListener('DOMContentLoaded', checkAuth);

async function loadUserOrders(phone) {
    const activeResult = document.getElementById('profile-orders-active');
    const historyResult = document.getElementById('profile-orders-history');
    if (!activeResult || !historyResult) return;

    try {
        const response = await fetch(`http://localhost:3000/api/my-orders?phone=${encodeURIComponent(phone)}`);
        const orders = await response.json();

        let activeHtml = '';
        let historyHtml = '';

        orders.forEach(order => {
            const statusColors = {
                "Нове": "#f1c40f", "Пакується": "#3498db", "Відправлено": "#9b59b6",
                "Завершено": "#27ae60", "Скасовано клієнтом": "#e74c3c"
            };
            const color = statusColors[order.status] || "#D1957B";
            const itemsList = order.items.map(i => `${i.name} (x${i.quantity})`).join(', ');
            const date = new Date(order.createdAt).toLocaleDateString('uk-UA');
            const canCancel = order.status === 'Нове' || order.status === 'Пакується';

            const card = `
                <div class="booking-item" style="border-left: 5px solid ${color};">
                    <div class="booking-info">
                        <span>Замовлення від ${date}</span>
                        <strong>${itemsList}</strong>
                        <p>Сума: <strong>${order.totalPrice}€</strong></p>
                    </div>
                    <div style="text-align: right;">
                        <div class="order-status-badge" style="background: ${color}; color: white; margin-bottom: 10px;">
                            ${order.status}
                        </div>
                        ${canCancel ? `<button onclick="cancelOrder('${order._id}')" class="btn-cancel">Скасувати</button>` : ''}
                    </div>
                </div>
            `;

            // Розподіл по контейнерах
            if (order.status === "Завершено" || order.status === "Скасовано клієнтом") {
                historyHtml += card;
            } else {
                activeHtml += card;
            }
        });

        activeResult.innerHTML = activeHtml || "<p class='empty-msg'>Немає активних замовлень.</p>";
        historyResult.innerHTML = historyHtml || "<p class='empty-msg'>Історія замовлень порожня.</p>";
    } catch (e) { console.error(e); }
}

async function cancelOrder(orderId) {
    if (!confirm("Ви впевнені, що хочете скасувати замовлення? Товари повернуться на склад.")) return;

    try {
        const response = await fetch(`http://localhost:3000/api/orders/cancel/${orderId}`, {
            method: 'PATCH'
        });

        if (response.ok) {
            alert("Замовлення скасовано!");
            const user = JSON.parse(localStorage.getItem('salon_user'));
            loadUserOrders(user.phone); // Оновлюємо список
        } else {
            const err = await response.json();
            alert(err.message);
        }
    } catch (e) {
        alert("Помилка зв'язку з сервером.");
    }
}

function toggleSection(id) {
    const content = document.getElementById(id);
    const header = content.previousElementSibling.querySelector('span');
    
    if (content.style.display === "none") {
        content.style.display = "block";
        header.textContent = "▲"; // Стрілочка вгору
    } else {
        content.style.display = "none";
        header.textContent = "▼"; // Стрілочка вниз
    }
}