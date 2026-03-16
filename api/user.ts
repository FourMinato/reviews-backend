import express from "express";
import { conn } from "../db"; 
import mysql from "mysql2";
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export const router = express.Router();
import { OtpService } from '../service/otp.service';
import jwt from "jsonwebtoken";
import { UpdateUserRequest } from "../request/userReq";

const otpService = new OtpService(); 
//Web REgister.
router.post("/register", (req: Request, res: Response) => {
  const { name, email, password, anonymous_name, type } = req.body;

  if (!name || !email || !password) {
   res.status(400).json({ status: false, message: "กรุณากรอกข้อมูลให้ครบ" });
   return;
  }
  const defaultProfile = "1e346a4b-7fb4-4f94-929d-9093df91ce85.jpg";
  conn.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    if (results.length > 0) {
      return res.json({ status: false, message: "อีเมลนี้ถูกใช้งานแล้ว" });
    }
    const sql = `
      INSERT INTO users (name, email, password, anonymous_name, profile, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    conn.query(
      sql,
      [
        name,
        email,
        password,
        anonymous_name,
        defaultProfile, 
        type
      ],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในการสมัคร" });
        }
        res.json({ status: true, message: "สมัครสมาชิกสำเร็จ", userId: result.insertId });
      }
    );
  });
});

//Web Login.
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password, captcha } = req.body;

  if (!email || !password) {
    res.status(400).json({ status: false, message: "กรุณาใส่ข้อมูลให้ครบ!" });
    return;
  }
  if (!captcha) {
    res.json({ status: false, message: "โปรดยืนยันตัวตนด้วย reCAPTCHA" });
    return;
  }

  const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.reCaptchaSecret}&response=${captcha}`;
  const captchaResponse = await fetch(verifyURL).then(r => r.json());
  if (!captchaResponse.success) {
    res.json({ status: false, message: "reCAPTCHA ไม่ถูกต้อง" });
    return;
  }

  const checkUser = "SELECT uid, type, password FROM users WHERE email = ?";
  conn.query(checkUser, [email], async (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }
    if (!result.length) {
      res.status(200).json({ status: false, message: "อีเมล์หรือรหัสผ่านไม่ถูกต้อง!" });
      return;
    }

    const dbPassword = result[0].password;
    let isMatch = false;

    // เช็คว่า password ใน DB เป็น hash หรือ plain text
    const isHashed = dbPassword.startsWith('$2b$') || dbPassword.startsWith('$2a$');

    if (isHashed) {
      // password ถูก hash แล้ว → ใช้ bcrypt.compare
      isMatch = await bcrypt.compare(password, dbPassword);
    } else {
      // password ยังเป็น plain text → เช็คตรงๆ
      isMatch = password === dbPassword;

      if (isMatch) {
        // โอกาสทอง → hash แล้ว update ทันทีเลย
        const hashed = await bcrypt.hash(password, 10);
        conn.query("UPDATE users SET password = ? WHERE email = ?", [hashed, email]);
      }
    }

    if (!isMatch) {
      res.status(200).json({ status: false, message: "อีเมล์หรือรหัสผ่านไม่ถูกต้อง!" });
      return;
    }

    res.status(201).json({
      status: true,
      message: "เข้าสู่ระบบสำเร็จ!",
      uid: result[0].uid,
      type: result[0].type,
    });
  });
});


//Check emil if user forgot password.
router.get("/checkemail", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.query;
  if (!email) {
    res.status(400).json({ status: false, message: "กรุณาใส่ข้อมูลให้ครบ!" });
    return;
  }

  const checkUser = "SELECT email FROM users WHERE email = ?";
  conn.query(checkUser, [email], (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }
     if (!result.length) {
      res.status(200).json({ status: false, message: "อีเมล์ไม่ถูกต้อง!" });
      return;
    }
      res.status(201).json({
        status: true,
        message: "อีเมล์ถูกต้อง!",
        result
      });
  });
});


router.post("/request-otp", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ status: false, message: "กรุณาใส่อีเมล" });
    return;
  }

  try {
    // 1. เช็ค rate limit
    const result: any = await new Promise((resolve, reject) => {
      conn.query(
        "SELECT otp_requested_at FROM users WHERE email = ?",
        [email],
        (err, result) => {
          if (err) {
            console.error("Query Error:", err);
            return reject(err);
          }
          resolve(result);
        }
      );
    });

    if (!result.length) {
      res.status(404).json({ status: false, message: "ไม่พบอีเมลนี้ในระบบ" });
      return;
    }

    const lastRequest = result[0].otp_requested_at;
    if (lastRequest) {
      const diff = (Date.now() - new Date(lastRequest).getTime()) / 1000;
      if (diff < 30) {
        res.status(429).json({
          status: false,
          message: `กรุณารออีก ${Math.max(1, Math.ceil(30 - diff))} วินาที`
        });
        return;
      }
    }

    // 2. Generate + Hash OTP
    console.log("Generating OTP for:", email);
    const otp = otpService.generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    // 3. บันทึกลง DB
    console.log("Saving OTP to DB...");
    await otpService.saveOtp(email, hashedOtp);

    // 4. ส่งอีเมล
    console.log("Sending OTP email...");
    await otpService.sendOtpEmail(email, otp);

    console.log("OTP sent successfully!");
    res.json({ status: true, message: "ส่ง OTP ไปยังอีเมลแล้ว" });

  } catch (error: any) {
    console.error("OTP Request Error:", error);
    res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด: " + (error.message || error) });
  }
});



router.post("/verify-otp", async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400).json({ status: false, message: "กรุณาใส่ข้อมูลให้ครบ" });
    return;
  }

  try {
    const result: any = await new Promise((resolve, reject) => {
      conn.query(
        "SELECT otp_code, otp_expires_at FROM users WHERE email = ?",
        [email],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    if (!result.length) {
      res.status(404).json({ status: false, message: "ไม่พบอีเมลนี้ในระบบ" });
      return;
    }

    const { otp_code, otp_expires_at } = result[0];

    // เช็คหมดอายุ
    if (!otp_code || new Date() > new Date(otp_expires_at)) {
      res.status(400).json({ status: false, message: "OTP หมดอายุแล้ว กรุณาขอใหม่" });
      return;
    }

    // เทียบ OTP
    const isMatch = await bcrypt.compare(otp, otp_code);
    if (!isMatch) {
      res.status(400).json({ status: false, message: "OTP ไม่ถูกต้อง" });
      return;
    }

    // สร้าง resetToken
    const resetToken = jwt.sign(
      { email },
      process.env.JWTKey as string,
      { expiresIn: '10m' }
    );

    // Clear OTP ออกจาก DB
    await new Promise<void>((resolve, reject) => {
      conn.query(
        "UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE email = ?",
        [email],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    res.json({ status: true, resetToken });

  } catch (error: any) {
    console.error("OTP Request Error:", error);
    res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด: " + (error.message || error) });
  }
});



router.post("/reset-password", async (req: Request, res: Response): Promise<void> => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    res.status(400).json({ status: false, message: "กรุณาใส่ข้อมูลให้ครบ" });
    return;
  }

  try {
    // 1. verify JWT token
    const decoded: any = jwt.verify(resetToken, process.env.JWTKey as string);
    const email = decoded.email;

    // 2. Hash password ใหม่
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3. UPDATE password ลง DB
    await new Promise<void>((resolve, reject) => {
      conn.query(
        "UPDATE users SET password = ?, otp_code = NULL, otp_expires_at = NULL, otp_requested_at = NULL WHERE email = ?",
        [hashedPassword, email],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    res.json({ status: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });

  } catch (error: any) {
    // token หมดอายุหรือไม่ถูกต้อง
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ status: false, message: "Token หมดอายุ กรุณายืนยัน OTP ใหม่" });
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ status: false, message: "Token ไม่ถูกต้อง" });
      return;
    }
    console.error("Reset Password Error:", error);
    res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
  }
});



router.put("/update-user/:uid", async (req: Request, res: Response) => {
  const uid = req.params.uid;
  const body: UpdateUserRequest = req.body;

  // เช็คว่า field บังคับมีค่าไหม
  if (!body.name || !body.email) {
    res.status(400).json({ status: false, message: "กรุณากรอกข้อมูลให้ครบ" });
    return;
  }

  try {
    const checkSql = `SELECT uid FROM users WHERE name = ? AND uid != ?`;
    conn.query(checkSql, [body.name, uid], async (err, results: any) => {
      if (err) {
        res.status(500).json({ status: false, message: "Server Error" });
        return;
      }
      
      if (results.length > 0) {
        res.json({ status: false, message: "ชื่อผู้ใช้ซ้ำ" });
        return;
      }

      // ดึงข้อมูลเดิมมาก่อน เผื่อ field ไหนไม่ได้ส่งมาจะใช้ค่าเดิม และเพื่อดึง password เดิมมาเช็ค
      const getOldDataSql = "SELECT name, email, anonymous_name, profile, password FROM users WHERE uid = ?";
      conn.query(getOldDataSql, [uid], async (err, oldData: any) => {
        if (err || oldData.length === 0) {
          res.status(500).json({ status: false, message: "ไม่พบข้อมูลผู้ใช้" });
          return;
        }

        const old = oldData[0];

        let sql = `UPDATE users SET name = ?, email = ?, anonymous_name = ?`;
        const params: any[] = [
          body.name || old.name,                       // ถ้าไม่ส่งมาใช้ค่าเดิม
          body.email || old.email,
          body.anonymous_name || old.anonymous_name,
        ];

        if (body.profile && body.profile.startsWith('http')) {
          sql += `, profile = ?`;
          params.push(body.profile);
        }

        if (body.password) {
          if (!body.oldPassword) {
            res.status(400).json({ status: false, message: "กรุณากรอกรหัสผ่านเดิม" });
            return;
          }

          let isMatch = false;
          const dbPassword = old.password;
          const isHashed = dbPassword.startsWith('$2b$') || dbPassword.startsWith('$2a$');

          if (isHashed) {
            isMatch = await bcrypt.compare(body.oldPassword, dbPassword);
          } else {
            isMatch = body.oldPassword === dbPassword;
          }

          if (!isMatch) {
            res.status(400).json({ status: false, message: "รหัสผ่านเดิมไม่ถูกต้อง" });
            return;
          }

          const hashedPassword = await bcrypt.hash(body.password, 10);
          sql += `, password = ?`;
          params.push(hashedPassword);
        }

        sql += ` WHERE uid = ?`;
        params.push(uid);

        conn.query(sql, params, (err, result) => {
          if (err) {
            res.status(500).json({ status: false, message: "แก้ไขไม่สำเร็จ" });
            return;
          }
          res.json({ status: true, message: "อัปเดตโปรไฟล์สำเร็จ" });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ status: false, message: "Hash error" });
  }
});


// Get other user uid, name, profile.
  router.get("/getuser/:uid", (req, res) => {
      const uid = req.params.uid;
      const sql = `SELECT uid, name, profile
      FROM users
      WHERE uid = ?`;
      conn.query(sql, [uid], (err, result) => {
        if (err) {
          console.error("SQL Error:", err);
          return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
        }
        if (result.length === 0) {
          return res.status(200).json({ status: true, data: [], message: "ไม่พบผู้ใช้" });
        }
        res.json({ status: true, data: result });
      });
  });  



// Get other user Reviews.
  router.get("/getuser/review/:uid", (req, res) => {
      const uid = req.params.uid;
      const sql = `SELECT review.pid, subject.subcode, review.date
      FROM review
      JOIN subject
      WHERE review.sid = subject.subid
      AND review.showpost = 1
      AND review.is_anonymous = 0
      AND review.uid = ?`;
      conn.query(sql, [uid], (err, result) => {
        if (err) {
          console.error("SQL Error:", err);
          return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
        }
        if (result.length === 0) {
          return res.status(200).json({ status: true, data: [], message: "ผู้ใช้คนนี้ไม่เคยรีวิวรายวิชา" });
        }
        res.json({ status: true, data: result });
      });
  });

// Get other user Questions.
  router.get("/getuser/question/:uid", (req, res) => {
      const uid = req.params.uid;
      const sql = `SELECT question.id, question.date
      FROM question
      WHERE question.uid = ?
      AND question.open = 1
      ORDER BY question.date DESC`;
      conn.query(sql, [uid], (err, result) => {
        if (err) {
          console.error("SQL Error:", err);
          return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
        }
        if (result.length === 0) {
          return res.status(200).json({ status: true, data: [], message: "ผู้ใช้คนนี้ไม่เคยโพสต์คำถาม" });
        }
        res.json({ status: true, data: result });
      });
  });  

  
//Get my profile.
router.get("/myprofile/:uid", (req, res) => {
  const uid = req.params.uid;
  const sql = `SELECT uid, name, profile, email
  FROM users
  WHERE uid = ?`;
  conn.query(sql, [uid], (err, result) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    if (result.length === 0) {
      return res.status(200).json({ status: true, data: [], message: "ไม่พบผู้ใช้" });
    }
    res.status(200).json({ status: true, data: result[0] });
  });
});


  // Get my review.
  router.get("/getmyreview/:uid", (req, res) => {
      const uid = req.params.uid;
      const sql = `SELECT review.pid, subject.subcode, review.date
      FROM review
      JOIN subject
      WHERE review.sid = subject.subid
      AND review.showpost = 1
      AND review.uid = ?`;
      conn.query(sql, [uid], (err, result) => {
        if (err) {
          console.error("SQL Error:", err);
          return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
        }
        if (result.length === 0) {
          return res.status(200).json({ status: true, data: [], message: "ผู้ใช้คนนี้ไม่เคยรีวิวรายวิชา" });
        }
        res.json({ status: true, data: result });
      });
  });
// Get my question.
    router.get("/getmyquestion/:uid", (req, res) => {
      const uid = req.params.uid;
      const sql = `SELECT question.id, question.date
      FROM question
      WHERE question.uid = ?`;
      conn.query(sql, [uid], (err, result) => {
        if (err) {
          console.error("SQL Error:", err);
          return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
        }
        if (result.length === 0) {
          return res.status(200).json({ status: true, data: [], message: "ผู้ใช้คนนี้ไม่เคยรีวิวรายวิชา" });
        }
        res.json({ status: true, data: result });
      });
  });

  

