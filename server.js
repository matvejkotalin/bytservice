const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const db = require('./db');

const SALT_ROUNDS = 10;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Настройка multer для загрузки аватаров
const avatarsDir = path.join(__dirname, 'public', 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `avatar_${req.body.id || Date.now()}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Только изображения'));
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// API: АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЕЙ
// ============================================

// Регулярное выражение для проверки формата телефона
const PHONE_REGEX = /^\+7\s?\(?\d{3}\)?\s?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/;
// Регулярное выражение для проверки имени (только буквы и пробелы)
const NAME_REGEX = /^[а-яёА-ЯЁa-zA-Z\s]{2,50}$/;

// Регистрация
app.post('/api/auth/register', async (req, res) => {
    const { name, phone, password } = req.body;

    // Проверка наличия всех полей
    if (!name || !phone || !password) {
        return res.status(400).json({ success: false, message: 'Заполните все поля' });
    }

    // Проверка формата имени
    if (!NAME_REGEX.test(name.trim())) {
        return res.status(400).json({ success: false, message: 'Некорректное имя или фамилия пользователя' });
    }

    // Проверка формата телефона
    if (!PHONE_REGEX.test(phone)) {
        return res.status(400).json({ success: false, message: 'Некорректный формат телефона' });
    }

    // Проверка длины пароля
    if (password.length < 6 || password.length > 100) {
        return res.status(400).json({ success: false, message: 'Пароль должен быть от 6 до 100 символов' });
    }

    try {
        // Проверка существующего пользователя
        const [existing] = await db.execute(
            'SELECT id FROM users WHERE phone = ?', [phone]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Пользователь с таким телефоном уже существует' });
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Сохранение пользователя в БД
        const [result] = await db.execute(
            'INSERT INTO users (name, phone, password) VALUES (?, ?, ?)',
            [name.trim(), phone, hashedPassword]
        );

        res.json({
            success: true,
            message: 'Регистрация успешна!',
            user: { id: result.insertId, name: name.trim(), phone }
        });
    } catch (err) {
        // Логируем только сообщение об ошибке без чувствительных данных
        console.error('Ошибка регистрации:', err.message);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// Счётчик неудачных попыток входа { name: count }
const loginAttempts = {};

// Авторизация
app.post('/api/auth/login', async (req, res) => {
    const { name, password } = req.body;

    // Проверка наличия полей до обращения к БД
    if (!name || !password) {
        return res.status(400).json({ success: false, message: 'Заполните все поля' });
    }

    // Проверка количества неудачных попыток
    if ((loginAttempts[name] || 0) >= 5) {
        return res.status(429).json({ success: false, message: 'Слишком много попыток входа' });
    }

    try {
        // Поиск пользователя по имени
        const [rows] = await db.execute(
            'SELECT id, name, phone, password, role FROM users WHERE name = ?',
            [name]
        );

        if (rows.length === 0) {
            loginAttempts[name] = (loginAttempts[name] || 0) + 1;
            return res.status(401).json({ success: false, message: 'Неверное имя или пароль' });
        }

        const user = rows[0];

        // Сравнение пароля с хешем
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            // Сбрасываем счётчик при успешном входе
            delete loginAttempts[name];
            res.json({
                success: true,
                message: 'Вход выполнен',
                user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
            });
        } else {
            loginAttempts[name] = (loginAttempts[name] || 0) + 1;
            res.status(401).json({ success: false, message: 'Неверное имя или пароль' });
        }
    } catch (err) {
        // Логируем только сообщение без чувствительных данных
        console.error('Ошибка авторизации:', err.message);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// Обновление профиля (имя и телефон)
app.put('/api/auth/profile', async (req, res) => {
    const { id, name, phone } = req.body;

    if (!id || !name || !phone) {
        return res.status(400).json({ success: false, message: 'Заполните все поля' });
    }

    try {
        // Проверяем, не занят ли телефон другим пользователем
        const [existing] = await db.execute('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, id]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Этот телефон уже используется другим пользователем' });
        }

        await db.execute('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone, id]);
        res.json({ success: true, message: 'Профиль обновлён', user: { id: parseInt(id), name, phone } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// Получение даты регистрации пользователя
app.get('/api/auth/userinfo', async (req, res) => {
    const { id } = req.query;
    try {
        const [rows] = await db.execute('SELECT created_at, role FROM users WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false });
        res.json({ success: true, created_at: rows[0].created_at, role: rows[0].role });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Смена пароля
app.post('/api/auth/change-password', async (req, res) => {
    const { phone, old_password, new_password } = req.body;

    if (!new_password || new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'Новый пароль должен быть не менее 6 символов' });
    }

    try {
        const [rows] = await db.execute('SELECT id, password FROM users WHERE phone = ?', [phone]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Пользователь не найден' });
        }

        const match = await bcrypt.compare(old_password, rows[0].password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Текущий пароль неверен' });
        }

        const hashedNew = await bcrypt.hash(new_password, SALT_ROUNDS);
        await db.execute('UPDATE users SET password = ? WHERE phone = ?', [hashedNew, phone]);
        res.json({ success: true, message: 'Пароль успешно изменён' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ============================================
// API: УСЛУГИ (Прайс-лист)
// ============================================

app.get('/api/services', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT s.*,
                   cat.min_price
            FROM services s
            JOIN (
                SELECT category,
                       MIN(CASE WHEN price_from > 0 THEN price_from END) AS min_price
                FROM services
                WHERE is_active = 1
                GROUP BY category
            ) cat ON cat.category = s.category
            WHERE s.is_active = 1
            ORDER BY s.category ASC, s.id ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера при получении услуг' });
    }
});

// ============================================
// API: ЗАЯВКИ
// ============================================

app.get('/api/orders', async (req, res) => {
    const { user_phone, role } = req.query;
    try {
        let rows;
        if (user_phone) {
            [rows] = await db.execute('SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC', [user_phone]);
        } else {
            if (!role || !['admin', 'director'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Доступ запрещен' });
            }
            [rows] = await db.execute('SELECT * FROM orders ORDER BY created_at DESC');
        }
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.post('/api/orders', async (req, res) => {
    const { client_name, phone, device_type, device_model, service_type, urgency, has_warranty, problem, preferred_date, preferred_time } = req.body;
    try {
        // Автоматически определяем нормативы времени по типу устройства
        const norms    = getNorms(device_type);
        const priority = urgency === 'urgent' ? 1 : 0;

        // Автоматический подбор оборудования по типу устройства
        const [equipRows] = await db.execute(
            `SELECT id, type, is_active FROM equipment WHERE is_active = 1`
        );
        const equipment_id = getEquipmentId(device_type, equipRows);

        // Автоматический расчёт дедлайна
        const deadlineDate = new Date();
        if (urgency === 'urgent') {
            deadlineDate.setDate(deadlineDate.getDate() + 1);
        } else {
            deadlineDate.setDate(deadlineDate.getDate() + 3);
        }
        const deadline = deadlineDate.toISOString().slice(0, 19).replace('T', ' ');

        const [result] = await db.execute(
            `INSERT INTO orders
                (client_name, phone, device_type, device_model, service_type,
                 urgency, has_warranty, problem, preferred_date, preferred_time,
                 diagnosis_time, repair_time, priority, deadline, equipment_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [client_name, phone, device_type, device_model || null,
             service_type || null, urgency || 'normal', has_warranty ? 1 : 0,
             problem || null, preferred_date || null, preferred_time || null,
             norms.diagnosis, norms.repair, priority, deadline, equipment_id]
        );

        res.json({ success: true, message: 'Заявка отправлена!', id: result.insertId });

        // Автоматически перестраиваем расписание в фоне
        autoRebuildSchedule().catch(err =>
            console.error('Ошибка автопланирования:', err.message)
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ============================================
// API: АВАТАР ПОЛЬЗОВАТЕЛЯ (multer)
// ============================================

app.post('/api/auth/avatar', upload.single('avatar'), async (req, res) => {
    const { id } = req.body;
    if (!id || !req.file) {
        return res.status(400).json({ success: false, message: 'Нет данных' });
    }
    const avatarUrl = '/avatars/' + req.file.filename;
    try {
        const [rows] = await db.execute('SELECT avatar FROM users WHERE id = ?', [id]);
        if (rows.length && rows[0].avatar) {
            const oldPath = path.join(__dirname, 'public', rows[0].avatar);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        await db.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, id]);
        res.json({ success: true, message: 'Аватар обновлён', avatar: avatarUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.get('/api/auth/avatar', async (req, res) => {
    const { id } = req.query;
    try {
        const [rows] = await db.execute('SELECT avatar FROM users WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ success: false });
        res.json({ success: true, avatar: rows[0].avatar });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// ============================================
// API: ПОЛЬЗОВАТЕЛИ — для админа
// ============================================

app.get('/api/admin/users', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, name, phone, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.put('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, phone, role } = req.body;
    if (!name || !phone) {
        return res.status(400).json({ success: false, message: 'Заполните все поля' });
    }
    try {
        const [existing] = await db.execute('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, id]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Этот телефон уже занят' });
        }
        await db.execute('UPDATE users SET name = ?, phone = ?, role = ? WHERE id = ?', [name, phone, role || 'user', id]);
        res.json({ success: true, message: 'Пользователь обновлён' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const { admin_id } = req.body;
    if (admin_id && parseInt(admin_id) === parseInt(id)) {
        return res.status(400).json({ success: false, message: 'Нельзя удалить собственную учетную запись' });
    }
    try {
        await db.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'Пользователь удалён' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.post('/api/admin/users/:id/reset-password', async (req, res) => {
    const { id } = req.params;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'Пароль минимум 6 символов' });
    }
    try {
        const hashedNew = await bcrypt.hash(new_password, SALT_ROUNDS);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNew, id]);
        res.json({ success: true, message: 'Пароль сброшен' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ============================================
// API: ЗАЯВКИ — обновление статуса
// ============================================

app.put('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['new', 'in_progress', 'done', 'cancelled'];
    if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, message: 'Недопустимый статус' });
    }
    try {
        const [existing] = await db.execute('SELECT id FROM orders WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Заказ не найден' });
        }
        await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: 'Статус обновлён' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ============================================
// API: УСЛУГИ — CRUD для админа
// ============================================

app.get('/api/admin/services', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM services ORDER BY category ASC, id ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.post('/api/admin/services', async (req, res) => {
    const { category, name, description, price_from, price_to, warranty, duration, is_active } = req.body;
    if (!category || !name || !price_from) {
        return res.status(400).json({ success: false, message: 'Заполните обязательные поля' });
    }
    try {
        const [result] = await db.execute(
            'INSERT INTO services (category, name, description, price_from, price_to, warranty, duration, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [category, name, description || null, price_from, price_to || null, warranty || null, duration || null, is_active ?? 1]
        );
        res.json({ success: true, message: 'Услуга добавлена', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.put('/api/admin/services/:id', async (req, res) => {
    const { id } = req.params;
    const { category, name, description, price_from, price_to, warranty, duration, is_active } = req.body;
    try {
        await db.execute(
            'UPDATE services SET category=?, name=?, description=?, price_from=?, price_to=?, warranty=?, duration=?, is_active=? WHERE id=?',
            [category, name, description || null, price_from, price_to || null, warranty || null, duration || null, is_active ?? 1, id]
        );
        res.json({ success: true, message: 'Услуга обновлена' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.delete('/api/admin/services/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM services WHERE id = ?', [id]);
        res.json({ success: true, message: 'Услуга удалена' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ============================================
// API: ОТЗЫВЫ
// ============================================

/**
 * Автоматическая модерация отзыва.
 * @param {string} name - Имя автора отзыва
 * @param {string} text - Текст отзыва
 * @param {number} rating - Оценка от 1 до 5
 * @returns {boolean} true - опубликовать, false - на ручную модерацию
 */

// Массив спам-паттернов вынесен за пределы функции
const SPAM_PATTERNS = [
    /https?:\/\//i,
    /www\./i,
    /\b(casino|poker|займ|кредит|виагра|viagra|forex|crypto|крипто)\b/i,
    /[A-ZА-ЯЁ]{8,}/,
    /(.)\1{6,}/,
];

function autoModerate(name, text, rating) {
    // Проверка типов входных данных
    if (typeof name !== 'string' || typeof text !== 'string') return false;

    // Проверка длины и диапазона
    if (!name || name.length < 2 || name.length > 50) return false;
    if (!text || text.length < 10 || text.length > 2000) return false;
    if (!rating || rating < 1 || rating > 5) return false;

    // Проверка на спам
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(name) || pattern.test(text)) return false;
    }

    return true;
}

// Получение одобренных отзывов (для клиентской части)
app.get('/api/reviews', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM reviews WHERE is_approved = 1 ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// Получение ВСЕХ отзывов (для админ-панели)
app.get('/api/reviews/all', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM reviews ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// Добавление нового отзыва
app.post('/api/reviews', async (req, res) => {
    const { client_name, rating, text, device_type } = req.body;

    if (!client_name || !rating || !text) {
        return res.status(400).json({ success: false, message: 'Заполните все обязательные поля' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Оценка должна быть от 1 до 5' });
    }

    try {
        const autoApproved = autoModerate(client_name.trim(), text.trim(), parseInt(rating));

        const [result] = await db.execute(
            'INSERT INTO reviews (client_name, rating, text, device_type, is_approved) VALUES (?, ?, ?, ?, ?)',
            [client_name.trim(), parseInt(rating), text.trim(), device_type?.trim() || null, autoApproved ? 1 : 0]
        );
        res.json({
            success: true,
            message: autoApproved
                ? 'Спасибо за отзыв! Он уже опубликован.'
                : 'Спасибо за отзыв! Он будет проверен администратором.',
            id: result.insertId,
            auto_approved: autoApproved
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// Обновление статуса отзыва (для админ-панели)
app.put('/api/reviews/:id', async (req, res) => {
    const { id } = req.params;
    const { is_approved } = req.body;
    try {
        await db.execute('UPDATE reviews SET is_approved = ? WHERE id = ?', [is_approved, id]);
        res.json({ success: true, message: 'Статус обновлён' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// Удаление отзыва (для админ-панели)
app.delete('/api/reviews/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM reviews WHERE id = ?', [id]);
        res.json({ success: true, message: 'Отзыв удалён' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ============================================
// ПЛАНИРОВЩИК
// ============================================
const scheduler = require('./scheduler');

// ─────────────────────────────────────────────
// НОРМАТИВЫ ВРЕМЕНИ ПО ТИПУ УСТРОЙСТВА (минуты)
// ─────────────────────────────────────────────
const DEVICE_NORMS = {
    'смартфон':         { diagnosis: 20, repair: 60  },
    'телефон':          { diagnosis: 20, repair: 60  },
    'планшет':          { diagnosis: 25, repair: 75  },
    'apple':            { diagnosis: 25, repair: 80  },
    'ноутбук':          { diagnosis: 40, repair: 120 },
    'компьютер':        { diagnosis: 40, repair: 120 },
    'монитор':          { diagnosis: 20, repair: 60  },
    'телевизор':        { diagnosis: 30, repair: 120 },
    'принтер':          { diagnosis: 20, repair: 60  },
    'мфу':              { diagnosis: 20, repair: 60  },
    'копир':            { diagnosis: 20, repair: 60  },
    'заправка':         { diagnosis: 10, repair: 20  },
    'фотоаппарат':      { diagnosis: 30, repair: 90  },
    'консоль':          { diagnosis: 20, repair: 60  },
    'микроволновк':     { diagnosis: 20, repair: 60  },
    'кофемашин':        { diagnosis: 25, repair: 75  },
    'стиральная':       { diagnosis: 40, repair: 150 },
    'холодильник':      { diagnosis: 40, repair: 180 },
    'кондиционер':      { diagnosis: 40, repair: 180 },
    'робот':            { diagnosis: 20, repair: 60  },
    'электросамокат':   { diagnosis: 30, repair: 90  },
    'электроинструмент':{ diagnosis: 30, repair: 90  },
    'снегоочиститель':  { diagnosis: 40, repair: 150 },
    'мотокультиватор':  { diagnosis: 40, repair: 150 },
    'мотопомп':         { diagnosis: 35, repair: 120 },
    'бензопил':         { diagnosis: 30, repair: 90  },
    'электропил':       { diagnosis: 30, repair: 90  },
    'триммер':          { diagnosis: 30, repair: 90  },
    'генератор':        { diagnosis: 40, repair: 180 },
    'восстановление':   { diagnosis: 30, repair: 120 },
    'онлайн-касса':     { diagnosis: 20, repair: 60  },
    'касса':            { diagnosis: 20, repair: 60  },
    'default':          { diagnosis: 30, repair: 90  },
};

function getNorms(deviceType) {
    if (!deviceType) return DEVICE_NORMS.default;
    const key = deviceType.toLowerCase();
    for (const [pattern, norms] of Object.entries(DEVICE_NORMS)) {
        if (key.includes(pattern)) return norms;
    }
    return DEVICE_NORMS.default;
}

// ─────────────────────────────────────────────
// АВТОМАТИЧЕСКИЙ ПОДБОР ОБОРУДОВАНИЯ ПО ТИПУ УСТРОЙСТВА
// equipment_id соответствует таблице equipment:
//   1 — Паяльная станция #1  (soldering)
//   2 — Паяльная станция #2  (soldering)
//   3 — Микроскоп #1         (microscope)
//   4 — Измерительный стенд  (bench)
// ─────────────────────────────────────────────

const EQUIPMENT_MAP = {
    'смартфон':          'microscope',
    'телефон':           'microscope',
    'планшет':           'microscope',
    'apple':             'microscope',
    'ноутбук':           'soldering',
    'компьютер':         'soldering',
    'монитор':           'soldering',
    'консоль':           'soldering',
    'фотоаппарат':       'soldering',
    'касса':             'soldering',
    'онлайн':            'soldering',
    'телевизор':         'bench',
    'принтер':           'bench',
    'мфу':               'bench',
    'копир':             'bench',
    'микроволновк':      'bench',
    'кофемашин':         'bench',
    'стиральная':        'bench',
    'холодильник':       'bench',
    'кондиционер':       'bench',
    'робот':             'bench',
    'электросамокат':    'bench',
    'электроинструмент': 'bench',
    'снегоочиститель':   'bench',
    'мотокультиватор':   'bench',
    'мотопомп':          'bench',
    'бензопил':          'bench',
    'электропил':        'bench',
    'триммер':           'bench',
    'генератор':         'bench',
};

/**
 * Возвращает equipment_id по типу устройства.
 * Выбирает первую активную единицу нужного типа.
 * Планировщик сам сдвинет слот если оборудование занято (через equipBusy).
 */
function getEquipmentId(deviceType, equipmentRows) {
    if (!deviceType || !equipmentRows || !equipmentRows.length) return null;
    const key = deviceType.toLowerCase();
    let neededType = null;
    for (const [pattern, type] of Object.entries(EQUIPMENT_MAP)) {
        if (key.includes(pattern)) { neededType = type; break; }
    }
    if (!neededType) return null;
    const match = equipmentRows.find(e => e.type === neededType && e.is_active);
    return match ? match.id : null;
}

async function getOrdersForScheduler(onlyActive = true) {
    const statusFilter = onlyActive
        ? `WHERE o.status IN ('new','in_progress')`
        : '';
    const [rows] = await db.execute(`
        SELECT
            o.id, o.client_name, o.phone,
            o.device_type, o.device_model, o.problem,
            o.urgency, o.priority, o.status,
            o.master_id, o.equipment_id,
            o.diagnosis_time, o.repair_time,
            o.deadline
        FROM orders o
        ${statusFilter}
        ORDER BY o.priority DESC, o.created_at ASC
    `);

    const today = new Date();
    return rows.map(o => ({
        ...o,
        diagnosis_time: o.diagnosis_time || 30,
        repair_time:    o.repair_time    || 60,
        priority:       o.priority       || (o.urgency === 'urgent' ? 1 : 0),
        deadline_min:   o.deadline
            ? scheduler.deadlineToMinutes(o.deadline, today)
            : null,
    }));
}

// ─────────────────────────────────────────────
// GET /api/masters — список мастеров
// ─────────────────────────────────────────────
app.get('/api/masters', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, name, phone FROM users WHERE role = 'master' ORDER BY name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ─────────────────────────────────────────────
// GET /api/equipment — список оборудования
// ─────────────────────────────────────────────
app.get('/api/equipment', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, name, type FROM equipment WHERE is_active = 1 ORDER BY name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ─────────────────────────────────────────────
// POST /api/schedule/build — пересчитать расписание
// ─────────────────────────────────────────────
app.post('/api/schedule/build', async (req, res) => {
    try {
        const orders  = await getOrdersForScheduler(true);
        const [masterRows] = await db.execute(
            `SELECT id, name FROM users WHERE role = 'master'`
        );

        if (!masterRows.length) {
            return res.status(400).json({ success: false, message: 'Нет мастеров в системе' });
        }
        if (!orders.length) {
            return res.status(200).json({ success: true, message: 'Нет активных заказов', data: {} });
        }

        const result = scheduler.buildSchedule(orders, masterRows, { dayStartHour: 9 });
        const today  = new Date();

        await db.execute(`DELETE FROM schedule WHERE DATE(start_time) = CURDATE()`);

        for (const [masterId, data] of Object.entries(result.masterSchedules)) {
            const withDates = scheduler.scheduleToDatetime(data.schedule, today);
            for (const slot of withDates) {
                await db.execute(
                    `INSERT INTO schedule
                        (order_id, master_id, equipment_id, stage, start_time, end_time)
                     VALUES (?, ?, ?, 'diagnosis', ?, ?)`,
                    [slot.order_id, masterId, slot.equipment_id || null,
                     slot.diag_start_dt, slot.diag_end_dt]
                );
                await db.execute(
                    `INSERT INTO schedule
                        (order_id, master_id, equipment_id, stage, start_time, end_time)
                     VALUES (?, ?, ?, 'repair', ?, ?)`,
                    [slot.order_id, masterId, slot.equipment_id || null,
                     slot.repair_start_dt, slot.end_time_dt]
                );
                await db.execute(
                    `UPDATE orders SET master_id = ? WHERE id = ? AND master_id IS NULL`,
                    [masterId, slot.order_id]
                );
            }
        }

        for (const warn of result.warnings) {
            const [existing] = await db.execute(
                `SELECT id FROM notifications
                 WHERE order_id = ? AND type = 'deadline_risk' AND DATE(created_at) = CURDATE()`,
                [warn.order_id]
            );
            if (!existing.length) {
                await db.execute(
                    `INSERT INTO notifications (order_id, type, message)
                     VALUES (?, 'deadline_risk', ?)`,
                    [warn.order_id,
                     `Заказ #${warn.order_id} (${warn.client_name}, ${warn.device_type}) рискует быть выполнен с опозданием на ${warn.overdue_min} мин`]
                );
            }
        }

        res.json({
            success:       true,
            algorithm:     result.algorithm,
            totalMakespan: result.totalMakespan,
            warnings:      result.warnings,
            data:          result.masterSchedules,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка планирования: ' + err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/schedule/urgent — добавить срочный заказ
// ─────────────────────────────────────────────
app.post('/api/schedule/urgent', async (req, res) => {
    const { order_id } = req.body;
    if (!order_id) {
        return res.status(400).json({ success: false, message: 'Нужен order_id' });
    }
    try {
        await db.execute(
            `UPDATE orders SET priority = 1, urgency = 'urgent' WHERE id = ?`,
            [order_id]
        );

        const [orderRows] = await db.execute(`SELECT * FROM orders WHERE id = ?`, [order_id]);
        if (!orderRows.length) {
            return res.status(404).json({ success: false, message: 'Заказ не найден' });
        }

        const today = new Date();
        const urgentOrder = {
            ...orderRows[0],
            diagnosis_time: orderRows[0].diagnosis_time || 30,
            repair_time:    orderRows[0].repair_time    || 60,
            priority:       1,
            deadline_min:   orderRows[0].deadline
                ? scheduler.deadlineToMinutes(orderRows[0].deadline, today)
                : null,
        };

        const [masterRows] = await db.execute(
            `SELECT id, name FROM users WHERE role = 'master'`
        );
        if (!masterRows.length) {
            return res.status(400).json({ success: false, message: 'Нет мастеров' });
        }

        const currentMasterSchedules = {};
        for (const master of masterRows) {
            const [slots] = await db.execute(
                `SELECT s.*, o.client_name, o.device_type, o.device_model, o.problem,
                        o.diagnosis_time, o.repair_time, o.priority, o.deadline
                 FROM schedule s
                 JOIN orders o ON s.order_id = o.id
                 WHERE s.master_id = ? AND DATE(s.start_time) = CURDATE() AND s.stage = 'diagnosis'
                 ORDER BY s.start_time ASC`,
                [master.id]
            );
            const makespan = slots.length
                ? Math.max(...slots.map(s => {
                    const endMin = (new Date(s.end_time).getHours() * 60 + new Date(s.end_time).getMinutes());
                    return endMin + (s.repair_time || 60);
                  }))
                : (9 * 60);

            currentMasterSchedules[master.id] = {
                master,
                schedule: slots.map(s => ({
                    order_id:      s.order_id,
                    client_name:   s.client_name,
                    device_type:   s.device_type,
                    device_model:  s.device_model,
                    problem:       s.problem,
                    equipment_id:  s.equipment_id,
                    priority:      s.priority || 0,
                    deadline_min:  s.deadline ? scheduler.deadlineToMinutes(s.deadline, today) : null,
                    diag_start:    new Date(s.start_time).getHours() * 60 + new Date(s.start_time).getMinutes(),
                    diag_end:      new Date(s.end_time).getHours()   * 60 + new Date(s.end_time).getMinutes(),
                    repair_start:  new Date(s.end_time).getHours()   * 60 + new Date(s.end_time).getMinutes(),
                    end_time:      new Date(s.end_time).getHours()   * 60 + new Date(s.end_time).getMinutes() + (s.repair_time || 60),
                    start_time:    new Date(s.start_time).getHours() * 60 + new Date(s.start_time).getMinutes(),
                })),
                makespan,
            };
        }

        const result = scheduler.rescheduleUrgent(urgentOrder, currentMasterSchedules, masterRows);

        await db.execute(
            `DELETE FROM schedule WHERE master_id = ? AND DATE(start_time) = CURDATE()`,
            [result.assignedMasterId]
        );

        const withDates = scheduler.scheduleToDatetime(
            result.masterSchedules[result.assignedMasterId].schedule, today
        );
        for (const slot of withDates) {
            await db.execute(
                `INSERT INTO schedule (order_id, master_id, equipment_id, stage, start_time, end_time)
                 VALUES (?, ?, ?, 'diagnosis', ?, ?)`,
                [slot.order_id, result.assignedMasterId, slot.equipment_id || null,
                 slot.diag_start_dt, slot.diag_end_dt]
            );
            await db.execute(
                `INSERT INTO schedule (order_id, master_id, equipment_id, stage, start_time, end_time)
                 VALUES (?, ?, ?, 'repair', ?, ?)`,
                [slot.order_id, result.assignedMasterId, slot.equipment_id || null,
                 slot.repair_start_dt, slot.end_time_dt]
            );
        }

        await db.execute(
            `UPDATE orders SET master_id = ? WHERE id = ?`,
            [result.assignedMasterId, order_id]
        );

        await db.execute(
            `INSERT INTO notifications (order_id, type, message)
             VALUES (?, 'urgent_added', ?)`,
            [order_id, `Срочный заказ #${order_id} добавлен в начало очереди мастера`]
        );

        notifyMaster(result.assignedMasterId, { reason: 'urgent_added', order_id });

        res.json({
            success:          true,
            assignedMasterId: result.assignedMasterId,
            warnings:         result.warnings,
            totalMakespan:    result.totalMakespan,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка перепланирования: ' + err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/schedule — расписание (для Ганта)
// ─────────────────────────────────────────────
app.get('/api/schedule', async (req, res) => {
    const { date, master_id } = req.query;
    try {
        const targetDate = date || new Date().toISOString().slice(0, 10);
        let query = `
            SELECT
                s.id, s.order_id, s.master_id, s.equipment_id,
                s.stage, s.start_time, s.end_time, s.is_completed,
                o.client_name, o.device_type, o.device_model,
                o.problem, o.urgency, o.priority, o.status,
                u.name AS master_name,
                e.name AS equipment_name
            FROM schedule s
            JOIN orders o ON s.order_id = o.id
            JOIN users  u ON s.master_id = u.id
            LEFT JOIN equipment e ON s.equipment_id = e.id
            WHERE DATE(s.start_time) = ?
        `;
        const params = [targetDate];

        if (master_id) {
            query += ` AND s.master_id = ?`;
            params.push(master_id);
        }

        query += ` ORDER BY s.master_id ASC, s.start_time ASC`;

        const [rows] = await db.execute(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ─────────────────────────────────────────────
// GET /api/master/queue — очередь мастера
// ─────────────────────────────────────────────
app.get('/api/master/queue', async (req, res) => {
    const { master_id } = req.query;
    if (!master_id) {
        return res.status(400).json({ success: false, message: 'Нужен master_id' });
    }
    try {
        const [rows] = await db.execute(`
            SELECT
                s.id AS schedule_id,
                s.order_id, s.stage, s.start_time, s.end_time, s.is_completed,
                o.client_name, o.phone, o.device_type, o.device_model,
                o.problem, o.urgency, o.priority, o.status, o.deadline,
                e.name AS equipment_name, e.type AS equipment_type
            FROM schedule s
            JOIN orders o ON s.order_id = o.id
            LEFT JOIN equipment e ON s.equipment_id = e.id
            WHERE s.master_id = ?
              AND DATE(s.start_time) = CURDATE()
              AND s.stage = 'diagnosis'
            ORDER BY s.start_time ASC
        `, [master_id]);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ─────────────────────────────────────────────
// PATCH /api/master/complete/:order_id
// ─────────────────────────────────────────────
app.patch('/api/master/complete/:order_id', async (req, res) => {
    const { order_id } = req.params;
    const { master_id } = req.body;
    if (!master_id) {
        return res.status(400).json({ success: false, message: 'Нужен master_id' });
    }
    try {
        const [check] = await db.execute(
            `SELECT id FROM orders WHERE id = ? AND master_id = ?`,
            [order_id, master_id]
        );
        if (!check.length) {
            return res.status(403).json({ success: false, message: 'Нет доступа к этому заказу' });
        }

        await db.execute(
            `UPDATE orders SET status = 'done' WHERE id = ?`,
            [order_id]
        );

        await db.execute(
            `UPDATE schedule SET is_completed = 1 WHERE order_id = ? AND master_id = ?`,
            [order_id, master_id]
        );

        const [orderInfo] = await db.execute(
            `SELECT client_name, device_type, device_model, phone FROM orders WHERE id = ?`,
            [order_id]
        );
        const o = orderInfo[0];
        await db.execute(
            `INSERT INTO notifications (order_id, type, message)
             VALUES (?, 'order_ready', ?)`,
            [order_id,
             `Заказ #${order_id} готов к выдаче! ${o.client_name} — ${o.device_type} ${o.device_model || ''}`]
        );

        notifyMaster(parseInt(master_id), { reason: 'order_done', order_id: parseInt(order_id) });

        if (o.phone) {
            notifyClient(o.phone, {
                reason: 'order_ready',
                order_id: parseInt(order_id),
                message: `Ваш ${o.device_type}${o.device_model ? ' ' + o.device_model : ''} готов к выдаче!`
            });
        }

        res.json({ success: true, message: 'Заказ отмечен выполненным, администратор уведомлён' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ─────────────────────────────────────────────
// GET /api/dashboard — сводка для директора
// ─────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);

        const [[orderStats]] = await db.execute(`
            SELECT
                COUNT(*)                                        AS total,
                SUM(status = 'new')                            AS new_count,
                SUM(status = 'in_progress')                    AS in_progress,
                SUM(status = 'done')                           AS done_total,
                SUM(status = 'done' AND DATE(updated_at) = ?)  AS done_today,
                SUM(status = 'cancelled')                      AS cancelled
            FROM orders
        `, [today]);

        const [[{ overdue }]] = await db.execute(`
            SELECT COUNT(*) AS overdue
            FROM orders
            WHERE deadline < NOW()
              AND status NOT IN ('done','cancelled')
        `);

        const [masterLoad] = await db.execute(`
            SELECT
                u.id, u.name,
                COUNT(s.id)           AS slots_total,
                SUM(s.is_completed)   AS slots_done,
                ROUND(
                    TIMESTAMPDIFF(MINUTE,
                        MIN(s.start_time),
                        MAX(s.end_time)
                    ) / (8 * 60) * 100
                ) AS load_pct
            FROM users u
            LEFT JOIN schedule s ON s.master_id = u.id AND DATE(s.start_time) = ?
            WHERE u.role = 'master'
            GROUP BY u.id, u.name
        `, [today]);

        const [equipLoad] = await db.execute(`
            SELECT
                e.id, e.name, e.type,
                COUNT(s.id) AS usage_count,
                ROUND(
                    SUM(TIMESTAMPDIFF(MINUTE, s.start_time, s.end_time)) / (8 * 60) * 100
                ) AS load_pct
            FROM equipment e
            LEFT JOIN schedule s ON s.equipment_id = e.id AND DATE(s.start_time) = ?
            WHERE e.is_active = 1
            GROUP BY e.id, e.name, e.type
        `, [today]);

        const [[{ unread_notifications }]] = await db.execute(`
            SELECT COUNT(*) AS unread_notifications
            FROM notifications
            WHERE is_read = 0
        `);

        res.json({
            success: true,
            data: {
                orders:               orderStats,
                overdue:              overdue || 0,
                masters:              masterLoad,
                equipment:            equipLoad,
                unread_notifications: unread_notifications || 0,
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ─────────────────────────────────────────────
// GET /api/notifications
// ─────────────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT n.*, o.client_name, o.device_type
            FROM notifications n
            LEFT JOIN orders o ON n.order_id = o.id
            ORDER BY n.created_at DESC
            LIMIT 50
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ─────────────────────────────────────────────
// GET /api/notifications/client?phone=...
// ─────────────────────────────────────────────
app.get('/api/notifications/client', async (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Нужен phone' });
    try {
        const [rows] = await db.execute(`
            SELECT n.id, n.message, n.is_read, n.created_at, o.device_type, o.device_model
            FROM notifications n
            LEFT JOIN orders o ON n.order_id = o.id
            WHERE o.phone = ? AND n.type = 'order_ready'
            ORDER BY n.created_at DESC
            LIMIT 20
        `, [phone]);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ─────────────────────────────────────────────
// PATCH /api/notifications/read
// ─────────────────────────────────────────────
app.patch('/api/notifications/read', async (req, res) => {
    const { ids } = req.body;
    try {
        if (ids === 'all') {
            await db.execute(`UPDATE notifications SET is_read = 1`);
        } else if (Array.isArray(ids) && ids.length) {
            await db.execute(
                `UPDATE notifications SET is_read = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
                ids
            );
        }
        res.json({ success: true, message: 'Уведомления прочитаны' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ─────────────────────────────────────────────
// PUT /api/orders/:id/assign
// ─────────────────────────────────────────────
app.put('/api/orders/:id/assign', async (req, res) => {
    const { id } = req.params;
    const { master_id, diagnosis_time, repair_time, equipment_id, deadline } = req.body;
    try {
        await db.execute(
            `UPDATE orders
             SET master_id      = ?,
                 diagnosis_time = ?,
                 repair_time    = ?,
                 equipment_id   = ?,
                 deadline       = ?
             WHERE id = ?`,
            [master_id || null, diagnosis_time || 30, repair_time || 60,
             equipment_id || null, deadline || null, id]
        );
        res.json({ success: true, message: 'Заказ обновлён' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

// ─────────────────────────────────────────────
// АВТОМАТИЧЕСКОЕ ПЕРЕПЛАНИРОВАНИЕ
// ─────────────────────────────────────────────
async function autoRebuildSchedule() {
    const [masterRows] = await db.execute(
        `SELECT id, name FROM users WHERE role = 'master'`
    );
    if (!masterRows.length) {
        console.log('Нет мастеров — автопланирование пропущено');
        return;
    }

    const orders = await getOrdersForScheduler(true);
    if (!orders.length) return;

    const result = scheduler.buildSchedule(orders, masterRows, { dayStartHour: 9 });
    const today  = new Date();

    await db.execute(`DELETE FROM schedule WHERE DATE(start_time) = CURDATE()`);

    for (const [masterId, data] of Object.entries(result.masterSchedules)) {
        const withDates = scheduler.scheduleToDatetime(data.schedule, today);
        for (const slot of withDates) {
            await db.execute(
                `INSERT INTO schedule
                    (order_id, master_id, equipment_id, stage, start_time, end_time)
                 VALUES (?, ?, ?, 'diagnosis', ?, ?)`,
                [slot.order_id, masterId, slot.equipment_id || null,
                 slot.diag_start_dt, slot.diag_end_dt]
            );
            await db.execute(
                `INSERT INTO schedule
                    (order_id, master_id, equipment_id, stage, start_time, end_time)
                 VALUES (?, ?, ?, 'repair', ?, ?)`,
                [slot.order_id, masterId, slot.equipment_id || null,
                 slot.repair_start_dt, slot.end_time_dt]
            );
            await db.execute(
                `UPDATE orders SET master_id = ? WHERE id = ? AND master_id IS NULL`,
                [masterId, slot.order_id]
            );
        }
    }

    for (const warn of result.warnings) {
        const [existing] = await db.execute(
            `SELECT id FROM notifications
             WHERE order_id = ? AND type = 'deadline_risk' AND DATE(created_at) = CURDATE()`,
            [warn.order_id]
        );
        if (!existing.length) {
            await db.execute(
                `INSERT INTO notifications (order_id, type, message) VALUES (?, 'deadline_risk', ?)`,
                [warn.order_id,
                 `Заказ #${warn.order_id} рискует быть выполнен с опозданием на ${warn.overdue_min} мин`]
            );
        }
    }

    console.log(`Автопланирование: ${result.algorithm}, ${orders.length} заказов, ${masterRows.length} мастеров`);

    notifyMaster(null, { reason: 'schedule_rebuilt' });
}

// ─────────────────────────────────────────────
// SSE: REAL-TIME ОБНОВЛЕНИЯ ДЛЯ МАСТЕРОВ
// ─────────────────────────────────────────────
const sseClients = {};

// ─────────────────────────────────────────────
// SSE: REAL-TIME УВЕДОМЛЕНИЯ ДЛЯ КЛИЕНТОВ
// ─────────────────────────────────────────────
const sseClientsByPhone = {};

app.get('/api/sse/queue', (req, res) => {
    const masterId = parseInt(req.query.master_id);
    if (!masterId) {
        return res.status(400).json({ success: false, message: 'Нужен master_id' });
    }

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write('event: connected\ndata: {"ok":true}\n\n');

    if (!sseClients[masterId]) sseClients[masterId] = [];
    sseClients[masterId].push(res);

    console.log(`SSE: мастер ${masterId} подключился (всего: ${sseClients[masterId].length})`);

    const keepalive = setInterval(() => {
        res.write(': keepalive\n\n');
    }, 25000);

    req.on('close', () => {
        clearInterval(keepalive);
        if (sseClients[masterId]) {
            sseClients[masterId] = sseClients[masterId].filter(c => c !== res);
        }
        console.log(`SSE: мастер ${masterId} отключился`);
    });
});

function notifyMaster(masterId, payload = {}) {
    const data = JSON.stringify({ ts: Date.now(), ...payload });

    if (masterId) {
        const clients = sseClients[masterId] || [];
        clients.forEach(res => res.write(`event: queue_updated\ndata: ${data}\n\n`));
    } else {
        for (const clients of Object.values(sseClients)) {
            clients.forEach(res => res.write(`event: queue_updated\ndata: ${data}\n\n`));
        }
    }
}

app.get('/api/sse/cabinet', (req, res) => {
    const phone = req.query.phone;
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Нужен phone' });
    }

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write('event: connected\ndata: {"ok":true}\n\n');

    if (!sseClientsByPhone[phone]) sseClientsByPhone[phone] = [];
    sseClientsByPhone[phone].push(res);

    console.log(`SSE: клиент ${phone} подключился`);

    const keepalive = setInterval(() => {
        res.write(': keepalive\n\n');
    }, 25000);

    req.on('close', () => {
        clearInterval(keepalive);
        if (sseClientsByPhone[phone]) {
            sseClientsByPhone[phone] = sseClientsByPhone[phone].filter(c => c !== res);
        }
        console.log(`SSE: клиент ${phone} отключился`);
    });
});

function notifyClient(phone, payload = {}) {
    const clients = sseClientsByPhone[phone] || [];
    const data = JSON.stringify({ ts: Date.now(), ...payload });
    clients.forEach(c => c.write(`event: order_status\ndata: ${data}\n\n`));
}

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});