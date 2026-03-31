/* --- ЛОГІКА РОБОТИ З РОЗКЛАДОМ (ЗАПИСАМИ) --- */

let allBookingsCache = [];

// 1. Завантаження всіх записів із сервера
async function loadAllBookings() {
    const listContainer = document.getElementById('admin-bookings-list');
    if (!listContainer) return;

    try {
        // Додаємо timestamp, щоб уникнути кешування браузером
        const response = await fetch(`http://localhost:3000/api/admin/all-bookings?t=${Date.now()}`);
        allBookingsCache = await response.json();
        
        renderBookingsTable(allBookingsCache);
        loadMastersToFilter(); 
    } catch (e) {
        console.error("Помилка завантаження:", e);
        listContainer.innerHTML = "<p style='color:red; padding:20px;'>Помилка завантаження даних з сервера.</p>";
    }
}

// 2. Відмальовування таблиці
function renderBookingsTable(data) {
    const listContainer = document.getElementById('admin-bookings-list');
    if (!listContainer) return;

    if (data.length === 0) {
        listContainer.innerHTML = "<p style='padding:20px; color:#888;'>Записів не знайдено за цими критеріями.</p>";
        return;
    }

    let html = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Час</th>
                    <th>Клієнт</th>
                    <th>Послуга (Ціна)</th>
                    <th>Майстер</th>
                    <th>Телефон</th>
                    <th>Статус</th>
                    <th>Дії</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(b => {
        // Обробка імені (якщо старі записи без ПІБ)
        const fullName = (b.name && b.surname) ? `${b.name} ${b.surname}` : "Гість (не вказано)";
        
        // Ціна з сервера (яку ми "підклеїли" в server.js)
        const priceDisplay = b.price ? `${b.price}€` : "40€";

        // Визначення тексту та класу статусу
        let statusText = "Обробка";
        let statusClass = "status-pending";

        if (b.status === "confirmed") {
            statusText = "Підтверджено";
            statusClass = "status-confirmed";
        } else if (b.status === "completed") {
            statusText = "Завершено";
            statusClass = "status-completed";
        }

        // Логіка відображення кнопок
        let actionButtons = "";
        if (b.status === "pending" || !b.status) {
            actionButtons = `<button class="btn-confirm-admin" onclick="confirmBookingAdmin('${b._id}')">Підтвердити</button>`;
        } else if (b.status === "confirmed") {
            actionButtons = `<button class="btn-complete-admin" onclick="completeBookingAdmin('${b._id}')">Виконано</button>`;
        }

        html += `
            <tr class="${b.status === 'completed' ? 'row-completed' : ''}">
                <td>${b.date}</td>
                <td>${b.time}</td>
                <td>${fullName}</td>
                <td>
                    ${b.service}
                    <span style="display:block; font-size:11px; color:#D1957B; font-weight:700;">${priceDisplay}</span>
                </td>
                <td>${b.master}</td>
                <td><a href="tel:${b.phone}" style="text-decoration:none; color:inherit;">${b.phone}</a></td>
                <td class="${statusClass}"><strong>${statusText}</strong></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        ${actionButtons}
                        <button class="btn-delete-admin" onclick="deleteBookingAdmin('${b._id}')" title="Видалити запис">Видалити</button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    listContainer.innerHTML = html;
}

// 3. ПІДТВЕРДЖЕННЯ ЗАПИСУ (Зміна на confirmed)
async function confirmBookingAdmin(id) {
    try {
        const response = await fetch(`http://localhost:3000/api/admin/confirm-booking/${id}`, {
            method: 'PATCH'
        });
        if (response.ok) {
            loadAllBookings(); // Перемальовуємо все
        }
    } catch (e) {
        alert("Помилка при підтвердженні візиту");
    }
}

// 4. ЗАВЕРШЕННЯ ВІЗИТУ (Зміна на completed -> йде в зарплату)
// Зміни функцію завершення візиту
async function completeBookingAdmin(id) {
    if (!confirm("Завершити візит?")) return;
    try {
        const response = await fetch(`http://localhost:3000/api/admin/complete-booking/${id}`, {
            method: 'PATCH'
        });
        if (response.ok) {
            // Замість повного перевантаження, просто оновимо дані в кеші
            const res = await fetch('http://localhost:3000/api/admin/all-bookings');
            allBookingsCache = await res.json();
            
            // ВИКЛИКАЄМО applyFilters замість чистого render, щоб зберегти дату!
            applyFilters(); 
            
            if (typeof loadDashboardStats === "function") loadDashboardStats();
        }
    } catch (e) {
        alert("Помилка");
    }
}

// Те саме зроби для confirmBookingAdmin
async function confirmBookingAdmin(id) {
    try {
        const response = await fetch(`http://localhost:3000/api/admin/confirm-booking/${id}`, {
            method: 'PATCH'
        });
        if (response.ok) {
            const res = await fetch('http://localhost:3000/api/admin/all-bookings');
            allBookingsCache = await res.json();
            applyFilters(); // Зберігаємо фільтр
        }
    } catch (e) {
        alert("Помилка");
    }
}



// 6. ЗАСТОСУВАННЯ ФІЛЬТРІВ (Календар + Майстер)
function applyFilters() {
    const dateValue = document.getElementById('admin-calendar-filter').value;
    const masterValue = document.getElementById('master-filter').value;

    let filtered = allBookingsCache;

    // Фільтр по даті (якщо обрано в календарі)
    if (dateValue) {
        filtered = filtered.filter(b => b.date === dateValue);
    }

    // Фільтр по майстру
    if (masterValue && masterValue !== 'all') {
        filtered = filtered.filter(b => b.master === masterValue);
    }

    renderBookingsTable(filtered);
}

// 7. ЗАВАНТАЖЕННЯ СПИСКУ МАЙСТРІВ У ФІЛЬТР
async function loadMastersToFilter() {
    const masterSelect = document.getElementById('master-filter');
    if (!masterSelect) return;

    // Беремо унікальних майстрів з усіх наявних записів
    const uniqueMasters = [...new Set(allBookingsCache.map(b => b.master))].filter(m => m);
    
    masterSelect.innerHTML = '<option value="all">Всі майстри</option>';
    uniqueMasters.forEach(master => {
        const option = document.createElement('option');
        option.value = master;
        option.textContent = master;
        masterSelect.appendChild(option);
    });
}

// Функції-прослойки для подій HTML (onchange)
function loadBookingsByDate() { applyFilters(); }
function loadBookingsByMaster() { applyFilters(); }