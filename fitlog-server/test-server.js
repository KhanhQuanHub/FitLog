// ================================================================
// test-server.js - KỊCH BẢN KIỂM THỬ TỰ ĐỘNG CHO SERVER FIGLOG
// Bao gồm:
//   - Phần A: 24 ca kiểm thử phân quyền RBAC & xác thực hiện có
//   - Phần B: 12 ca kiểm thử mới cho POST/PATCH /runs (validate 422,
//             idempotent theo clientId, phân trang lịch sử)
// Chạy lệnh: node test-server.js
// ================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const jsonServer = require('json-server');
const authMiddleware = require('./auth');

const PORT = 3456;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_JSONC = path.join(__dirname, 'db.jsonc');
const DB_JSON = path.join(__dirname, 'db.json');

function rebuildDatabase() {
    const src = fs.readFileSync(DB_JSONC, 'utf8');
    const clean = src
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');
    const data = JSON.parse(clean);
    fs.writeFileSync(DB_JSON, JSON.stringify(data, null, 2));
}

async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.headers || {}),
    };
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = null;
    try {
        data = await res.json();
    } catch {
        data = null;
    }
    return { status: res.status, data };
}

async function runAllTests() {
    rebuildDatabase();

    const app = jsonServer.create();
    const router = jsonServer.router(DB_JSON);
    const defaults = jsonServer.defaults({ logger: false, bodyParser: true });

    app.use(defaults);
    app.use(authMiddleware);
    app.db = router.db;
    app.use(router);

    const server = await new Promise((resolve) => {
        const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
    });

    const results = [];
    async function testCase(id, name, fn) {
        try {
            await fn();
            results.push({ id, name, passed: true });
            console.log(`[PASS] #${id}: ${name}`);
        } catch (err) {
            results.push({ id, name, passed: false, error: err.message });
            console.error(`[FAIL] #${id}: ${name} -> ${err.message}`);
        }
    }

    try {
        let user1Token = '';
        let user2Token = '';
        let adminToken = '';

        // ==================== PHẦN A: 24 CA KIỂM THỬ RBAC CŨ ====================
        await testCase(1, 'POST /login thành công với tài khoản user 1, trả về token & ẩn password', async () => {
            const res = await apiCall('/login', {
                method: 'POST',
                body: { email: 'quan@figlog.vn', password: '123456' },
            });
            assert.strictEqual(res.status, 200);
            assert.ok(res.data.token);
            assert.strictEqual(res.data.user.id, 1);
            assert.strictEqual(res.data.user.password, undefined);
            user1Token = res.data.token;
        });

        await testCase(2, 'POST /login thành công với tài khoản user 2 & admin', async () => {
            const res2 = await apiCall('/login', {
                method: 'POST',
                body: { email: 'ha@figlog.vn', password: '123456' },
            });
            const resAdmin = await apiCall('/login', {
                method: 'POST',
                body: { email: 'admin@figlog.vn', password: 'admin123' },
            });
            assert.strictEqual(res2.status, 200);
            assert.strictEqual(resAdmin.status, 200);
            user2Token = res2.data.token;
            adminToken = resAdmin.data.token;
        });

        await testCase(3, 'POST /login sai mật khẩu trả về 401', async () => {
            const res = await apiCall('/login', {
                method: 'POST',
                body: { email: 'quan@figlog.vn', password: 'wrong' },
            });
            assert.strictEqual(res.status, 401);
        });

        await testCase(4, 'POST /users đăng ký công khai thành công (201) và tự ép role="user", ẩn password', async () => {
            const res = await apiCall('/users', {
                method: 'POST',
                body: {
                    email: 'newuser@figlog.vn',
                    password: '123456',
                    fullName: 'Người Dùng Mới',
                    role: 'admin',
                },
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.data.role, 'user');
            assert.strictEqual(res.data.password, undefined);
        });

        await testCase(5, 'POST /users thiếu email hoặc mật khẩu trả về 400', async () => {
            const res = await apiCall('/users', {
                method: 'POST',
                body: { email: 'missingpass@figlog.vn' },
            });
            assert.strictEqual(res.status, 400);
        });

        await testCase(6, 'POST /users trùng email đã có trả về 409', async () => {
            const res = await apiCall('/users', {
                method: 'POST',
                body: { email: 'quan@figlog.vn', password: '123456' },
            });
            assert.strictEqual(res.status, 409);
        });

        await testCase(7, 'GET /goals công khai không cần token trả về 200', async () => {
            const res = await apiCall('/goals');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.length, 8);
        });

        await testCase(8, 'GET /exercises công khai không cần token trả về 200', async () => {
            const res = await apiCall('/exercises');
            assert.strictEqual(res.status, 200);
            assert.ok(res.data.length >= 8);
        });

        await testCase(9, 'POST /exercises không có token trả về 401', async () => {
            const res = await apiCall('/exercises', {
                method: 'POST',
                body: { name: 'Bài tập mới' },
            });
            assert.strictEqual(res.status, 401);
        });

        await testCase(10, 'POST /exercises bằng token user thường bị chặn 403', async () => {
            const res = await apiCall('/exercises', {
                method: 'POST',
                token: user1Token,
                body: { name: 'Bài tập trái phép' },
            });
            assert.strictEqual(res.status, 403);
        });

        await testCase(11, 'POST /exercises bằng token admin thành công 201', async () => {
            const res = await apiCall('/exercises', {
                method: 'POST',
                token: adminToken,
                body: {
                    name: 'Burpees',
                    muscleGroup: 'Toàn thân',
                    equipment: 'none',
                    met: 9.0,
                    impact: 'high',
                    sets: 3,
                    reps: 10,
                    durationSec: 0,
                    youtubeId: 'YOUTUBE_VIDEO_ID',
                },
            });
            assert.strictEqual(res.status, 201);
        });

        await testCase(12, 'GET /workouts không có token trả về 401', async () => {
            const res = await apiCall('/workouts');
            assert.strictEqual(res.status, 401);
        });

        await testCase(13, 'GET /workouts?userId=2 với token user 1 vẫn chỉ trả về dữ liệu của user 1', async () => {
            const res = await apiCall('/workouts?userId=2', { token: user1Token });
            assert.strictEqual(res.status, 200);
            assert.ok(res.data.length > 0);
            assert.ok(res.data.every((w) => w.userId === 1));
        });

        await testCase(14, 'POST /workouts với userId giả mạo (=2) bị server tự ép về userId=1', async () => {
            const res = await apiCall('/workouts', {
                method: 'POST',
                token: user1Token,
                body: {
                    userId: 2,
                    exerciseId: 1,
                    date: '2026-10-28',
                    time: '19:00',
                    status: 'done',
                    durationMin: 20,
                    caloriesBurned: 90,
                    note: 'Test ép userId',
                },
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.data.userId, 1);
        });

        await testCase(15, 'GET /workouts/1 (của user 1) bằng token user 1 trả về 200', async () => {
            const res = await apiCall('/workouts/1', { token: user1Token });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.userId, 1);
        });

        await testCase(16, 'GET /workouts/5 (của user 2) bằng token user 1 bị chặn 403', async () => {
            const res = await apiCall('/workouts/5', { token: user1Token });
            assert.strictEqual(res.status, 403);
        });

        await testCase(17, 'PATCH /workouts/1 bằng token user 1 thành công và không cho đổi userId', async () => {
            const res = await apiCall('/workouts/1', {
                method: 'PATCH',
                token: user1Token,
                body: { note: 'Đã cập nhật', userId: 2 },
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.userId, 1);
            assert.strictEqual(res.data.note, 'Đã cập nhật');
        });

        await testCase(18, 'PATCH /workouts/5 (của user 2) bằng token user 1 bị chặn 403', async () => {
            const res = await apiCall('/workouts/5', {
                method: 'PATCH',
                token: user1Token,
                body: { note: 'Sửa trộm' },
            });
            assert.strictEqual(res.status, 403);
        });

        await testCase(19, 'DELETE /workouts/5 (của user 2) bằng token user 1 bị chặn 403', async () => {
            const res = await apiCall('/workouts/5', {
                method: 'DELETE',
                token: user1Token,
            });
            assert.strictEqual(res.status, 403);
        });

        await testCase(20, 'GET /users bằng token user thường bị chặn 403', async () => {
            const res = await apiCall('/users', { token: user1Token });
            assert.strictEqual(res.status, 403);
        });

        await testCase(21, 'GET /users bằng token admin trả về 200 và đã xóa hết password', async () => {
            const res = await apiCall('/users', { token: adminToken });
            assert.strictEqual(res.status, 200);
            assert.ok(res.data.every((u) => u.password === undefined));
        });

        await testCase(22, 'GET /users/1 bằng token user 1 trả về 200, GET /users/2 bị chặn 403', async () => {
            const own = await apiCall('/users/1', { token: user1Token });
            const other = await apiCall('/users/2', { token: user1Token });
            assert.strictEqual(own.status, 200);
            assert.strictEqual(own.data.password, undefined);
            assert.strictEqual(other.status, 403);
        });

        await testCase(23, 'PATCH /users/1 cố tình gửi role="admin" bị loại bỏ trường role', async () => {
            const res = await apiCall('/users/1', {
                method: 'PATCH',
                token: user1Token,
                body: { fullName: 'Nguyễn Khánh Quân (Updated)', role: 'admin' },
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.role, 'user');
        });

        await testCase(24, 'Đường dẫn lồng nhau /users/1/workouts bị chặn 403 và token giả bị chặn 401', async () => {
            const nested = await apiCall('/users/1/workouts', { token: user1Token });
            const badToken = await apiCall('/workouts', { token: 'token.gia.mao' });
            assert.strictEqual(nested.status, 403);
            assert.strictEqual(badToken.status, 401);
        });

        // ==================== PHẦN B: 12 CA KIỂM THỬ MỚI CHO /runs ====================
        const validRunPayload = {
            clientId: 'r_1761640000000_test01',
            date: '2026-10-28',
            startedAt: '2026-10-28T06:00:00.000Z',
            endedAt: '2026-10-28T06:30:00.000Z',
            source: 'pedometer',
            steps: 5645,
            strideM: 0.726,
            strideSource: 'formula',
            distanceKm: 4.10,
            durationSec: 1800,
            pausedSec: 0,
            avgSpeedKmh: 8.2,
            paceSecPerKm: 439,
            cadenceSpm: 188,
            met: 8.35,
            weightKg: 60,
            calories: 251,
            splits: [{ km: 1, sec: 439 }],
            note: 'Buổi chạy hợp lệ',
        };

        let createdRunId = null;

        await testCase(25, 'POST /runs hợp lệ trả về 201 và tự ép userId=1', async () => {
            const res = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...validRunPayload, userId: 999 },
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.data.userId, 1);
            assert.strictEqual(res.data.clientId, 'r_1761640000000_test01');
            createdRunId = res.data.id;
        });

        await testCase(26, 'Idempotent: POST /runs gửi lại cùng clientId cho cùng userId trả về 200 với bản ghi cũ, không tạo mới', async () => {
            const res = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: validRunPayload,
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.id, createdRunId);

            // Kiểm tra tổng số bản ghi có clientId này chỉ đúng là 1
            const listRes = await apiCall('/runs?clientId=r_1761640000000_test01', {
                token: user1Token,
            });
            assert.strictEqual(listRes.data.length, 1);
        });

        await testCase(27, 'POST /runs thiếu trường bắt buộc (thiếu steps) trả về 422 kèm thông báo tiếng Việt', async () => {
            const { steps: _omit, ...missingSteps } = validRunPayload;
            const res = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...missingSteps, clientId: 'r_test_missing' },
            });
            assert.strictEqual(res.status, 422);
            assert.ok(res.data.error.includes('steps'));
        });

        await testCase(28, 'POST /runs có steps ngoài 0–100000 (ví dụ -10 hoặc 100001) trả về 422', async () => {
            const negRes = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...validRunPayload, clientId: 'r_neg_steps', steps: -10 },
            });
            const overRes = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...validRunPayload, clientId: 'r_over_steps', steps: 100001 },
            });
            assert.strictEqual(negRes.status, 422);
            assert.strictEqual(overRes.status, 422);
        });

        await testCase(29, 'POST /runs có durationSec ngoài 10–21600 (ví dụ 5s hoặc 25000s) trả về 422', async () => {
            const shortRes = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...validRunPayload, clientId: 'r_short_dur', durationSec: 5 },
            });
            const longRes = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...validRunPayload, clientId: 'r_long_dur', durationSec: 25000 },
            });
            assert.strictEqual(shortRes.status, 422);
            assert.strictEqual(longRes.status, 422);
        });

        await testCase(30, 'POST /runs có avgSpeedKmh > 25 trả về 422', async () => {
            const res = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...validRunPayload, clientId: 'r_fast_speed', avgSpeedKmh: 26.5 },
            });
            assert.strictEqual(res.status, 422);
            assert.ok(res.data.error.includes('25'));
        });

        await testCase(31, 'POST /runs có calories > 3000 trả về 422', async () => {
            const res = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...validRunPayload, clientId: 'r_high_cal', calories: 3500 },
            });
            assert.strictEqual(res.status, 422);
            assert.ok(res.data.error.includes('3000'));
        });

        await testCase(32, 'POST /runs có date sai định dạng YYYY-MM-DD trả về 422', async () => {
            const res1 = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...validRunPayload, clientId: 'r_bad_date1', date: '28/10/2026' },
            });
            const res2 = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...validRunPayload, clientId: 'r_bad_date2', date: '2026-02-30' },
            });
            assert.strictEqual(res1.status, 422);
            assert.strictEqual(res2.status, 422);
        });

        await testCase(33, 'POST /runs có |distanceKm - steps*strideM/1000| > 0.05 trả về 422', async () => {
            // 5645 * 0.726 / 1000 = 4.09827 km. Nếu gửi 4.20 km (lệch 0.1017 km > 0.05) -> 422
            const res = await apiCall('/runs', {
                method: 'POST',
                token: user1Token,
                body: { ...validRunPayload, clientId: 'r_bad_dist', distanceKm: 4.20 },
            });
            assert.strictEqual(res.status, 422);
            assert.ok(res.data.error.includes('0.05'));
        });

        await testCase(34, 'PATCH /runs/:id vi phạm công thức hoặc ngưỡng cũng trả về 422', async () => {
            const badPatch = await apiCall(`/runs/${createdRunId}`, {
                method: 'PATCH',
                token: user1Token,
                body: { distanceKm: 9.99 },
            });
            assert.strictEqual(badPatch.status, 422);

            const goodPatch = await apiCall(`/runs/${createdRunId}`, {
                method: 'PATCH',
                token: user1Token,
                body: { note: 'Cập nhật ghi chú hợp lệ' },
            });
            assert.strictEqual(goodPatch.status, 200);
            assert.strictEqual(goodPatch.data.note, 'Cập nhật ghi chú hợp lệ');
        });

        await testCase(35, 'RBAC trên /runs: User 1 không thể xem hoặc PATCH buổi chạy của User 2 (id=5)', async () => {
            const getOther = await apiCall('/runs/5', { token: user1Token });
            const patchOther = await apiCall('/runs/5', {
                method: 'PATCH',
                token: user1Token,
                body: { note: 'Hack' },
            });
            assert.strictEqual(getOther.status, 403);
            assert.strictEqual(patchOther.status, 403);
        });

        await testCase(36, 'Phân trang lịch sử: GET /runs?_sort=startedAt&_order=desc&_page=1&_limit=20 chỉ trả về runs của user đó', async () => {
            const res1 = await apiCall('/runs?_sort=startedAt&_order=desc&_page=1&_limit=20', {
                token: user1Token,
            });
            const res2 = await apiCall('/runs?_sort=startedAt&_order=desc&_page=1&_limit=20', {
                token: user2Token,
            });
            assert.strictEqual(res1.status, 200);
            assert.strictEqual(res2.status, 200);
            assert.ok(res1.data.every((r) => r.userId === 1));
            assert.ok(res2.data.every((r) => r.userId === 2));
            // Kiểm tra thứ tự giảm dần theo startedAt
            for (let i = 0; i < res1.data.length - 1; i += 1) {
                assert.ok(res1.data[i].startedAt >= res1.data[i + 1].startedAt);
            }
        });
    } finally {
        await new Promise((resolve) => server.close(resolve));
        // Khôi phục lại db.json sạch từ db.jsonc sau khi chạy kiểm thử
        rebuildDatabase();
    }

    const failed = results.filter((r) => !r.passed);
    console.log(
        `\n========================================\nKẾT QUẢ KIỂM THỬ SERVER: ${
            results.length - failed.length
        }/${results.length} CA THÀNH CÔNG\n========================================`
    );
    if (failed.length > 0) {
        process.exit(1);
    }
}

runAllTests().catch((err) => {
    console.error('Lỗi thực thi test-server:', err);
    process.exit(1);
});
