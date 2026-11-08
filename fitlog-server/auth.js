// ================================================================
// auth.js - ĐĂNG NHẬP + PHÂN QUYỀN (RBAC) + KIỂM TRA & CHỐNG TRÙNG /runs
// Luồng xử lý mỗi request:
//   1. POST /login            -> kiểm tra email/mật khẩu, trả về token
//   2. Đường dẫn công khai    -> cho qua không cần token
//   3. Còn lại                -> bắt buộc có token (header Authorization)
//   4. Kiểm tra quyền theo vai trò (admin / user)
//   5. Với POST/PATCH/PUT /runs -> kiểm tra idempotent theo clientId & validate 422
// Đây là server demo; production cần HTTPS và cấu hình FIGLOG_SECRET riêng.
// ================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateRunPayload } = require('./validate');
const { hashPassword, migrateUsers, verifyPassword } = require('./passwords');

// ---------- CẤU HÌNH ----------
// Khóa bí mật ký token. Đổi thành chuỗi riêng, hoặc đặt biến môi trường FIGLOG_SECRET.
const SECRET = process.env.FIGLOG_SECRET || 'doi-chuoi-bi-mat-nay-truoc-khi-nop-bai';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // token sống 7 ngày
const DB_FILE = path.join(__dirname, 'db.json');

// ---------- BẢNG PHÂN QUYỀN ----------
const OWNED = ['profiles', 'weightHistory', 'userGoals', 'workouts', 'runs']; // có cột userId
const PUBLIC_READ = ['goals', 'exercises']; // ai cũng đọc được, chỉ admin được ghi

// ---------- HÀM PHỤ ----------
const readDb = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

function migrateRequestDb(req) {
    const db = getDbState(req);
    if (!migrateUsers(db.users)) return;

    if (req.app && req.app.db && typeof req.app.db.write === 'function') {
        req.app.db.write();
    } else {
        fs.writeFileSync(DB_FILE, `${JSON.stringify(db, null, 2)}\n`);
    }
}

// Ưu tiên đọc từ bộ nhớ lowdb của json-server (req.app.db) để đảm bảo nhất quán tức thời
// ngay cả khi 2 request gửi liên tiếp trước khi steno kịp ghi xuống đĩa.
const getDbState = (req) => {
    if (req && req.app && req.app.db && typeof req.app.db.getState === 'function') {
        return req.app.db.getState();
    }
    return readDb();
};

const hmac = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');

// Token = <payload base64>.<chữ ký>. Sửa payload là chữ ký sai ngay.
function signToken(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${hmac(body)}`;
}

function verifyToken(token) {
    const [body, sig] = (token || '').split('.');
    if (!body || !sig) return null;
    const expected = hmac(body);
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        return payload.exp > Date.now() ? payload : null; // hết hạn thì bỏ
    } catch {
        return null;
    }
}

// Xóa trường password khỏi mọi dữ liệu trả về (kể cả khi dùng _expand=user)
const strip = (d) =>
    Array.isArray(d)
        ? d.map(strip)
        : d && typeof d === 'object'
            ? Object.fromEntries(
                Object.entries(d)
                    .filter(([k]) => k !== 'password')
                    .map(([k, v]) => [k, strip(v)])
            )
            : d;

const deny = (res, code, message) => res.status(code).json({ error: message });

/**
 * Xử lý kiểm tra idempotent (chống ghi trùng theo clientId + userId)
 * và kiểm tra hợp lệ dữ liệu (422) cho bảng "runs".
 * Trả về true nếu đã kết thúc response (200 idempotent hoặc 422 lỗi), false nếu cho đi tiếp.
 */
function handleRunsValidationAndIdempotency(req, res, id, effectiveUserId) {
    const method = req.method;
    const dbState = getDbState(req);
    const runs = dbState.runs || [];

    // POST /runs
    if (method === 'POST' && !id) {
        const body = req.body || {};

        // 1. Idempotent: nếu clientId đã tồn tại cho cùng userId -> trả 200 với bản ghi cũ
        if (typeof body.clientId === 'string' && body.clientId.trim() !== '') {
            const existingRun = runs.find(
                (r) =>
                    String(r.userId) === String(effectiveUserId) &&
                    r.clientId === body.clientId.trim()
            );
            if (existingRun) {
                res.status(200).json(strip(existingRun));
                return true;
            }
        }

        // 2. Kiểm tra dữ liệu hợp lệ (trả 422 kèm thông báo tiếng Việt nếu vi phạm)
        const check = validateRunPayload(body, { isPatch: false });
        if (!check.valid) {
            deny(res, 422, check.message);
            return true;
        }
        return false;
    }

    // PATCH / PUT /runs/:id
    if ((method === 'PATCH' || method === 'PUT') && id) {
        const existingRow = runs.find((r) => String(r.id) === String(id));
        if (!existingRow) {
            // Bản ghi không tồn tại -> để json-server tự trả 404
            return false;
        }
        const check = validateRunPayload(req.body || {}, {
            isPatch: method === 'PATCH',
            existingRow,
        });
        if (!check.valid) {
            deny(res, 422, check.message);
            return true;
        }
        return false;
    }

    return false;
}

// ---------- MIDDLEWARE CHÍNH ----------
module.exports = (req, res, next) => {
    migrateRequestDb(req);

    // Mọi dữ liệu json-server trả về đều đi qua res.jsonp -> chặn để xóa password
    const originalJsonp = res.jsonp.bind(res);
    res.jsonp = (data) => originalJsonp(strip(data));

    if (req.method === 'OPTIONS') return next(); // preflight CORS

    const parts = req.path.split('/').filter(Boolean); // '/workouts/3' -> ['workouts','3']
    const resource = parts[0];
    const id = parts[1];
    const method = req.method;

    // ----- 1. ĐĂNG NHẬP: POST /login  body {email, password} -----
    if (method === 'POST' && req.path === '/login') {
        const { email, password } = req.body || {};
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const user = getDbState(req).users.find(
            (u) => String(u.email).trim().toLowerCase() === normalizedEmail
                && verifyPassword(password, u.password)
        );
        if (!user) return deny(res, 401, 'Sai email hoặc mật khẩu');
        const token = signToken({ id: user.id, role: user.role, exp: Date.now() + TOKEN_TTL_MS });
        return res.json({ token, user: strip(user) });
    }

    // ----- 2. ĐĂNG KÝ CÔNG KHAI: POST /users (chưa cần token) -----
    const payload = verifyToken((req.headers.authorization || '').replace('Bearer ', ''));
    if (method === 'POST' && resource === 'users' && !id && !payload) {
        const body = req.body || {};
        if (typeof body.email !== 'string' || !body.email.trim()
            || typeof body.password !== 'string' || !body.password) {
            return deny(res, 400, 'Thiếu email hoặc mật khẩu');
        }
        const email = body.email.trim().toLowerCase();
        if (getDbState(req).users.some((u) => String(u.email).trim().toLowerCase() === email)) {
            return deny(res, 409, 'Email đã tồn tại');
        }
        req.body = {
            email,
            password: hashPassword(body.password),
            fullName: body.fullName || '',
            role: 'user', // ÉP vai trò user, không cho tự đăng ký admin
            createdAt: new Date().toISOString(),
        };
        return next();
    }

    // ----- 3. DANH MỤC CÔNG KHAI: GET /goals, GET /exercises -----
    if (PUBLIC_READ.includes(resource) && method === 'GET') return next();

    // ----- 4. TỪ ĐÂY TRỞ ĐI BẮT BUỘC CÓ TOKEN -----
    if (!payload) return deny(res, 401, 'Chưa đăng nhập hoặc token hết hạn');

    // ----- 5. ADMIN: toàn quyền (nhưng vẫn kiểm tra dữ liệu /runs nếu POST/PATCH) -----
    if (payload.role === 'admin') {
        if (resource === 'users' && ['POST', 'PATCH', 'PUT'].includes(method)) {
            const hasPassword = req.body
                && Object.prototype.hasOwnProperty.call(req.body, 'password');
            if ((method === 'POST' || method === 'PUT') && !hasPassword) {
                return deny(res, 400, 'Thiếu mật khẩu');
            }
            if (hasPassword && (typeof req.body.password !== 'string' || !req.body.password)) {
                return deny(res, 400, 'Mật khẩu không hợp lệ');
            }
            if (hasPassword) req.body = { ...req.body, password: hashPassword(req.body.password) };
        }
        if (resource === 'runs' && parts.length <= 2) {
            const adminTargetUserId = req.body && req.body.userId ? req.body.userId : payload.id;
            if (method === 'POST' && !id) {
                req.body = { ...req.body, userId: adminTargetUserId };
            }
            if (handleRunsValidationAndIdempotency(req, res, id, adminTargetUserId)) {
                return;
            }
        }
        return next();
    }

    // ----- 6. USER THƯỜNG -----
    if (parts.length > 2) return deny(res, 403, 'Không được dùng đường dẫn lồng nhau');

    // 6a. Danh mục: user chỉ đọc (GET đã qua ở bước 3) -> mọi thao tác ghi bị chặn
    if (PUBLIC_READ.includes(resource)) return deny(res, 403, 'Chỉ admin được sửa danh mục');

    // 6b. Bảng của người dùng: chỉ đụng vào dòng có userId = mình
    if (OWNED.includes(resource)) {
        if (!id) {
            if (method === 'GET') {
                req.query.userId = String(payload.id); // ÉP lọc theo mình, bỏ qua userId client gửi
                return next();
            }
            if (method === 'POST') {
                req.body = { ...req.body, userId: payload.id }; // ÉP chủ sở hữu = mình
                if (resource === 'runs') {
                    if (handleRunsValidationAndIdempotency(req, res, id, payload.id)) {
                        return;
                    }
                }
                return next();
            }
            return deny(res, 405, 'Không hỗ trợ thao tác này');
        }
        const row = (getDbState(req)[resource] || []).find((r) => String(r.id) === id);
        if (row && row.userId !== payload.id) return deny(res, 403, 'Đây không phải dữ liệu của bạn');
        if (row && (method === 'PUT' || method === 'PATCH')) {
            req.body = { ...req.body, userId: payload.id }; // không cho đổi chủ sở hữu
            if (resource === 'runs') {
                if (handleRunsValidationAndIdempotency(req, res, id, payload.id)) {
                    return;
                }
            }
        }
        return next(); // row không tồn tại -> json-server tự trả 404
    }

    // 6c. Bảng users: chỉ xem / sửa HỒ SƠ CỦA MÌNH, không được đổi role
    if (resource === 'users') {
        if (!id) return deny(res, 403, 'Chỉ admin được xem danh sách người dùng');
        if (String(payload.id) !== id) return deny(res, 403, 'Chỉ xem được tài khoản của mình');
        if (method === 'GET') return next();
        if (method === 'PATCH') {
            const { role, id: _ignoreId, ...allowed } = req.body || {}; // loại role, id
            req.body = allowed;
            if (Object.prototype.hasOwnProperty.call(allowed, 'password')) {
                if (typeof allowed.password !== 'string' || !allowed.password) {
                    return deny(res, 400, 'Mật khẩu không hợp lệ');
                }
                req.body = { ...allowed, password: hashPassword(allowed.password) };
            }
            return next();
        }
        return deny(res, 405, 'Không hỗ trợ thao tác này');
    }

    return deny(res, 403, 'Không có quyền truy cập');
};
