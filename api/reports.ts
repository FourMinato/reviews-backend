import express, { NextFunction } from "express";
import { conn } from "../db";
import mysql from "mysql2";
import { Router, Request, Response } from 'express';

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
// report post reviews
router.post("/review", checkSuspended, (req: Request, res: Response): void => {
  const { reviewID, uid } = req.body;
  if (!reviewID || !uid) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบถ้วน" });
    return;
  }

  const insertReport = "INSERT INTO report_review (pid, uid, date) VALUES (?, ?, NOW())";
  conn.query(insertReport, [reviewID, uid], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ status: false, message: "คุณเคยรายงานรีวิวนี้ไปแล้ว!" });
      } else {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดที่ระบบ โปรดลองใหม่ภายหลัง" });
      }
      return;
    }

    const countReports = "SELECT COUNT(*) as report_count FROM report_review WHERE pid = ?";
    conn.query(countReports, [reviewID], (err, countResult: any) => {
      if (err) {
        res.status(201).json({ status: true, message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ" });
        return;
      }

      const reportCount = countResult[0].report_count;

      if (reportCount > 5) {
        // ดึง uid เจ้าของโพสต์ก่อน
        const getOwnerSql = "SELECT uid FROM review WHERE pid = ?";
        conn.query(getOwnerSql, [reviewID], (err, reviewResult: any) => {
          if (err || !reviewResult || reviewResult.length === 0) {
            res.status(201).json({ status: true, message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ" });
            return;
          }

          const reviewOwnerUid = reviewResult[0].uid;

          const hidePost = "UPDATE review SET showpost = 0 WHERE pid = ?";
          conn.query(hidePost, [reviewID], (err) => {
            if (err) {
              res.status(201).json({ status: true, message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ" });
              return;
            }

            // ส่ง notification ไปหาเจ้าของโพสต์
            const insertNotificationSql = `
              INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid)
              VALUES (?, ?, NOW(), 0, ?, ?, ?)
            `;
            conn.query(
              insertNotificationSql,
              [
                "โพสต์ของคุณถูกปิดการมองเห็นโดยอัตโนมัติ",
                "โพสต์ของคุณถูกซ่อนเนื่องจากได้รับการรายงานจากผู้ใช้จำนวนมาก",
                "review",
                reviewID,
                reviewOwnerUid,
              ],
              (err) => {
                if (err) {
                  console.error("Failed to send notification:", err);
                  // ไม่ block response เพราะ hide post สำเร็จแล้ว
                }
                res.status(201).json({
                  status: true,
                  message: "รายงานสำเร็จ! โพสต์นี้ถูกซ่อนเนื่องจากมีการรายงานจำนวนมาก"
                });
              }
            );
          });
        });
      } else {
        res.status(201).json({ status: true, message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ" });
      }
    });
  });
});

// report post question
router.post("/question", checkSuspended, (req: Request, res: Response): void => {
  const { questionID, uid } = req.body;
  if (!questionID || !uid) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบถ้วน" });
    return;
  }

  const insertReport = "INSERT INTO report_question (pid, uid, date) VALUES (?, ?, NOW())";
  conn.query(insertReport, [questionID, uid], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ status: false, message: "คุณเคยรายงานโพสต์คำถามนี้ไปแล้ว!" });
      } else {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดที่ระบบ โปรดลองใหม่ภายหลัง" });
      }
      return;
    }

    const countReports = "SELECT COUNT(*) as report_count FROM report_question WHERE pid = ?";
    conn.query(countReports, [questionID], (err, countResult: any) => {
      if (err) {
        res.status(201).json({ status: true, message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ" });
        return;
      }

      const reportCount = countResult[0].report_count;

      if (reportCount > 5) {
        // ดึง uid เจ้าของโพสต์ก่อน
        const getOwnerSql = "SELECT uid FROM question WHERE id = ?";
        conn.query(getOwnerSql, [questionID], (err, questionResult: any) => {
          if (err || !questionResult || questionResult.length === 0) {
            res.status(201).json({ status: true, message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ" });
            return;
          }

          const questionOwnerUid = questionResult[0].uid;

          const hidePost = "UPDATE question SET open = 0 WHERE id = ?";
          conn.query(hidePost, [questionID], (err) => {
            if (err) {
              res.status(201).json({ status: true, message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ" });
              return;
            }

            // ส่ง notification ไปหาเจ้าของโพสต์
            const insertNotificationSql = `
              INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid)
              VALUES (?, ?, NOW(), 0, ?, ?, ?)
            `;
            conn.query(
              insertNotificationSql,
              [
                "โพสต์ของคุณถูกปิดการมองเห็นโดยอัตโนมัติ",
                "โพสต์คำถามของคุณถูกซ่อนเนื่องจากได้รับการรายงานจากผู้ใช้จำนวนมาก",
                "question",
                questionID,
                questionOwnerUid,
              ],
              (err) => {
                if (err) {
                  console.error("Failed to send notification:", err);
                }
                res.status(201).json({
                  status: true,
                  message: "รายงานสำเร็จ! โพสต์นี้ถูกซ่อนเนื่องจากมีการรายงานจำนวนมาก"
                });
              }
            );
          });
        });
      } else {
        res.status(201).json({ status: true, message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ" });
      }
    });
  });
});

// report comments
router.post("/comment", checkSuspended, (req: Request, res: Response): void => {
  const { commentID, uid } = req.body;
  if (!commentID || !uid) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบถ้วน" });
    return;
  }
  const insertReport = "INSERT INTO report_comment (cid, uid, date) VALUES (?, ?, NOW())";
  conn.query(insertReport, [commentID, uid], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          status: false,
          message: "คุณเคยรายงานคอมเมนต์นี้ไปแล้ว!"
        });
      } else {
        res.status(500).json({
          status: false,
          message: "เกิดข้อผิดพลาดที่ระบบ โปรดลองใหม่ภายหลัง"
        });
      }
      return;
    }

    res.status(201).json({
      status: true,
      message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ"
    });
  });
});


export default router;