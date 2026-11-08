// Chỉ xóa các dòng mà ký tự đầu tiên (sau khoảng trắng) là //
const fs = require('fs');
const path = require('path');
const { migrateUsers } = require('./passwords');
const src = fs.readFileSync(path.join(__dirname, 'db.jsonc'), 'utf8');
const clean = src
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
const data = JSON.parse(clean); // báo lỗi ngay nếu JSON sai cú pháp
migrateUsers(data.users);
fs.writeFileSync(path.join(__dirname, 'db.json'), JSON.stringify(data, null, 2));
console.log('Đã tạo db.json với các bảng:', Object.keys(data).join(', '));