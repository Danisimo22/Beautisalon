/* --- ЛОГІКА КОШИКА ТА ОПЛАТИ MLVCH (ПОВНА ВЕРСІЯ) --- */

// 1. Завантаження товарів у таблицю кошика
function loadCart() {
    const cart = JSON.parse(sessionStorage.getItem('cart')) || {};
    const cartItems = document.getElementById('cart-items');
    const cartContent = document.getElementById('cart-content');
    const emptyMessage = document.getElementById('empty-cart-message');
    let total = 0;

    if (!cartItems) return;
    cartItems.innerHTML = '';

    const productNames = Object.keys(cart);
    
    // Перевірка на порожній кошик
    if (productNames.length === 0) {
        if (emptyMessage) emptyMessage.style.display = 'block';
        if (cartContent) cartContent.style.display = 'none';
        return;
    } else {
        if (emptyMessage) emptyMessage.style.display = 'none';
        if (cartContent) cartContent.style.display = 'block';
    }

    productNames.forEach(name => {
        const item = cart[name];
        const itemPrice = parseFloat(item.price) || 0;
        const subtotal = itemPrice * item.quantity;
        total += subtotal;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="procudt-name-td">
                    <img src="${item.image}" width="50" style="border-radius: 5px; margin-right: 10px;"> 
                    <span>${name}</span>
                </div>
            </td>
            <td>${itemPrice}€</td>
            <td>
                <div class="quantity-controls" style="display: flex; align-items: center; gap: 10px;">
                    <button onclick="changeQty('${name}', -1)" class="qty-btn">-</button>
                    <span style="font-weight: bold; min-width: 20px; text-align: center;">${item.quantity}</span>
                    <button onclick="changeQty('${name}', 1)" class="qty-btn">+</button>
                </div>
            </td>
            <td>${subtotal.toFixed(2)}€</td>
            <td>
                <button onclick="removeFromCart('${name}')" class="btn-delete-small" title="Видалити" style="background:none; border:none; cursor:pointer; font-size: 18px;">🗑️</button>
            </td>
        `;
        cartItems.appendChild(row);
    });

    const totalPriceElement = document.getElementById('total-price');
    if (totalPriceElement) {
        totalPriceElement.innerText = total.toFixed(2);
    }
}

// 2. Зміна кількості товару
async function changeQty(name, delta) {
    let cart = JSON.parse(sessionStorage.getItem('cart')) || {};
    if (!cart[name]) return;

    // Якщо натиснули "+", перевіряємо актуальний склад на сервері
    if (delta > 0) {
        try {
            const response = await fetch('http://localhost:3000/api/products');
            const products = await response.json();
            const realProduct = products.find(p => p.name === name);

            if (realProduct && cart[name].quantity >= realProduct.stock) {
                showToast(`Вибачте, на складі всього ${realProduct.stock} шт. Більше додати не можна.`, true);
                return; // Зупиняємо функцію
            }
        } catch (e) {
            console.error("Не вдалося перевірити склад:", e);
        }
    }

    // Змінюємо кількість
    cart[name].quantity += delta;

    // Якщо кількість 0 - видаляємо (але тут без сповіщення, бо користувач просто клікав мінус)
    if (cart[name].quantity <= 0) {
        delete cart[name];
    }

    sessionStorage.setItem('cart', JSON.stringify(cart));
    loadCart(); // Перемальовуємо таблицю
}

// 3. Видалення товару з кошика (ТЕПЕР БЕЗ ПІДТВЕРДЖЕННЯ)
function removeFromCart(name) {
    let cart = JSON.parse(sessionStorage.getItem('cart')) || {};
    delete cart[name];
    sessionStorage.setItem('cart', JSON.stringify(cart));
    loadCart();
    
    // Показуємо червоне сповіщення про видалення
    if (typeof showToast === "function") {
        showToast(`Товар видалено з кошика`, true); 
    }
}

// 4. Логіка кнопки "Перейти до оплати" з АВТОЗАПОВНЕННЯМ
document.getElementById('checkout-button')?.addEventListener('click', function () {
    const checkoutForm = document.getElementById('checkout-form');
    const checkoutBtn = document.getElementById('checkout-button');

    if (checkoutForm) checkoutForm.style.display = 'block';
    if (checkoutBtn) checkoutBtn.style.display = 'none';

    // АВТОЗАПОВНЕННЯ: беремо дані з профілю користувача
    const savedUser = localStorage.getItem('salon_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            const nameField = document.getElementById('name');
            const phoneField = document.getElementById('telephone');
            const emailField = document.getElementById('email');

            if (nameField) nameField.value = `${user.name || ''} ${user.surname || ''}`.trim();
            if (phoneField) phoneField.value = user.phone || '';
            if (emailField && user.email) emailField.value = user.email;
        } catch (e) {
            console.error("Помилка автозаповнення:", e);
        }
    }
});

// 5. Керування способом оплати
function toggleCardInfo() {
    const paymentMethod = document.getElementById('payment-method')?.value;
    const cardInfo = document.getElementById('card-info');
    if (cardInfo) {
        cardInfo.style.display = (paymentMethod === 'credit-card') ? 'block' : 'none';
    }
}
document.getElementById('payment-method')?.addEventListener('change', toggleCardInfo);

// 6. Фінальна обробка форми та відправка на сервер
document.getElementById('payment-form')?.addEventListener('submit', async function (event) {
    event.preventDefault();

    const paymentMethod = document.getElementById('payment-method').value;

    // Валідація картки
    if (paymentMethod === 'credit-card') {
        const cardNumber = document.getElementById('card-number').value;
        const expDate = document.getElementById('expiration-date').value;
        const cvv = document.getElementById('cvv').value;

        if (!/^\d{16}$/.test(cardNumber) || !/^\d{2}\/\d{2}$/.test(expDate) || !/^\d{3}$/.test(cvv)) {
            showToast('Будь ласка, перевірте правильність даних карти (16 цифр, MM/YY, 3 цифри CVV).', true);
            return;
        }
    }

    // Виклик функції завершення транзакції
    await completeTransaction();
});

// 7. Відправка замовлення в базу даних
async function completeTransaction() {
    const cart = JSON.parse(sessionStorage.getItem('cart')) || {};
    
    const orderData = {
        customerName: document.getElementById('name').value,
        phone: document.getElementById('telephone').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        paymentMethod: document.getElementById('payment-method').value,
        totalPrice: parseFloat(document.getElementById('total-price').innerText),
        items: Object.keys(cart).map(name => ({
            name: name,
            quantity: cart[name].quantity,
            price: cart[name].price
        }))
    };

    try {
        const response = await fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            sessionStorage.removeItem('cart'); // Очищуємо кошик у браузері
            
            // Ховаємо елементи інтерфейсу
            document.getElementById('cart-content').style.display = 'none';
            document.getElementById('checkout-form').style.display = 'none';
            
            // Показуємо успіх
            const successMsg = document.getElementById('success-message');
            if (successMsg) successMsg.style.display = 'block';
            
            console.log("Замовлення збережено, кількість товару оновлено в БД.");
        } else {
            showToast("Помилка на сервері при оформленні замовлення.", true);
        }
    } catch (e) {
        console.error("Помилка відправки замовлення:", e);
        showToast("Не вдалося з'єднатися з сервером.", true);
    }
}

// Запуск завантаження
window.addEventListener('DOMContentLoaded', loadCart);

function addToCart(productId) {
    const product = allProducts.find(p => p._id === productId);
    if (!product || product.stock <= 0) return; // Захист від додавання 0 залишку

    let cart = JSON.parse(sessionStorage.getItem('cart')) || {};

    if (cart[product.name]) {
        // Перевіряємо, щоб не додати більше, ніж є в базі
        if (cart[product.name].quantity < product.stock) {
            cart[product.name].quantity += 1;
            if (typeof showToast === "function") showToast("Кількість збільшено!");
        } else {
            if (typeof showToast === "function") showToast(`Вибачте, на складі залишилося лише ${product.stock} шт.`, true);
            return;
        }
    } else {
        cart[product.name] = {
            price: product.price,
            image: `img/shop/${product.image}`,
            quantity: 1,
            maxStock: product.stock // Запам'ятовуємо максимум для кошика
        };
        if (typeof showToast === "function") showToast("Товар успішно додано у кошик!");
    }
    sessionStorage.setItem('cart', JSON.stringify(cart));
}