/* --- ГОЛОВНИЙ СКРИПТ АДМІН-ПАНЕЛІ (КЕРУВАННЯ ТА СТАТИСТИКА) --- */

// 1. Перемикання секцій (Меню)
function showSection(sectionId) {
    // Ховаємо всі секції
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Знімаємо активний клас з усіх кнопок навігації
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Показуємо потрібну секцію
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.style.display = 'block';
    }

    // Додаємо активний клас кнопці, на яку натиснули
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    // ЛОГІКА ЗАВАНТАЖЕННЯ ДАНИХ ДЛЯ КОНКРЕТНИХ СЕКЦІЙ
    if (sectionId === 'bookings') {
        if (typeof loadAllBookings === "function") {
            loadAllBookings();
        }
    }
    
    if (sectionId === 'dashboard') {
        loadDashboardStats();
    }

    if (sectionId === 'staff') {
        if (typeof loadStaffFinances === "function") {
            loadStaffFinances();
        }
    }

    if (sectionId === 'shop-manage') {
    loadAdminProducts();
    }

    if (sectionId === 'orders-manage') {
    loadAdminOrders();
    }

}


// 2. Завантаження статистики
async function loadDashboardStats() {
    try {
        // Завантажуємо ВСІ необхідні дані одним махом
        const [resBookings, resOrders, resProducts, resMasters] = await Promise.all([
            fetch('http://localhost:3000/api/admin/all-bookings'),
            fetch('http://localhost:3000/api/admin/all-orders'),
            fetch('http://localhost:3000/api/products'),
            fetch('http://localhost:3000/api/masters')
        ]);

        const bookings = await resBookings.json();
        const orders = await resOrders.json();
        const products = await resProducts.json();
        const masters = await resMasters.json();

        // Дати
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000; 
        const today = new Date(now - offset).toISOString().split('T')[0];

        // --- 1. ОПЕРАЦІЙНІ МЕТРИКИ (Ряд 1) ---
        const todayCount = bookings.filter(b => b.date === today).length;
        const newOrdersCount = orders.filter(o => o.status === 'Нове').length;
        const pendingCount = bookings.filter(b => b.status === 'pending' || b.status === 'Обробка').length;

        if (document.getElementById('today-bookings-count')) document.getElementById('today-bookings-count').textContent = todayCount;
        if (document.getElementById('new-orders-count')) document.getElementById('new-orders-count').textContent = newOrdersCount;
        if (document.getElementById('pending-bookings-count')) document.getElementById('pending-bookings-count').textContent = pendingCount;

        // --- 2. ФІНАНСИ МАГАЗИНУ ---
        let storeRevenue = 0;
        let storeCost = 0;

        orders.forEach(o => {
            if (o.status === 'Завершено') {
                storeRevenue += parseFloat(o.totalPrice) || 0;
                
                // Вираховуємо собівартість
                o.items.forEach(item => {
                    const prod = products.find(p => p.name === item.name);
                    const cost = prod ? (parseFloat(prod.costPrice) || 0) : 0;
                    storeCost += cost * item.quantity;
                });
            }
        });
        const storeProfit = storeRevenue - storeCost;

        // --- 3. ФІНАНСИ САЛОНУ ---
        let salonRevenue = 0;
        let salonPayroll = 0;

        bookings.forEach(b => {
            if (b.status === 'completed' || b.status === 'Завершено') {
                const price = parseFloat(b.price) || 0;
                salonRevenue += price;

                // Вираховуємо ЗП майстра (якщо його немає в базі - беремо 30% за замовчуванням)
                const master = masters.find(m => m.name === b.master);
                const percent = master ? (parseFloat(master.percent) || 30) : 30; 
                salonPayroll += price * (percent / 100);
            }
        });
        const salonProfit = salonRevenue - salonPayroll;

        // --- 4. ЗАГАЛЬНІ ФІНАНСИ ---
        const totalRevenue = storeRevenue + salonRevenue;
        const totalProfit = storeProfit + salonProfit;

        // Виводимо ОБОРОТ (Ряд 2)
        if (document.getElementById('total-combined-revenue')) document.getElementById('total-combined-revenue').textContent = totalRevenue.toFixed(0) + "€";
        if (document.getElementById('salon-revenue-total')) document.getElementById('salon-revenue-total').textContent = salonRevenue.toFixed(0) + "€";
        if (document.getElementById('store-revenue-total')) document.getElementById('store-revenue-total').textContent = storeRevenue.toFixed(0) + "€";

        // Виводимо ЧИСТИЙ ПРИБУТОК (Ряд 3)
        if (document.getElementById('total-combined-profit')) document.getElementById('total-combined-profit').textContent = totalProfit.toFixed(0) + "€";
        if (document.getElementById('salon-profit-total')) document.getElementById('salon-profit-total').textContent = salonProfit.toFixed(0) + "€";
        if (document.getElementById('store-profit-total')) document.getElementById('store-profit-total').textContent = storeProfit.toFixed(0) + "€";

        // --- МАЛЮВАННЯ ГРАФІКА ---
        renderRevenueChart(bookings, orders);

    } catch (e) {
        console.error("Помилка статистики:", e);
    }
}

// 3. Функція малювання подвійного графіка (Chart.js)
let myChart = null; 

function renderRevenueChart(bookings, orders) {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (myChart) myChart.destroy();

    // Створюємо масив останніх 7 днів (у форматі YYYY-MM-DD)
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        const localDate = new Date(d.getTime() - offset);
        localDate.setDate(localDate.getDate() - i);
        return localDate.toISOString().split('T')[0];
    }).reverse();

    // 1. Рахуємо виручку САЛОНУ (записи)
    const salonRevenue = last7Days.map(day => {
        return bookings
            .filter(b => b.date === day && (b.status === "completed" || b.status === "Завершено"))
            .reduce((sum, b) => sum + (parseFloat(b.price) || 0), 0);
    });

    // 2. Рахуємо виручку МАГАЗИНУ (замовлення)
    const storeRevenue = last7Days.map(day => {
        return orders
            .filter(o => {
                const orderDate = o.createdAt.split('T')[0];
                return orderDate === day && o.status === "Завершено";
            })
            .reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0);
    });

    // Будуємо графік з двома лініями
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days.map(d => d.split('-').reverse().slice(0, 2).join('.')), // дд.мм
            datasets: [
                {
                    label: 'Салон (Послуги) €',
                    data: salonRevenue,
                    borderColor: '#D1957B', // Бежево-коричневий колір MLVCH
                    backgroundColor: 'rgba(209, 149, 123, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#D1957B'
                },
                {
                    label: 'Магазин (Товари) €',
                    data: storeRevenue,
                    borderColor: '#27ae60', // Зелений колір
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#27ae60'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true, // Вмикаємо легенду, щоб було видно, де яка лінія
                    position: 'top'
                } 
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: '#f0f0f0' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// 4. Видалення запису
async function deleteBookingAdmin(id) {
    if (!confirm("Ви впевнені, що хочете видалити цей запис?")) return;

    try {
        const response = await fetch(`http://localhost:3000/api/cancel-booking/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            if (typeof loadAllBookings === "function") loadAllBookings();
            loadDashboardStats();
        } else {
            alert("Помилка при видаленні.");
        }
    } catch (e) {
        console.error("Сервер не відповідає:", e);
    }
}

// 5. Вихід
function logout() {
    localStorage.removeItem('salon_user');
    window.location.href = 'index.html';
}

// 6. Запуск при завантаженні сторінки
window.onload = () => {
    const savedUser = localStorage.getItem('salon_user');
    if (!savedUser) {
        window.location.href = 'index.html';
        return;
    }

    const user = JSON.parse(savedUser);
    if (user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    loadDashboardStats();
};

// Словник для перекладу статусів з бази даних (англійських) на українські
const statusMap = {
    "pending": "Обробка",
    "confirmed": "Підтверджено",
    "completed": "Завершено",
    "Обробка": "Обробка", // на випадок, якщо в базі вже є укр. слова
    "Підтверджено": "Підтверджено",
    "Завершено": "Завершено"
};

async function loadAdminBookings() {
    const container = document.getElementById('admin-bookings-list');
    const statusVal = document.getElementById('admin-status-filter')?.value || 'all';
    const searchVal = document.getElementById('admin-search')?.value.toLowerCase() || '';
    const dateVal = document.getElementById('admin-calendar-filter')?.value; // Формат YYYY-MM-DD
    const masterVal = document.getElementById('master-filter')?.value || 'all';

    try {
        const response = await fetch('http://localhost:3000/api/admin/all-bookings');
        let bookings = await response.json();

        // 1. ФІЛЬТРАЦІЯ
        bookings = bookings.filter(b => {
            // Перекладаємо статус перед перевіркою
            const ukrStatus = statusMap[b.status] || b.status;
            const matchesStatus = statusVal === 'all' || ukrStatus === statusVal;
            
            const fullName = `${b.name || ''} ${b.surname || ''}`.toLowerCase();
            const matchesSearch = fullName.includes(searchVal) || (b.phone && b.phone.includes(searchVal));
            const matchesMaster = masterVal === 'all' || b.master === masterVal;
            
            // Дата з бази вже у форматі YYYY-MM-DD, тому просто порівнюємо!
            let matchesDate = true;
            if (dateVal) {
                matchesDate = b.date === dateVal;
            }

            return matchesStatus && matchesSearch && matchesMaster && matchesDate;
        });

        // 2. СОРТУВАННЯ (Завершені в кінці + за датою)
        bookings.sort((a, b) => {
            const statusA = statusMap[a.status] || a.status;
            const statusB = statusMap[b.status] || b.status;

            // Пріоритет 1: "Завершено" падає вниз
            if (statusA === "Завершено" && statusB !== "Завершено") return 1;
            if (statusA !== "Завершено" && statusB === "Завершено") return -1;
            
            // Пріоритет 2: за датою (нові зверху)
            if (a.date !== b.date) {
                return b.date.localeCompare(a.date); 
            }
            // Пріоритет 3: за часом
            return b.time.localeCompare(a.time);
        });

        renderBookingsTable(bookings);
    } catch (e) { 
        console.error(e); 
        if (container) container.innerHTML = "<p>Помилка завантаження даних.</p>";
    }
}

function renderBookingsTable(bookings) {
    const container = document.getElementById('admin-bookings-list');
    
    if (bookings.length === 0) {
        container.innerHTML = "<p style='padding:20px; text-align:center;'>Записів не знайдено за цими критеріями.</p>";
        return;
    }

    let html = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>ДАТА</th>
                    <th>ЧАС</th>
                    <th>КЛІЄНТ</th>
                    <th>ПОСЛУГА (ЦІНА)</th>
                    <th>МАЙСТЕР</th>
                    <th>ТЕЛЕФОН</th>
                    <th>СТАТУС</th>
                    <th>ДІЇ</th>
                </tr>
            </thead>
            <tbody>`;

    bookings.forEach(b => {
        const ukrStatus = statusMap[b.status] || b.status;
        const isDone = ukrStatus === "Завершено";
        const isPending = ukrStatus === "Обробка";
        const isConfirmed = ukrStatus === "Підтверджено";

        let statusColorClass = "status-wait";
        if (isDone) statusColorClass = "status-done";
        if (isConfirmed) statusColorClass = "status-confirmed"; 

        html += `
            <tr style="${isDone ? 'opacity: 0.5;' : ''}">
                <td>${b.date}</td>
                <td>${b.time}</td>
                <td><strong>${b.name} ${b.surname || ''}</strong></td>
                <td>${b.service} <br><small>${b.price}€</small></td>
                <td>${b.master}</td>
                <td>${b.phone}</td>
                <td><span class="status-badge ${statusColorClass}">${ukrStatus}</span></td>
                <td>
                    ${isPending ? `<button onclick="confirmBooking('${b._id}')" class="btn-confirm">Підтвердити</button>` : ''}
                    ${isConfirmed ? `<button onclick="completeBooking('${b._id}')" class="btn-confirm" style="background:#27ae60;">Завершити</button>` : ''}
                    <button onclick="deleteBookingAdmin('${b._id}')" class="btn-delete">Видалити</button>
                </td>
            </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// Функції для зміни статусів (додай їх, якщо ще немає)
async function confirmBooking(id) {
    await fetch(`http://localhost:3000/api/admin/confirm-booking/${id}`, { method: 'PATCH' });
    loadAdminBookings();
    loadDashboardStats();
}

async function completeBooking(id) {
    await fetch(`http://localhost:3000/api/admin/complete-booking/${id}`, { method: 'PATCH' });
    loadAdminBookings();
    loadDashboardStats();
}