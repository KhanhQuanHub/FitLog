const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config({ path: path.join(__dirname, '.env') });

function isEmailConfigured() {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD);
}

async function sendPasswordResetEmail(email, temporaryPassword) {
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_APP_PASSWORD;
    if (!user || !password) {
        throw new Error('SMTP_USER and SMTP_APP_PASSWORD must be configured');
    }

    const port = Number(process.env.SMTP_PORT || 465);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('SMTP_PORT must be a valid port number');
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure: port === 465,
        auth: { user, pass: password },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM || `FitLog <${user}>`,
        to: email,
        subject: 'Mật khẩu mới cho tài khoản FitLog',
        text: [
            'Bạn vừa yêu cầu cấp mật khẩu mới cho tài khoản FitLog.',
            '',
            `Mật khẩu tạm thời của bạn là: ${temporaryPassword}`,
            '',
            'Hãy đăng nhập bằng mật khẩu này và đổi lại mật khẩu trong trang Hồ sơ.',
            'Nếu bạn không yêu cầu đổi mật khẩu, hãy liên hệ quản trị viên.',
        ].join('\n'),
    });
}

module.exports = { isEmailConfigured, sendPasswordResetEmail };
