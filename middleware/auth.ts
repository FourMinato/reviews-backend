import { Request, Response, NextFunction } from "express";
import { conn } from "../db";

// Middleware to check if the user is suspended (Type 2)
export const checkSuspended = (req: Request, res: Response, next: NextFunction): void => {
  const uid = req.headers['x-uid'] as string || req.body.uid;

  if (!uid) return next();

  conn.query(`SELECT type FROM users WHERE uid = ?`, [uid], (err, result: any) => {
    if (err || !result.length) return next();

    if (result[0].type === 2) {
      res.status(403).json({ status: false, message: "บัญชีของคุณถูกระงับการใช้งาน" });
      return;
    }
    next();
  });
};

// Middleware to check if the user is an admin (Type 1)
export const checkAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const uid = req.headers['x-uid'] as string || req.body.uid;

  if (!uid) {
    res.status(401).json({ status: false, message: "กรุณาเข้าสู่ระบบ" });
    return;
  }

  conn.query(`SELECT type FROM users WHERE uid = ?`, [uid], (err, result: any) => {
    if (err || !result.length) {
      res.status(404).json({ status: false, message: "ไม่พบผู้ใช้งาน" });
      return;
    }

    if (result[0].type !== 1) {
      res.status(403).json({ status: false, message: "ขออภัย คุณไม่มีสิทธิ์เข้าถึงส่วนนี้" });
      return;
    }
    next();
  });
};
