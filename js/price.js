/* --- ЛОГІКА ДИНАМІЧНОГО ПРАЙС-ЛИСТА --- */

document.addEventListener('DOMContentLoaded', () => {
    loadPrices();
});

async function loadPrices() {
    const container = document.getElementById('dynamic-price-container');

    try {
        const response = await fetch('http://localhost:3000/api/prices');
        const prices = await response.json();

        if (prices.length === 0) {
            container.innerHTML = "<p>Прайс-лист тимчасово порожній.</p>";
            return;
        }

        // Групуємо послуги за категоріями
        const categories = {};
        prices.forEach(item => {
            if (!categories[item.category]) {
                categories[item.category] = [];
            }
            categories[item.category].push(item);
        });

        // Очищуємо контейнер і будуємо HTML
        container.innerHTML = '';

        Object.keys(categories).forEach((catName, index) => {
            const listId = `list-${index}`;
            
            const categoryHTML = `
                <div class="price-category">
                    <div class="category-header" onclick="toggleCategory('${listId}', this)">
                        <h3>${catName}</h3>
                        <div class="arrow-circle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 9l6 6 6-6"/>
                            </svg>
                        </div>
                    </div>
                    <ul id="${listId}" class="procedures-items">
                        ${categories[catName].map(p => `
                            <li class="procedure">
                                <span>${p.name}</span>
                                <span class="price">від ${p.price} €</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
            container.innerHTML += categoryHTML;
        });

    } catch (error) {
        console.error("Помилка завантаження цін:", error);
        container.innerHTML = "<p>Не вдалося завантажити ціни. Перевірте сервер.</p>";
    }
}

/* --- АКОРДЕОН: ВІДКРИТТЯ/ЗАКРИТТЯ --- */
function toggleCategory(listId, headerElement) {
    const list = document.getElementById(listId);
    if (list && headerElement) {
        // Закриваємо інші відкриті категорії (якщо хочеш режим "тільки одна відкрита")
        // document.querySelectorAll('.procedures-items').forEach(el => {
        //     if(el.id !== listId) el.classList.remove('show');
        // });

        headerElement.classList.toggle('active');
        list.classList.toggle('show');
    }
}