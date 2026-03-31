/* --- ЛОГІКА КЕРУВАННЯ МАГАЗИНОМ В АДМІНЦІ --- */

// 1. Завантаження товарів у таблицю (режим редагування)
async function loadAdminProducts() {
    const listContainer = document.getElementById('admin-products-list');
    const catList = document.getElementById('category-list');
    if (!listContainer) return;

    try {
        const response = await fetch('http://localhost:3000/api/products');
        const products = await response.json();

        // --- РОЗРАХУНОК ФІНАНСОВОЇ СТАТИСТИКИ СКЛАДУ ---
        let totalCost = 0;    // Скільки витрачено на закупівлю
        let totalRevenue = 0; // Скільки отримаємо при продажі

        products.forEach(p => {
            const stock = p.stock || 0;
            const cost = p.costPrice || 0;
            const price = p.price || 0;

            totalCost += (stock * cost);
            totalRevenue += (stock * price);
        });

        const totalProfit = totalRevenue - totalCost;

        // Виводимо в картки
        const costElem = document.getElementById('total-stock-cost');
        const revElem = document.getElementById('total-stock-revenue');
        const profitElem = document.getElementById('total-stock-profit');

        if (costElem) costElem.textContent = totalCost.toFixed(2) + '€';
        if (revElem) revElem.textContent = totalRevenue.toFixed(2) + '€';
        if (profitElem) profitElem.textContent = totalProfit.toFixed(2) + '€';
        // ------------------------------------------------

        // Оновлюємо список категорій для випадаючого списку (datalist)
        if (catList) {
            const categories = [...new Set(products.map(p => p.category))].filter(c => c);
            catList.innerHTML = categories.map(c => `<option value="${c}">`).join('');
        }

        let html = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Фото</th>
                        <th>Назва</th>
                        <th>Категорія</th>
                        <th>Ціна (€)</th>
                        <th>Собівартість (€)</th>
                        <th>Склад (шт)</th>
                        <th>Дії</th>
                    </tr>
                </thead>
                <tbody id="editable-products-body">`;

        products.forEach(p => {
            html += `
                <tr data-id="${p._id}">
                    <td><img src="img/shop/${p.image}" width="40" style="border-radius: 5px; height: 40px; object-fit: cover;"></td>
                    <td><input type="text" class="edit-name" value="${p.name}" style="width: 100%;"></td>
                    <td><input type="text" class="edit-category" value="${p.category}" style="width: 100%;"></td>
                    <td><input type="number" class="edit-price" value="${p.price}" style="width: 70px;"></td>
                    <td><input type="number" class="edit-cost" value="${p.costPrice || 0}" style="width: 70px;"></td>
                    <td><input type="number" class="edit-stock" value="${p.stock}" style="width: 70px;"></td>
                    <td>
                        <button class="btn-delete-admin" onclick="deleteProduct('${p._id}')" title="Видалити товар назавжди">❌</button>
                    </td>
                </tr>`;
        });

        html += '</tbody></table>';
        listContainer.innerHTML = html;
    } catch (e) {
        console.error("Помилка завантаження товарів:", e);
        listContainer.innerHTML = "<p style='color:red; padding: 20px;'>Помилка завантаження товарів з сервера.</p>";
    }
}

// 2. Додавання ОДНОГО нового товару
async function handleProductAdd(event) {
    event.preventDefault();
    
    const productData = {
        name: document.getElementById('prod-name').value,
        category: document.getElementById('prod-category').value,
        price: Number(document.getElementById('prod-price').value),
        costPrice: Number(document.getElementById('prod-cost').value), 
        stock: Number(document.getElementById('prod-stock').value),
        image: document.getElementById('prod-image').value || "no-photo.png"
    };

    try {
        const response = await fetch('http://localhost:3000/api/admin/add-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });

        if (response.ok) {
            if (typeof showToast === "function") showToast("Товар успішно додано!");
            event.target.reset();
            loadAdminProducts(); 
        } else {
            const err = await response.json();
            if (typeof showToast === "function") showToast("Помилка: " + err.error, true);
        }
    } catch (e) {
        if (typeof showToast === "function") showToast("Сервер не відповідає.", true);
    }
}

// 3. МАСОВЕ ЗБЕРЕЖЕННЯ всіх змін у таблиці
async function saveAllProductChanges() {
    const rows = document.querySelectorAll('#editable-products-body tr');
    const updates = [];

    rows.forEach(row => {
        updates.push({
            id: row.getAttribute('data-id'),
            name: row.querySelector('.edit-name').value,
            category: row.querySelector('.edit-category').value,
            price: Number(row.querySelector('.edit-price').value),
            costPrice: Number(row.querySelector('.edit-cost').value), 
            stock: Number(row.querySelector('.edit-stock').value)
        });
    });

    if (updates.length === 0) return;

    try {
        const response = await fetch('http://localhost:3000/api/admin/update-products-bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates })
        });

        if (response.ok) {
            if (typeof showToast === "function") showToast("Всі зміни успішно збережено!");
            loadAdminProducts(); 
        } else {
            if (typeof showToast === "function") showToast("Помилка при збереженні змін на сервері.", true);
        }
    } catch (e) {
        console.error(e);
        if (typeof showToast === "function") showToast("Помилка мережі при масовому збереженні.", true);
    }
}

// 4. Видалення товару
async function deleteProduct(id) {
    if (!confirm("Ви впевнені, що хочете видалити цей товар назавжди?")) return;
    
    try {
        const response = await fetch(`http://localhost:3000/api/admin/delete-product/${id}`, { 
            method: 'DELETE' 
        });
        
        if (response.ok) {
            if (typeof showToast === "function") showToast("Товар видалено.");
            loadAdminProducts();
        } else {
            if (typeof showToast === "function") showToast("Не вдалося видалити товар.", true);
        }
    } catch (e) { 
        if (typeof showToast === "function") showToast("Помилка при видаленні.", true);
    }
}