import { OAuth2Client } from "google-auth-library";
import express from "express";
import { conn } from "../db";
import { Request, Response } from 'express';
import jwt from "jsonwebtoken";

export const router = express.Router();
const client = new OAuth2Client(`${process.env.GoogleClientId}`);

function createJwtToken(uid: number) {
    return jwt.sign({ uid }, `${process.env.JWTKey}`, { expiresIn: "7d" });
}

router.post("/register/google", async (req: Request, res: Response): Promise<void> => {
    const { token, captcha } = req.body;

    if (!captcha) {
        res.json({ success: false, error: "โปรดยืนยันตัวตนด้วย reCAPTCHA" });
        return;
    }
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.reCaptchaSecret}&response=${captcha}`;
    const captchaResponse = await fetch(verifyURL).then(r => r.json());
    if (!captchaResponse.success) {
        res.json({ success: false, error: "reCAPTCHA ไม่ถูกต้อง" });
        return;
    }

    try {
        const ticket = await client.getTokenInfo(token);
        const email = ticket.email;
        const googleId = ticket.sub;

        if (!email) {
            res.status(400).json({ success: false, message: "ไม่พบอีเมลใน Google token" });
            return;
        }

        conn.query(
            "SELECT * FROM users WHERE email = ?",
            [email],
            (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
                    return;
                }
                if (result.length > 0) {
                    res.json({
                        success: false,
                        message: "อีเมลนี้ถูกใช้งานแล้ว ไม่สามารถสมัครด้วย Google ได้"
                    });
                    return;
                }
                const defaultName = email.split("@")[0];
                let anonymousName = defaultName;
                if (defaultName.length > 2) {
                    anonymousName = defaultName[0] + '*'.repeat(defaultName.length - 2) + defaultName[defaultName.length - 1];
                } else if (defaultName.length === 2) {
                    anonymousName = defaultName[0] + '*';
                }
                const profile = "1e346a4b-7fb4-4f94-929d-9093df91ce85.jpg";
                const type = 1;
                conn.query(
                    `INSERT INTO users (name, email, google_id, anonymous_name, profile, type)
                    VALUES (?,?,?,?,?,?)`,
                    [defaultName, email, googleId, anonymousName, profile, type],
                    (err2, result2) => {
                        if (err2) {
                            console.log(err2);
                            res.status(500).json({ success: false, message: "สมัครสมาชิก Google ไม่สำเร็จ" });
                            return;
                        }

                        res.json({
                            success: true,
                            message: "สมัครสมาชิกด้วย Google สำเร็จ",
                            userId: result2.insertId
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.log(error);
        res.status(400).json({ success: false, message: "Google token ไม่ถูกต้อง" });
    }
});

router.post("/login/google", async (req: Request, res: Response): Promise<void> => {
    const { token, captcha } = req.body;
    if (!captcha) {
        res.json({ success: false, error: "โปรดยืนยันตัวตนด้วย reCAPTCHA" });
        return;
    }
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.reCaptchaSecret}&response=${captcha}`;
    const captchaResponse = await fetch(verifyURL).then(r => r.json());
    if (!captchaResponse.success) {
        res.json({ success: false, error: "reCAPTCHA ไม่ถูกต้อง" });
        return;
    }
    try {
        const ticket = await client.getTokenInfo(token);
        const email = ticket.email;
        if (!email) {
            res.json({ success: false, error: "ไม่พบอีเมลใน Google token" });
            return;
        }
        conn.query(
            `SELECT uid, type 
       FROM users WHERE email=?`,
            [email],
            (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).json({ error: "Database error" });
                    return;
                }
                if (!result.length) {
                    res.json({
                        success: false,
                        error: "ไม่พบผู้ใช้นี้ในระบบ กรุณาสมัครสมาชิกก่อน"
                    });
                    return;
                }
                if (result.length > 0) {
                    const user = result[0];
                    const jwtToken = createJwtToken(user.uid);

                    res.json({
                        success: true,
                        message: "เข้าสู่ระบบสำเร็จ",
                        token: jwtToken,
                        user
                    });
                    return;
                }

            }
        );
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Google token ไม่ถูกต้อง" });
    }
});
