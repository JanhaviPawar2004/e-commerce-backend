// const mysql = require('mysql2');

// const pool = mysql.createPool({
//   host: 'localhost',     // or your DB host
//   user: 'root',          // your MySQL username
//   password: '',          // your MySQL password
//   database: 'new-e-commerce', // your DB name
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// module.exports = pool;

const mysql = require('mysql2');
require('dotenv').config();  // Load .env variables

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,  // include port
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
