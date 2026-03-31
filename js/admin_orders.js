/* --- ЛОГІКА КЕРУВАННЯ ЗАМОВЛЕННЯМИ В АДМІНЦІ --- */

async function loadAdminOrders() {
    const container = document.getElementById('admin-orders-list');
    if (!container) return;

    // Отримуємо значення фільтрів
    const searchVal = document.getElementById('order-search')?.value.toLowerCase() || '';
    const statusVal = document.getElementById('order-status-filter')?.value || 'all';
    const dateVal = document.getElementById('order-date-filter')?.value; 

    const statusColors = {
        "Нове": "#f1c40f",
        "Пакується": "#3498db",
        "Відправлено": "#9b59b6",
        "Завершено": "#27ae60",
        "Скасовано клієнтом": "#e74c3c",
        "Скасовано адміністратором": "#e74c3c" 
    };

    try {
        // Завантажуємо замовлення ТА товари (щоб знати собівартість)
        const [ordersResponse, productsResponse] = await Promise.all([
            fetch('http://localhost:3000/api/admin/all-orders'),
            fetch('http://localhost:3000/api/products')
        ]);
        
        let orders = await ordersResponse.json();
        const products = await productsResponse.json();

        // 1. ФІЛЬТРАЦІЯ
        orders = orders.filter(o => {
            const matchesSearch = o.customerName.toLowerCase().includes(searchVal) || o.phone.includes(searchVal);
            
            let matchesStatus = false;
            if (statusVal === 'all') {
                matchesStatus = true;
            } else if (statusVal === 'Скасовано клієнтом') {
                matchesStatus = o.status.includes('Скасовано');
            } else {
                matchesStatus = o.status === statusVal;
            }

            let matchesDate = true;
            if (dateVal) {
                const orderDate = o.createdAt.split('T')[0];
                matchesDate = orderDate === dateVal;
            }

            return matchesSearch && matchesStatus && matchesDate;
        });

        // --- НОВЕ: РОЗРАХУНОК ФІНАНСІВ ---
        let totalRevenue = 0;
        let totalCost = 0;
        let completedCount = 0;

        orders.forEach(o => {
            // Рахуємо гроші ТІЛЬКИ з успішно завершених замовлень
            if (o.status === 'Завершено') {
                totalRevenue += parseFloat(o.totalPrice) || 0;
                completedCount++;
                
                // Вираховуємо собівартість кожного товару в замовленні
                o.items.forEach(item => {
                    const prod = products.find(p => p.name === item.name);
                    const cost = prod ? (parseFloat(prod.costPrice) || 0) : 0;
                    totalCost += cost * item.quantity;
                });
            }
        });

        const netProfit = totalRevenue - totalCost;
        const avgCheck = completedCount > 0 ? (totalRevenue / completedCount) : 0;

        // Виводимо в HTML (картки)
        const revElem = document.getElementById('orders-total-revenue');
        const profitElem = document.getElementById('orders-net-profit');
        const avgElem = document.getElementById('orders-avg-check');

        if (revElem) revElem.textContent = totalRevenue.toFixed(2) + '€';
        if (profitElem) profitElem.textContent = netProfit.toFixed(2) + '€';
        if (avgElem) avgElem.textContent = avgCheck.toFixed(2) + '€';
        // ----------------------------------

        if (orders.length === 0) {
            container.innerHTML = "<p style='padding: 20px; text-align:center;'>Замовлень за цими критеріями не знайдено.</p>";
            return;
        }

        // 2. СОРТУВАННЯ ЗА ПРІОРИТЕТОМ
        const statusPriority = {
            "Нове": 1,
            "Пакується": 2,
            "Відправлено": 3,
            "Завершено": 4,
            "Скасовано клієнтом": 5,
            "Скасовано адміністратором": 5
        };

        orders.sort((a, b) => {
            const prioA = statusPriority[a.status] || 99;
            const prioB = statusPriority[b.status] || 99;
            if (prioA !== prioB) return prioA - prioB;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // 3. ВІДОБРАЖЕННЯ
        let html = `
            <div style="margin-bottom: 15px; display: flex; gap: 15px; align-items: center; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #eee;">
                <button onclick="selectCanceledOrders()" style="background: #f39c12; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                    ☑️ Вибрати всі скасовані
                </button>
                <button onclick="deleteSelectedOrders()" style="background: #e74c3c; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                    🗑️ Видалити вибрані
                </button>
                <span style="color: #777; font-size: 13px;">(Видалення назавжди без повернення на склад)</span>
            </div>

            <table class="admin-table">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">
                            <input type="checkbox" id="selectAllOrders" onchange="toggleAllOrders(this)" style="transform: scale(1.5); cursor: pointer;">
                        </th>
                        <th>Дата</th>
                        <th>Клієнт / Телефон</th>
                        <th>Товари</th>
                        <th>Сума</th>
                        <th>Оплата</th>
                        <th>Статус</th>
                        <th>Дії</th>
                    </tr>
                </thead>
                <tbody>`;

        orders.forEach(order => {
            const items = order.items.map(i => `${i.name} (x${i.quantity})`).join('<br>');
            const date = new Date(order.createdAt).toLocaleDateString('uk-UA');
            const currentColor = statusColors[order.status] || "#333";
            const isCanceled = order.status.includes('Скасовано');
            const isDone = order.status === 'Завершено';

            html += `
                <tr style="${isCanceled || isDone ? 'opacity: 0.6;' : ''}">
                    <td style="text-align: center;">
                        <input type="checkbox" class="order-checkbox" value="${order._id}" data-status="${order.status}" style="transform: scale(1.5); cursor: pointer;">
                    </td>
                    <td>${date}</td>
                    <td><strong>${order.customerName}</strong><br>${order.phone}</td>
                    <td style="font-size: 12px;">${items}</td>
                    <td><strong>${order.totalPrice}€</strong></td>
                    <td>${order.paymentMethod === 'cash' ? '💵 Готівка' : '💳 Карта'}</td>
                    <td>
                        ${isCanceled ? 
                            `<div style="color: ${currentColor}; font-weight: bold; padding: 5px;">❌ ${order.status}</div>` 
                            : 
                            `<select onchange="updateOrderStatus('${order._id}', this.value)" 
                                    class="order-status-select" 
                                    style="border: 2px solid ${currentColor}; color: ${currentColor};">
                                <option value="Нове" ${order.status === 'Нове' ? 'selected' : ''}>Нове</option>
                                <option value="Пакується" ${order.status === 'Пакується' ? 'selected' : ''}>Пакується</option>
                                <option value="Відправлено" ${order.status === 'Відправлено' ? 'selected' : ''}>Відправлено</option>
                                <option value="Завершено" ${order.status === 'Завершено' ? 'selected' : ''}>Завершено</option>
                            </select>`
                        }
                    </td>
                    <td style="text-align: center;">
                        ${!isCanceled && !isDone ? 
                            `<button onclick="cancelOrderAdmin('${order._id}')" class="btn-delete-admin" style="background:#e67e22;" title="Скасувати та повернути товари на склад">🚫 Скасувати</button>` 
                            : '<span style="color:#aaa; font-size: 12px;">Недоступно</span>'}
                    </td>
                </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = "<p style='color:red;'>Помилка завантаження даних.</p>";
    }
}

// Зміна статусу вручну
async function updateOrderStatus(id, newStatus) {
    try {
        const response = await fetch(`http://localhost:3000/api/admin/update-order-status/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (response.ok) {
            if (typeof showToast === "function") showToast("Статус оновлено!");
            loadAdminOrders();
        }
    } catch (e) { 
        if (typeof showToast === "function") showToast("Помилка сервера.", true); 
    }
}

// СКАСУВАННЯ АДМІНОМ (З ПОВЕРНЕННЯМ НА СКЛАД)
async function cancelOrderAdmin(id) {
    if (!confirm("Ви впевнені, що хочете скасувати замовлення? Всі товари автоматично повернуться на склад!")) return;
    try {
        const response = await fetch(`http://localhost:3000/api/admin/cancel-order/${id}`, { method: 'PATCH' });
        if (response.ok) {
            if (typeof showToast === "function") showToast("Замовлення скасовано, товари повернуто.");
            loadAdminOrders();
        } else {
            if (typeof showToast === "function") showToast("Не вдалося скасувати.", true);
        }
    } catch (e) { 
        if (typeof showToast === "function") showToast("Помилка сервера.", true); 
    }
}

/* --- ЛОГІКА МАСОВОГО ВИДАЛЕННЯ (ЧЕКБОКСИ) --- */

function toggleAllOrders(sourceCheckbox) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = sourceCheckbox.checked;
    });
}

function selectCanceledOrders() {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
        const status = cb.getAttribute('data-status');
        cb.checked = status.includes('Скасовано');
    });
    const selectAll = document.getElementById('selectAllOrders');
    if (selectAll) selectAll.checked = false;
}

async function deleteSelectedOrders() {
    const checkedBoxes = document.querySelectorAll('.order-checkbox:checked');
    const idsToDelete = Array.from(checkedBoxes).map(cb => cb.value);

    if (idsToDelete.length === 0) {
        if (typeof showToast === "function") showToast("Виберіть хоча б одне замовлення!", true);
        else alert("Будь ласка, поставте галочку хоча б біля одного замовлення!");
        return;
    }

    if (!confirm(`Ви дійсно хочете назавжди видалити ${idsToDelete.length} замовлень? Товари НЕ повернуться на склад.`)) {
        return;
    }

    try {
        for (const id of idsToDelete) {
            await fetch(`http://localhost:3000/api/admin/delete-order/${id}`, { method: 'DELETE' });
        }
        if (typeof showToast === "function") showToast("Вибрані замовлення успішно видалено!");
        else alert("Вибрані замовлення успішно видалено!");
        loadAdminOrders(); 
    } catch (e) {
        if (typeof showToast === "function") showToast("Сталася помилка при видаленні.", true);
        else alert("Сталася помилка при видаленні.");
    }
}