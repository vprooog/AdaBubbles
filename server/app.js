const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// Раздаём статические файлы (твой фронтенд)
app.use(express.static(path.join(__dirname, '../public')));

// Простая регистрация (пока в памяти)
let users = [];
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  users.push({ username, password });
  res.json({ ok: true });
});

// Сообщения (пока в памяти)
let messages = [];
app.post('/api/message', (req, res) => {
  const { from, text } = req.body;
  messages.push({ from, text });
  res.json({ ok: true });
});
app.get('/api/messages', (req, res) => res.json(messages));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
