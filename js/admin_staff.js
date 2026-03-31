/* --- ЛОГІКА ФІНАНСІВ ТА СПІВРОБІТНИКІВ (ПОВНА ВЕРСІЯ) --- */

async function loadStaffFinances() {
    const container = document.getElementById('staff-list');
    const monthSelect = document.getElementById('salary-month-filter');
    const dayInput = document.getElementById('salary-day-filter');

    if (!container || !monthSelect || !dayInput) return;

    // 1. Пріоритет фільтрації: якщо вибрано конкретний день — рахуємо за день, 
    // якщо ні — беремо вибраний місяць. Якщо і місяць порожній — поточний.
    let selectedDay = dayInput.value; // "2026-03-28"
    let selectedMonth = monthSelect.value; // "03"

    if (!selectedMonth && !selectedDay) {
        selectedMonth = new Date().toISOString().split('-')[1]; // Поточний місяць
        monthSelect.value = selectedMonth;
    }

    container.innerHTML = "<p style='padding:20px;'>Розрахунок фінансових показників...</p>";

    // Налаштування зарплат майстрів
    const staffSettings = {
        "Вікторія Лисенко": { base: 200, percent: 40 },
        "Марія Ковальчук": { base: 200, percent: 40 },
        "Дмитро Бондар": { base: 150, percent: 35 },
        "Анна Морозова": { base: 150, percent: 35 },
        "Катерина Мельник": { base: 100, percent: 30 },
        "default": { base: 100, percent: 30 }
    };

    try {
        const bookingsRes = await fetch('http://localhost:3000/api/admin/all-bookings');
        const allBookings = await bookingsRes.json();
        
        const pricesRes = await fetch('http://localhost:3000/api/prices');
        const prices = await pricesRes.json();

        // Отримуємо список унікальних майстрів
        const masters = [...new Set(allBookings.map(b => b.master))].filter(m => m);
        
        let salonRevenue = 0;
        let salonPayroll = 0;
        let html = '';

      masters.forEach(masterName => {
    // 1. Фільтруємо записи майстра згідно з обраними фільтрами (день або місяць)
    const masterFilteredBookings = allBookings.filter(b => {
        const isMaster = b.master === masterName;
        const matchMonth = b.date.split('-')[1] === selectedMonth;
        const matchDay = b.date === selectedDay;

        return selectedDay ? (isMaster && matchDay) : (isMaster && matchMonth);
    });

    // 2. Тільки завершені візити для розрахунку грошей
    const completed = masterFilteredBookings.filter(b => b.status === "completed");
    
    let masterRevenue = 0;
    completed.forEach(b => {
        const serviceInfo = prices.find(p => p.name.trim().toLowerCase() === b.service.trim().toLowerCase());
        masterRevenue += serviceInfo ? serviceInfo.price : 40;
    });

    // 3. Отримуємо налаштування (ставка + %)
    const settings = staffSettings[masterName] || staffSettings["default"];
    
    // 4. Розрахунок зарплати
    const salaryFromPercent = (masterRevenue * settings.percent / 100);
    // Якщо вибрано день — тільки %, якщо місяць — ставка + %
    const salaryTotal = selectedDay ? salaryFromPercent : (settings.base + salaryFromPercent);

    salonRevenue += masterRevenue;
    salonPayroll += salaryTotal;

    // 5. Список записів для внутрішньої частини картки (деталі)
    let bookingsListHtml = masterFilteredBookings.map(b => {
        let statusIcon = '⏳';
        if (b.status === 'completed') statusIcon = '✅';
        if (b.status === 'confirmed') statusIcon = '📅';

        return `
        <div class="staff-booking-row ${b.status}">
            <span>${b.date.split('-').reverse().join('.')}</span>
            <span>${b.time}</span>
            <span style="font-weight:600;">${b.service}</span>
            <span>${statusIcon}</span>
            ${b.status === 'confirmed' ? 
                `<button onclick="completeBookingFromStaff('${b._id}')" class="mini-btn">Виконати</button>` : ''}
        </div>`;
    }).join('');

    // 6. Формування HTML картки з динамічним відсотком
    html += `
        <div class="staff-card">
            <div class="staff-header" onclick="this.parentElement.classList.toggle('open')">
                <div class="staff-info">
                    <h3>${masterName} ▾</h3>
                    <p>${selectedDay ? 
                        `Зарплата за день (<strong>${settings.percent}%</strong>)` : 
                        `Ставка ${settings.base}€ + <strong>${settings.percent}%</strong>`
                    }</p>
                </div>
                <div class="staff-total">
                    <span class="salary-val">${salaryTotal.toFixed(2)}€</span>
                </div>
            </div>
            <div class="staff-details">
                <div class="staff-money-stats">
                    <p>Оборот: <strong>${masterRevenue}€</strong></p>
                    <p>Завершено візитів: <strong>${completed.length}</strong></p>
                </div>
                <div class="staff-bookings-list">
                    <h4>Деталі записів:</h4>
                    ${bookingsListHtml || '<p>Записів немає</p>'}
                </div>
            </div>
        </div>`;
});
        container.innerHTML = html || "<p style='padding:20px;'>Немає даних для відображення.</p>";

        // Оновлюємо верхні картки статистики
        document.getElementById('total-salon-revenue').textContent = salonRevenue + "€";
        document.getElementById('total-salon-payroll').textContent = salonPayroll.toFixed(2) + "€";
        document.getElementById('total-salon-profit').textContent = (salonRevenue - salonPayroll).toFixed(2) + "€";

    } catch (e) {
        console.error(e);
        container.innerHTML = "<p style='color:red; padding:20px;'>Помилка завантаження фінансів.</p>";
    }
}

// Допоміжна функція для швидкого завершення запису прямо з вкладки стафу
async function completeBookingFromStaff(id) {
    if (!confirm("Клієнт завершив візит?")) return;
    try {
        const response = await fetch(`http://localhost:3000/api/admin/complete-booking/${id}`, {
            method: 'PATCH'
        });
        if (response.ok) {
            loadStaffFinances(); // Оновлюємо фінанси
        }
    } catch (e) {
        alert("Помилка при оновленні статусу.");
    }
}

// Функція скидання фільтрів
function resetStaffFilters() {
    document.getElementById('salary-day-filter').value = "";
    document.getElementById('salary-month-filter').value = new Date().toISOString().split('-')[1];
    loadStaffFinances();
}

// Ініціалізація при завантаженні
document.addEventListener('DOMContentLoaded', () => {
    // Встановлюємо сьогоднішню дату в календар за замовчуванням (опціонально)
    // document.getElementById('salary-day-filter').value = new Date().toISOString().split('T')[0];
});