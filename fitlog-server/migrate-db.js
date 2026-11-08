const fs = require('fs');
const path = require('path');
const { migrateUsers } = require('./passwords');

const dbFile = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));

if (migrateUsers(db.users)) {
    fs.writeFileSync(dbFile, `${JSON.stringify(db, null, 2)}\n`);
    console.log('Đã băm mật khẩu người dùng trong db.json.');
}
