const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express(); // ✅ ПЕРЕНЕСИ СЮДИ

app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.use(cors());
app.use(express.json());

// --- 1. ПІДКЛЮЧЕННЯ ДО MONGODB ---
const mongoURI = process.env.MONGODB_URI;

mongoose.connect(mongoURI)
    .then(() => console.log('MongoDB підключено успішно'))
    .catch(err => console.error('Помилка підключення до MongoDB:', err));

// --- 2. СХЕМИ ТА МОДЕЛІ ДАНИХ ---

// Схема для записів (Bookings)
const BookingSchema = new mongoose.Schema({
    name: { type: String, required: true }, 
    surname: { type: String, required: true },
    service: { type: String, required: true },
    master: { type: String, required: true },
    date: { type: String, required: true }, 
    time: { type: String, required: true }, 
    phone: { type: String, required: true },
    status: { type: String, default: "pending" }, // pending, confirmed, completed
    createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', BookingSchema);

// Схема для майстрів (Masters)
const MasterSchema = new mongoose.Schema({
    name: String,
    specialization: [String],
    salaryBase: { type: Number, default: 0 }, 
    percent: { type: Number, default: 30 }
});
const Master = mongoose.model('Master', MasterSchema);

// Схема для користувачів (Users)
const UserSchema = new mongoose.Schema({
    name: String,
    surname: String,
    phone: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    role: { type: String, default: "client" }, // "client" або "admin"
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// Схема для цін (Prices)
const PriceSchema = new mongoose.Schema({
    category: String,
    name: String,
    price: Number
});
const Price = mongoose.model('Price', PriceSchema);

// --- НОВА СХЕМА ТОВАРІВ (Products) ---
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    costPrice: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    image: { type: String, default: "img/no-photo.png" },
    description: String,
    createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', ProductSchema);



const OrderSchema = new mongoose.Schema({
    customerName: String,
    phone: String,
    address: String,
    items: Array, // Масив товарів
    totalPrice: Number,
    paymentMethod: String,
    status: { type: String, default: "Нове" }, // Нове, Пакується, Відправлено, Завершено
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

// --- 3. МАРШРУТИ (API ROUTES) ---


app.get('/api/masters', async (req, res) => {
    try {
        const masters = await Master.find();
        res.json(masters);
    } catch (err) {
        res.status(500).json({ error: "Помилка завантаження майстрів" });
    }
});

// --- ОТРИМАТИ ЗАЙНЯТІ ГОДИНИ МАЙСТРА НА КОНКРЕТНУ ДАТУ ---
app.get('/api/busy-slots', async (req, res) => {
    try {
        const { master, date } = req.query;
        
        // Шукаємо в базі всі записи до цього майстра на цю дату
        const bookings = await Booking.find({ master, date });
        
        // Витягуємо тільки зайнятий час (наприклад: ["10:00", "14:00"])
        const busyTimes = bookings.map(b => b.time);
        
        // Відправляємо цей список назад у форму
        res.json(busyTimes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка завантаження слотів" });
    }
});


// --- АВТОРИЗАЦІЯ ---
app.post('/api/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone });
        if (!user || user.password !== password) {
            return res.status(400).json({ message: "Невірний телефон або пароль" });
        }
        res.json({ 
            message: "Вхід успішний", 
            user: { name: user.name, surname: user.surname, phone: user.phone, email: user.email, address: user.address, role: user.role } 
        });
    } catch (err) { res.status(500).json({ error: "Помилка при вході" }); }
});

app.post('/api/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.status(201).json({ message: "Користувач зареєстрований" });
    } catch (err) {
        console.error("REGISTER ERROR:", err);
        res.status(500).json({ error: 'Помилка реєстрації' });
    }
});

// --- ПРОФІЛЬ ---
app.post('/api/update-profile', async (req, res) => {
    try {
        const { phone, email, address } = req.body;
        const updatedUser = await User.findOneAndUpdate({ phone }, { email, address }, { new: true });
        res.json({ message: "Профіль оновлено", user: updatedUser });
    } catch (err) { res.status(500).json({ error: "Помилка оновлення" }); }
});

// --- ЗАПИСИ ТА БРОНЮВАННЯ ---
app.get('/api/prices', async (req, res) => {
    try { res.json(await Price.find()); } catch (err) { res.status(500).json({ error: "Помилка завантаження цін" }); }
});

app.post('/api/book', async (req, res) => {
    try {
        const { master, date, time } = req.body;
        const exists = await Booking.findOne({ master, date, time });
        if (exists) return res.status(400).json({ message: 'Цей час уже зайнятий' });
        const newBooking = new Booking(req.body);
        await newBooking.save();
        res.status(201).json({ message: 'Запис створено!' });
    } catch (err) { res.status(500).json({ error: 'Помилка бронювання' }); }
});

app.get('/api/my-bookings', async (req, res) => {
    try {
        const bookings = await Booking.find({ phone: req.query.phone }).sort({ date: 1, time: 1 });
        const prices = await Price.find();
        const enriched = bookings.map(b => ({
            ...b._doc,
            price: (prices.find(p => p.name.trim().toLowerCase() === b.service.trim().toLowerCase()))?.price || 40
        }));
        res.json(enriched);
    } catch (err) { res.status(500).json({ error: "Помилка сервера" }); }
});

// --- АДМІН-ПАНЕЛЬ (КЕРУВАННЯ ЗАПИСАМИ) ---
app.get('/api/admin/all-bookings', async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ date: -1, time: -1 });
        const prices = await Price.find();
        const enriched = bookings.map(b => ({
            ...b._doc,
            price: (prices.find(p => p.name.trim().toLowerCase() === b.service.trim().toLowerCase()))?.price || 40
        }));
        res.json(enriched);
    } catch (err) { res.status(500).json({ error: 'Помилка сервера' }); }
});

app.patch('/api/admin/confirm-booking/:id', async (req, res) => {
    try {
        await Booking.findByIdAndUpdate(req.params.id, { status: "confirmed" });
        res.json({ message: "Підтверджено" });
    } catch (err) { res.status(500).json({ error: "Помилка" }); }
});

app.patch('/api/admin/complete-booking/:id', async (req, res) => {
    try {
        await Booking.findByIdAndUpdate(req.params.id, { status: "completed" });
        res.json({ message: "Завершено" });
    } catch (err) { res.status(500).json({ error: "Помилка" }); }
});

app.delete('/api/cancel-booking/:id', async (req, res) => {
    try {
        await Booking.findByIdAndDelete(req.params.id);
        res.json({ message: "Видалено" });
    } catch (err) { res.status(500).json({ error: "Помилка" }); }
});

// --- МАРШРУТИ МАГАЗИНУ ---
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (err) { res.status(500).json({ error: "Помилка завантаження товарів" }); }
});

app.post('/api/admin/add-product', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json({ message: "Товар додано!", product: newProduct });
    } catch (err) { res.status(500).json({ error: "Не вдалося зберегти товар" }); }
});

app.delete('/api/admin/delete-product/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Товар видалено" });
    } catch (err) { res.status(500).json({ error: "Помилка видалення" }); }
});

app.patch('/api/admin/update-products-bulk', async (req, res) => {
    try {
        const { updates } = req.body;
        
        // Виконуємо всі оновлення паралельно
        const promises = updates.map(p => 
            Product.findByIdAndUpdate(p.id, {
                name: p.name,
                category: p.category,
                price: p.price,
                costPrice: p.costPrice,
                stock: p.stock
            })
        );
        
        await Promise.all(promises);
        res.json({ message: "Успішно оновлено" });
    } catch (err) {
        res.status(500).json({ error: "Помилка сервера" });
    }
});


// МАРШРУТ ДЛЯ СТВОРЕННЯ ЗАМОВЛЕННЯ
app.post('/api/orders', async (req, res) => {
    try {
        const { items, paymentMethod } = req.body;

        // 1. ПЕРЕВІРКА НАЯВНОСТІ
        for (const item of items) {
            const product = await Product.findOne({ name: item.name });
            
            if (!product) {
                return res.status(404).json({ message: `Товар "${item.name}" не знайдено.` });
            }

            if (product.stock < item.quantity) {
                return res.status(400).json({ 
                    message: `Недостатньо товару "${item.name}". В наявності: ${product.stock}, а ви замовили: ${item.quantity}` 
                });
            }
        }

        // 2. ЯКЩО ПЕРЕВІРКА ПРОЙШЛА - ЗМЕНШУЄМО СКЛАД
        for (const item of items) {
            await Product.findOneAndUpdate(
                { name: item.name },
                { $inc: { stock: -item.quantity } }
            );
        }

        // 3. СТВОРЮЄМО ЗАМОВЛЕННЯ
        const initialStatus = paymentMethod === 'credit-card' ? 'Пакується' : 'Нове';
        const newOrder = new Order({ ...req.body, status: initialStatus });
        await newOrder.save();

        res.status(201).json({ message: "Замовлення прийнято!" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка при оформленні замовлення" });
    }
});


// Отримати замовлення конкретного користувача
app.get('/api/my-orders', async (req, res) => {
    try {
        const { phone } = req.query;
        const orders = await Order.find({ phone }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: "Помилка завантаження замовлень" });
    }
});

// 1. Отримати всі замовлення для адмінки
app.get('/api/admin/all-orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: "Помилка завантаження замовлень" });
    }
});

// 2. Оновити статус замовлення
app.patch('/api/admin/update-order-status/:id', async (req, res) => {
    try {
        const { status } = req.body;
        await Order.findByIdAndUpdate(req.params.id, { status });
        res.json({ message: "Статус оновлено!" });
    } catch (err) {
        res.status(500).json({ error: "Не вдалося оновити статус" });
    }
});

// --- 1. ПОВЕРНЕННЯ ТОВАРУ КЛІЄНТОМ (з кабінету) ---
app.patch('/api/orders/cancel/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        // Перевіряємо, чи замовлення вже не було відправлене або завершене
        if (order.status !== 'Нове' && order.status !== 'Пакується') {
            return res.status(400).json({ message: "Це замовлення вже неможливо скасувати самостійно." });
        }

        // Повертаємо товари на склад
        for (const item of order.items) {
            await Product.findOneAndUpdate(
                { name: item.name },
                { $inc: { stock: item.quantity } } // Додаємо кількість назад
            );
        }

        // Оновлюємо статус
        order.status = 'Скасовано клієнтом';
        await order.save();

        res.json({ message: "Замовлення скасовано, товари повернуто на склад." });
    } catch (err) {
        res.status(500).json({ error: "Помилка при скасуванні" });
    }
});

// --- 2. СКАСУВАННЯ ЗАМОВЛЕННЯ АДМІНОМ (з адмінки) ---
app.patch('/api/admin/cancel-order/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (order.status.includes('Скасовано')) {
            return res.status(400).json({ message: "Замовлення вже скасовано." });
        }

        // Повертаємо товари на склад
        for (const item of order.items) {
            await Product.findOneAndUpdate(
                { name: item.name },
                { $inc: { stock: item.quantity } }
            );
        }

        // Змінюємо статус
        order.status = 'Скасовано адміністратором';
        await order.save();

        res.json({ message: "Скасовано адміністратором!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка при скасуванні" });
    }
});

// --- ПОВНЕ ВИДАЛЕННЯ ЗАМОВЛЕННЯ АДМІНОМ ---
app.delete('/api/admin/delete-order/:id', async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.json({ message: "Замовлення повністю видалено з бази" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Помилка при видаленні замовлення" });
    }
});

// --- 4. ЗАПУСК СЕРВЕРА ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT}`);
});