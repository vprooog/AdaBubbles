// ============================================
// server/app.js — ОБНОВЛЁННАЯ ВЕРСИЯ С АДМИНКОЙ
// ============================================
// Замени содержимое своего server/app.js на этот код

const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ============================================
// ХРАНИЛИЩЕ ДАННЫХ (в памяти)
// В продакшене заменить на MongoDB/PostgreSQL
// ============================================
const db = {
    // Админ (можно изменить или вынести в env)
    admin: {
        username: process.env.ADMIN_USERNAME || 'ada',
        password: process.env.ADMIN_PASSWORD || 'bubbles2025',
        tokens: [] // активные токены
    },
    
    // Пользователи
    users: [],
    
    // Сообщения
    messages: [],
    
    // Посты/контент
    posts: [
        {
            id: 1,
            title: 'Welcome to My World',
            type: 'free',
            description: 'First post!',
            image: '',
            createdAt: new Date().toISOString()
        }
    ],
    
    // Статистика
    stats: {
        totalCoins: 0
    }
};

// ============================================
// HELPERS
// ============================================
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function verifyAdminToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!db.admin.tokens.includes(token)) {
        return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
    
    next();
}

// ============================================
// ПУБЛИЧНЫЕ API (без авторизации)
// ============================================

// Регистрация пользователя
app.post('/api/register', (req, res) => {
    const { username, email, password, name } = req.body;
    
    // Проверка на дубликат
    const exists = db.users.find(u => u.username === username || u.email === email);
    if (exists) {
        return res.status(400).json({ ok: false, error: 'User already exists' });
    }
    
    const user = {
        id: Date.now().toString(),
        username,
        email,
        name: name || username,
        password, // В продакшене хэшировать!
        coins: 50, // Стартовый бонус
        createdAt: new Date().toISOString()
    };
    
    db.users.push(user);
    
    res.json({ ok: true, user: { ...user, password: undefined } });
});

// Отправка сообщения
app.post('/api/message', (req, res) => {
    const { from, text } = req.body;
    
    const message = {
        id: Date.now(),
        from,
        text,
        timestamp: new Date().toISOString()
    };
    
    db.messages.push(message);
    
    res.json({ ok: true });
});

// Получение сообщений (публичное, можно ограничить)
app.get('/api/messages', (req, res) => {
    res.json(db.messages);
});

// Получение постов для главной страницы
app.get('/api/posts', (req, res) => {
    // Возвращаем посты без sensitive данных
    res.json(db.posts.map(p => ({
        id: p.id,
        title: p.title,
        type: p.type,
        description: p.description,
        image: p.image,
        createdAt: p.createdAt
    })));
});

// ============================================
// АДМИН API
// ============================================

// Логин админа
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === db.admin.username && password === db.admin.password) {
        const token = generateToken();
        db.admin.tokens.push(token);
        
        // Ограничиваем количество токенов (максимум 5)
        if (db.admin.tokens.length > 5) {
            db.admin.tokens.shift();
        }
        
        res.json({ ok: true, token });
    } else {
        res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
});

// Верификация токена
app.get('/api/admin/verify', verifyAdminToken, (req, res) => {
    res.json({ ok: true });
});

// Выход (инвалидация токена)
app.post('/api/admin/logout', verifyAdminToken, (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    db.admin.tokens = db.admin.tokens.filter(t => t !== token);
    res.json({ ok: true });
});

// Смена пароля
app.post('/api/admin/password', verifyAdminToken, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (currentPassword !== db.admin.password) {
        return res.status(400).json({ ok: false, error: 'Current password is incorrect' });
    }
    
    db.admin.password = newPassword;
    // Инвалидируем все токены
    db.admin.tokens = [];
    
    res.json({ ok: true });
});

// Статистика
app.get('/api/admin/stats', verifyAdminToken, (req, res) => {
    res.json({
        users: db.users.length,
        messages: db.messages.length,
        posts: db.posts.length,
        coins: db.stats.totalCoins
    });
});

// ============================================
// АДМИН: USERS
// ============================================

// Список пользователей
app.get('/api/admin/users', verifyAdminToken, (req, res) => {
    // Убираем пароли из ответа
    const users = db.users.map(u => ({ ...u, password: undefined }));
    res.json(users);
});

// Получить одного пользователя
app.get('/api/admin/users/:id', verifyAdminToken, (req, res) => {
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) {
        return res.status(404).json({ ok: false, error: 'User not found' });
    }
    res.json({ ...user, password: undefined });
});

// Удалить пользователя
app.delete('/api/admin/users/:id', verifyAdminToken, (req, res) => {
    const index = db.users.findIndex(u => u.id === req.params.id || u.username === req.params.id);
    if (index === -1) {
        return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    db.users.splice(index, 1);
    res.json({ ok: true });
});

// Обновить пользователя (например, добавить коины)
app.patch('/api/admin/users/:id', verifyAdminToken, (req, res) => {
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) {
        return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    // Разрешаем обновлять только определённые поля
    const { coins, name, email } = req.body;
    if (coins !== undefined) user.coins = coins;
    if (name) user.name = name;
    if (email) user.email = email;
    
    res.json({ ok: true, user: { ...user, password: undefined } });
});

// ============================================
// АДМИН: MESSAGES
// ============================================

// Список сообщений
app.get('/api/admin/messages', verifyAdminToken, (req, res) => {
    res.json(db.messages);
});

// Удалить сообщение
app.delete('/api/admin/messages/:index', verifyAdminToken, (req, res) => {
    const index = parseInt(req.params.index);
    if (isNaN(index) || index < 0 || index >= db.messages.length) {
        return res.status(404).json({ ok: false, error: 'Message not found' });
    }
    
    db.messages.splice(index, 1);
    res.json({ ok: true });
});

// Удалить все сообщения
app.delete('/api/admin/messages', verifyAdminToken, (req, res) => {
    db.messages = [];
    res.json({ ok: true });
});

// ============================================
// АДМИН: POSTS/CONTENT
// ============================================

// Список постов
app.get('/api/admin/posts', verifyAdminToken, (req, res) => {
    res.json(db.posts);
});

// Создать пост
app.post('/api/admin/posts', verifyAdminToken, (req, res) => {
    const { title, type, description, image } = req.body;
    
    const post = {
        id: Date.now(),
        title,
        type: type || 'free',
        description: description || '',
        image: image || '',
        createdAt: new Date().toISOString()
    };
    
    db.posts.unshift(post); // Добавляем в начало
    res.json({ ok: true, post });
});

// Обновить пост
app.patch('/api/admin/posts/:id', verifyAdminToken, (req, res) => {
    const post = db.posts.find(p => p.id === parseInt(req.params.id));
    if (!post) {
        return res.status(404).json({ ok: false, error: 'Post not found' });
    }
    
    const { title, type, description, image } = req.body;
    if (title) post.title = title;
    if (type) post.type = type;
    if (description !== undefined) post.description = description;
    if (image !== undefined) post.image = image;
    
    res.json({ ok: true, post });
});

// Удалить пост
app.delete('/api/admin/posts/:id', verifyAdminToken, (req, res) => {
    const index = db.posts.findIndex(p => p.id === parseInt(req.params.id));
    if (index === -1) {
        return res.status(404).json({ ok: false, error: 'Post not found' });
    }
    
    db.posts.splice(index, 1);
    res.json({ ok: true });
});

// ============================================
// FALLBACK — отдаём index.html для SPA
// ============================================
app.get('*', (req, res) => {
    // Если это API запрос — 404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    
    // Иначе отдаём index.html
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║     🌸 Ada Bubbles Server Started      ║
╠════════════════════════════════════════╣
║  Local:   http://localhost:${PORT}        ║
║  Admin:   http://localhost:${PORT}/admin.html
║                                        ║
║  Admin credentials:                    ║
║  Username: ${db.admin.username.padEnd(25)}║
║  Password: ${db.admin.password.padEnd(25)}║
╚════════════════════════════════════════╝
    `);
});

module.exports = app;
