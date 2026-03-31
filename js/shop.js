let allProducts = []; // Тут зберігатимемо товари з БД

async function loadProducts() {
    try {
        const response = await fetch('http://localhost:3000/api/products');
        allProducts = await response.json();
        displayProducts(allProducts);
    } catch (e) {
        console.error("Помилка завантаження товарів:", e);
        document.getElementById('products-container').innerHTML = "<p>Не вдалося завантажити товари.</p>";
    }
}

function displayProducts(products) {
    const container = document.getElementById('products-container');
    container.innerHTML = "";

    products.forEach(p => {
        const isOutOfStock = p.stock <= 0; // Перевірка залишку
        const productDiv = document.createElement('div');
        
        // Додаємо клас out-of-stock, якщо товару немає
        productDiv.className = `product ${p.category} ${isOutOfStock ? 'out-of-stock' : ''}`;
        
        productDiv.innerHTML = `
            <img id="product-photo" src="img/shop/${p.image}" alt="${p.name}">
            
            <button class="add-to-cart-btn" onclick="addToCart('${p._id}')" ${isOutOfStock ? 'disabled' : ''}>
                <img src="img/sell.png">
            </button>
            
            <div class="product-name">
                <p id="product-name">${p.name} ${isOutOfStock ? '<span class="sold-out-text">(Немає в наявності)</span>' : ''}</p>
                <p id="product-price">${p.price}€</p>
            </div>
        `;
        container.appendChild(productDiv);
    });
}

// Об'єднана функція: одночасно застосовує і фільтр категорій, і сортування цін
function applyFiltersAndSort() {
    // 1. Отримуємо значення з обох списків
    const filterValue = document.getElementById("filter-select").value;
    const sortValue = document.getElementById("sort-select").value;

    // Робимо копію масиву, щоб не зіпсувати оригінальний
    let result = [...allProducts];

    // 2. Спочатку фільтруємо за категорією
    if (filterValue !== "all") {
        result = result.filter(p => p.category.trim() === filterValue.trim());
    }

    // 3. Потім сортуємо те, що залишилося (використовуємо parseFloat, щоб ціна точно була числом)
    if (sortValue === "price-asc") {
        result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sortValue === "price-desc") {
        result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    }

    // 4. Відображаємо готовий результат
    displayProducts(result);
}

// Тепер і зміна фільтру, і зміна сортування викликають одну спільну функцію
function sortProducts() {
    applyFiltersAndSort();
}

function filterProducts() {
    applyFiltersAndSort();
}

// Додавання в кошик
function addToCart(productId) {
    const product = allProducts.find(p => p._id === productId);
    if (!product || product.stock <= 0) {
        if (typeof showToast === "function") showToast("Товару немає в наявності!", true);
        return;
    }

    let cart = JSON.parse(sessionStorage.getItem('cart')) || {};

    if (cart[product.name]) {
        if (cart[product.name].quantity < product.stock) {
            cart[product.name].quantity += 1;
            if (typeof showToast === "function") showToast(`Додано! У кошику: ${cart[product.name].quantity}`);
        } else {
            if (typeof showToast === "function") showToast(`Досягнуто ліміту складу (${product.stock} шт.)`, true);
            return;
        }
    } else {
        cart[product.name] = {
            price: product.price,
            image: `img/shop/${product.image}`,
            quantity: 1,
            maxStock: product.stock 
        };
        if (typeof showToast === "function") showToast("Товар додано у кошик!");
    }
    
    sessionStorage.setItem('cart', JSON.stringify(cart));
}

// Запуск при завантаженні
document.addEventListener("DOMContentLoaded", loadProducts);