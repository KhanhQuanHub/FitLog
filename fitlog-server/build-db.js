// Chỉ xóa các dòng mà ký tự đầu tiên (sau khoảng trắng) là //
const fs = require('fs');
const src = fs.readFileSync('db.jsonc', 'utf8');
const clean = src
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
const data = JSON.parse(clean); // báo lỗi ngay nếu JSON sai cú pháp
fs.writeFileSync('db.json', JSON.stringify(data, null, 2));
console.log('Đã tạo db.json với các bảng:', Object.keys(data).join(', '));