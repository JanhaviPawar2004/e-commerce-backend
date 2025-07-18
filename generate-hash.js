// generate-hash.js
const bcrypt = require('bcryptjs');

const password = 'adminpass211';
const hash = bcrypt.hashSync(password, 10);

console.log('Hashed password:', hash);
