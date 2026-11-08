const crypto = require('crypto');

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const HASH_PREFIX = `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$`;

function hashPassword(password) {
    if (typeof password !== 'string' || password.length === 0) {
        throw new TypeError('Password must be a non-empty string');
    }

    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return `${HASH_PREFIX}${salt.toString('hex')}$${hash.toString('hex')}`;
}

function isPasswordHash(value) {
    if (typeof value !== 'string') return false;
    const parts = value.split('$');
    return parts.length === 6
        && parts[0] === 'scrypt'
        && parts[1] === String(SCRYPT_OPTIONS.N)
        && parts[2] === String(SCRYPT_OPTIONS.r)
        && parts[3] === String(SCRYPT_OPTIONS.p)
        && /^[0-9a-f]{32}$/i.test(parts[4])
        && new RegExp(`^[0-9a-f]{${KEY_LENGTH * 2}}$`, 'i').test(parts[5]);
}

function verifyPassword(password, storedPassword) {
    if (typeof password !== 'string' || !isPasswordHash(storedPassword)) return false;

    const [, , , , saltHex, hashHex] = storedPassword.split('$');
    const salt = Buffer.from(saltHex, 'hex');
    const expectedHash = Buffer.from(hashHex, 'hex');
    const actualHash = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return crypto.timingSafeEqual(actualHash, expectedHash);
}

function migrateUsers(users) {
    if (!Array.isArray(users)) {
        throw new TypeError('Database users must be an array');
    }

    let changed = false;
    for (const user of users) {
        if (!user || typeof user.password !== 'string' || user.password.length === 0) {
            throw new TypeError('Every user must have a non-empty password');
        }
        if (!isPasswordHash(user.password)) {
            user.password = hashPassword(user.password);
            changed = true;
        }
    }
    return changed;
}

module.exports = { hashPassword, isPasswordHash, migrateUsers, verifyPassword };
