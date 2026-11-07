import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import {
  buildPrioritizedSubnetUrls,
  isPrivateIpv4,
  probeFitLogServer,
  promoteMdnsToConcreteIp,
  raceServerCandidates,
} from './lanDiscovery.js';

function startHttpServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        port: addr.port,
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

test('isPrivateIpv4 nhận diện đúng các dải LAN nội bộ RFC 1918', () => {
  assert.equal(isPrivateIpv4('192.168.1.15'), true);
  assert.equal(isPrivateIpv4('10.88.237.42'), true);
  assert.equal(isPrivateIpv4('172.20.10.1'), true);
  assert.equal(isPrivateIpv4('172.31.255.254'), true);

  assert.equal(isPrivateIpv4('0.0.0.0'), false);
  assert.equal(isPrivateIpv4('172.32.0.1'), false);
  assert.equal(isPrivateIpv4('8.8.8.8'), false);
  assert.equal(isPrivateIpv4(''), false);
});

test('buildPrioritizedSubnetUrls tạo đủ 253 IP ứng viên và bỏ qua IP của chính điện thoại', () => {
  const urls = buildPrioritizedSubnetUrls('10.88.237', 42, 3000);
  assert.equal(urls.length, 253);
  assert.equal(urls.includes('http://10.88.237.42:3000'), false);
  assert.equal(urls[0], 'http://10.88.237.1:3000');
  // Các IP DHCP phổ biến nằm ở nhóm đầu tiên
  assert.ok(urls.indexOf('http://10.88.237.105:3000') < urls.indexOf('http://10.88.237.75:3000'));
});

test('probeFitLogServer & raceServerCandidates phân biệt đúng FitLog Server và bỏ qua server lạ', async () => {
  const impostor = await startHttpServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ app: 'other-service' }));
  });

  const slowDead = await startHttpServer(() => {
    // Treo không phản hồi để kiểm tra cơ chế hủy (abort) khi đã tìm thấy server thật
  });

  const fitlog = await startHttpServer((req, res) => {
    if (req.url?.startsWith('/goals')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ id: 1, name: 'Tăng sức bền' }]));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    const impostorCheck = await probeFitLogServer(impostor.url, 400);
    assert.equal(impostorCheck, null);

    const startedAt = Date.now();
    const winner = await raceServerCandidates(
      [impostor.url, slowDead.url, `${fitlog.url}/`],
      1500
    );
    const elapsedMs = Date.now() - startedAt;

    assert.equal(winner, fitlog.url);
    assert.ok(elapsedMs < 1000, `Phải trả kết quả ngay không chờ server treo (${elapsedMs}ms)`);
  } finally {
    slowDead.server.closeAllConnections?.();
    await Promise.all([impostor.close(), slowDead.close(), fitlog.close()]);
  }
});

test('promoteMdnsToConcreteIp giữ nguyên URL thường và nâng cấp khi có /__fitlog_ping', async () => {
  const fitlog = await startHttpServer((req, res) => {
    if (req.url === '/__fitlog_ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ app: 'fitlog-server', ok: true, ips: ['127.0.0.1'] }));
      return;
    }
    if (req.url?.startsWith('/goals')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ id: 1 }]));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    const unchanged = await promoteMdnsToConcreteIp(fitlog.url, fitlog.port, 400);
    assert.equal(unchanged, fitlog.url);
  } finally {
    await fitlog.close();
  }
});
