import express from "express";
import { conn } from "../db";
import { Request, Response } from 'express';
export const router = express.Router();

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


// DELETE - ลบการแจ้งเตือนทีละรายการ
router.delete("/notifications/:messageID", (req: Request, res: Response): void => {
  const messageID = req.params.messageID;

  if (!messageID) {
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