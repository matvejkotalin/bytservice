const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bytservice',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = pool.promise();

// Проверка подключения
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Ошибка подключения к MySQL:', err.message);
    } else {
        console.log('Подключение к MySQL успешно');
        connection.release();
    }
});

module.exports = db;