import crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { conn } from '../db';

export class OtpService {

  generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  async saveOtp(email: string, otp: string): Promise<void> {
    const updateOtp = `
      UPDATE users 
      SET otp_code = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE), otp_requested_at = NOW() 
      WHERE email = ?
    `;
    await conn.query(updateOtp, [otp, email]);
  }

  async sendOtpEmail(email: string, otp: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

await transporter.sendMail({
  from: `"Review Realm" <${process.env.MAIL_USER}>`,
  to: email,
  subject: 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="margin:0; padding:0; background-color:#f4f4f5; font-family: 'Segoe UI', sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background: #ffffff; padding: 36px; text-align:center;">
                  <h1 style="margin:0; color: #000000ff; font-size:24px; letter-spacing:1px;">รีเซ็ตรหัสผ่าน</h1>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 36px;">
                  <p style="margin:0 0 28px; color:#6B7280; font-size:15px; line-height:1.6;">
                    เราได้รับคำขอรีเซ็ตรหัสผ่านของคุณ กรุณาใช้รหัส OTP ด้านล่างนี้
                  </p>

                  <!-- OTP Box -->
                  <div style="background:#F5F3FF; border: 2px dashed #4F46E5; border-radius:12px; padding: 28px; text-align:center; margin-bottom:28px;">
                    <p style="margin:0 0 8px; color:#6B7280; font-size:13px; text-transform:uppercase; letter-spacing:2px;">รหัส OTP ของคุณ</p>
                    <h1 style="margin:0; font-size:48px; letter-spacing:16px; color:#4F46E5; font-weight:800;">${otp}</h1>
                  </div>

                  <!-- Expire -->
                  <div style="background:#FEF3C7; border-radius:8px; padding:12px 16px; margin-bottom:28px; display:flex; align-items:center; justify-content:center; text-align:center;">
                    <p style="margin:0 auto; color:#92400E; font-size:14px; ">
                      รหัสนี้จะหมดอายุใน <strong>5 นาที</strong>
                    </p>
                  </div>

                  <p style="margin:0; color:#9CA3AF; font-size:13px; line-height:1.6;">
                    หากคุณไม่ได้ทำรายการนี้ กรุณาเพิกเฉยต่ออีเมลนี้ และรหัสจะหมดอายุโดยอัตโนมัติ
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#F9FAFB; padding:20px 36px; border-top:1px solid #E5E7EB; text-align:center;">
                  <p style="margin:0; color:#9CA3AF; font-size:12px;">
                    © 2026 Review Realm · อีเมลนี้ถูกส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `,
});
  }

  async sendContactEmail(fromEmail: string, name: string, subject: string, message: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Contact Form" <${process.env.MAIL_USER}>`,
      to: 'nightnicec@gmail.com',
      subject: `[Contact Form] ${subject}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6;">
          <h2 style="color: #4F46E5;">ข้อความติดต่อใหม่จากเว็บไซต์</h2>
          <p><strong>ชื่อผู้ส่ง:</strong> ${name}</p>
          <p><strong>อีเมลผู้ส่ง:</strong> ${fromEmail}</p>
          <p><strong>หัวข้อ:</strong> ${subject}</p>
          <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 4px solid #4F46E5;">
            <p style="white-space: pre-wrap; margin: 0;">${message}</p>
          </div>
        </div>
      `,
    });
  }
}