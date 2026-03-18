import express, { NextFunction } from "express";
import { conn } from "../db";
import { Request, Response } from 'express';
export const router = express.Router();


// middleware/checkSuspended.ts
export const checkSuspended = (req: Request, res: Response, next: NextFunction): void => {
  // ดึง uid จากทุกที่ที่เป็นไปได้
  const uid = req.params.uid 
    || req.params.userId
    || req.body.uid 
    || req.headers['x-uid'] as string;

  if (!uid) return next(); // ถ้าไม่มี uid เลยให้ผ่าน

  conn.query(`SELECT type FROM users WHERE uid = ?`, [uid], (err, result: any) => {
    if (err || !result.length) return next();

    if (result[0].type === 2) {
      res.status(403).json({ status: false, message: "บัญชีของคุณถูกระงับการใช้งาน" });
      return;
    }
    next();
  });
};
// Get notifications
router.get("/notifications/:uid", (req: Request, res: Response): void => {
  const uid = req.params.uid;

  const sql = `
    SELECT 
      m.*
    FROM message m
    WHERE m.uid = ?
    ORDER BY m.date DESC
    LIMIT 50
  `;

  conn.query(sql, [uid], (err, results: any) => {
    if (err) {
        console.log(err);
        
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }
    res.status(200).json({
      status: true,
      notifications: results
    });
  });
});


//Update status
router.patch("/notifications/:messageID/read", (req: Request, res: Response): void => {
  const messageID = req.params.messageID;

  if (!messageID) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบ" });
    return;
  }

  const sql = "UPDATE message SET is_read = 1 WHERE id = ?";

  conn.query(sql, [messageID], (err, result: any) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }

    if (result.affectedRows === 0) {
      res.status(404).json({
        status: false,
        message: "ไม่พบการแจ้งเตือนนี้",
      });
      return;
    }

    res.status(200).json({
      status: true,
      message: "อัพเดทสถานะสำเร็จ",
    });
  });
});


// DELETE - ลบรายการที่ถูกเลือก
router.delete("/notifications/batch/:uid", checkSuspended, (req: Request, res: Response): void => {
  const uid = req.params.uid;
  const { messageIds } = req.body;

  if (!uid || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบ" });
    return;
  }

  const sql = "DELETE FROM message WHERE uid = ? AND id IN (?)";

  conn.query(sql, [uid, messageIds], (err, result: any) => {
    if (err) {
      console.error(err);
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในการลบข้อมูล!" });
      return;
    }

    res.status(200).json({
      status: true,
      message: `ลบการแจ้งเตือน ${result.affectedRows} รายการสำเร็จ`,
    });
  });
});

// DELETE - ลบการแจ้งเตือนทั้งหมดของผู้ใช้
router.delete("/notifications/all/:uid", checkSuspended, (req: Request, res: Response): void => {
  const uid = req.params.uid;

  if (!uid) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบ" });
    return;
  }

  const sql = "DELETE FROM message WHERE uid = ?";

  conn.query(sql, [uid], (err, result: any) => {
    if (err) {
      console.error(err);
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในการลบข้อมูล!" });
      return;
    }

    res.status(200).json({
      status: true,
      message: "ลบการแจ้งเตือนทั้งหมดสำเร็จ",
    });
  });
});

// DELETE - ลบการแจ้งเตือนทีละรายการ
router.delete("/notifications/:messageID/:uid", checkSuspended, (req: Request, res: Response): void => {
  const messageID = req.params.messageID;
  const uid = req.params.uid;
  
  if (!messageID || !uid) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบ" });
    return;
  }

  const sql = "DELETE FROM message WHERE id = ?";

  conn.query(sql, [messageID], (err, result: any) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }

    if (result.affectedRows === 0) {
      res.status(404).json({
        status: false,
        message: "ไม่พบการแจ้งเตือนนี้",
      });
      return;
    }

    res.status(200).json({
      status: true,
      message: "ลบการแจ้งเตือนสำเร็จ",
    });
  });
});

// PATCH - อัปเดตสถานะเป็นอ่านแล้วทั้งหมด
router.patch("/notifications/all/:uid/read", checkSuspended, (req: Request, res: Response): void => {
  const uid = req.params.uid;

  if (!uid) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบ" });
    return;
  }

  const sql = "UPDATE message SET is_read = 1 WHERE uid = ?";

  conn.query(sql, [uid], (err, result: any) => {
    if (err) {
      console.error(err);
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในการอัปเดตข้อมูล!" });
      return;
    }

    res.status(200).json({
      status: true,
      message: "อัปเดตสถานะการอ่านทั้งหมดสำเร็จ",
    });
  });
});

// GET - เช็คว่ามีการแจ้งเตือนที่ยังไม่อ่านหรือไม่
router.get("/notifications/:uid/has-unread", (req: Request, res: Response): void => {
  const uid = req.params.uid;

  const sql = `
    SELECT 
      COUNT(*) as unread_count
    FROM message 
    WHERE uid = ? AND is_read = 0
    LIMIT 1
  `;

  conn.query(sql, [uid], (err, results: any) => {
    if (err) {
      console.log(err);
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }

    const hasUnread = results[0].unread_count > 0;

    res.status(200).json({
      status: true,
      has_unread: hasUnread,
    });
  });
});