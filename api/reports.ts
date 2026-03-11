import express from "express";
import { conn } from "../db";
import mysql from "mysql2";
import { Router, Request, Response } from 'express';

export const router = express.Router();

// report post reviews
router.post("/review", (req: Request, res: Response): void => {
  const { reviewID, uid } = req.body;
  if (!reviewID || !uid) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบถ้วน" });
    return;
  }
  const insertReport = "INSERT INTO report_review (pid, uid, date) VALUES (?, ?, NOW())";
  conn.query(insertReport, [reviewID, uid], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          status: false,
          message: "คุณเคยรายงานรีวิวนี้ไปแล้ว!"
        });
      } else {
        res.status(500).json({
          status: false,
          message: "เกิดข้อผิดพลาดที่ระบบ โปรดลองใหม่ภายหลัง"
        });
      }
      return;
    }
    const countReports = "SELECT COUNT(*) as report_count FROM report_review WHERE pid = ?";
    conn.query(countReports, [reviewID], (err, countResult: any) => {
      if (err) {
        res.status(201).json({
          status: true,
          message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ"
        });
        return;
      }
      const reportCount = countResult[0].report_count;
      if (reportCount > 5) {
        const hidePost = "UPDATE review SET showpost = 0 WHERE pid = ?";
        conn.query(hidePost, [reviewID], (err, updateResult) => {
          if (err) {
            res.status(201).json({
              status: true,
              message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ"
            });
            return;
          }
          res.status(201).json({
            status: true,
            message: "รายงานสำเร็จ! โพสต์นี้ถูกซ่อนเนื่องจากมีการรายงานจำนวนมาก"
          });
        });
      } else {
        res.status(201).json({
          status: true,
          message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ"
        });
      }
    });
  });
});


// report post question
router.post("/question", (req: Request, res: Response): void => {
  const { questionID, uid } = req.body;
  if (!questionID || !uid) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบถ้วน" });
    return;
  }
  const insertReport = "INSERT INTO report_question (pid, uid, date) VALUES (?, ?, NOW())";
  conn.query(insertReport, [questionID, uid], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          status: false,
          message: "คุณเคยรายงานโพสต์คำถามนี้ไปแล้ว!"
        });
      } else {
        res.status(500).json({
          status: false,
          message: "เกิดข้อผิดพลาดที่ระบบ โปรดลองใหม่ภายหลัง"
        });
      }
      return;
    }
    const countReports = "SELECT COUNT(*) as report_count FROM report_question WHERE pid = ?";
    conn.query(countReports, [questionID], (err, countResult: any) => {
      if (err) {
        res.status(201).json({
          status: true,
          message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ"
        });
        return;
      }
      const reportCount = countResult[0].report_count;
      if (reportCount > 5) {
        const hidePost = "UPDATE question SET open = 0 WHERE id = ?";
        conn.query(hidePost, [questionID], (err) => {
          if (err) {
            res.status(201).json({
              status: true,
              message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ"
            });
            return;
          }
          res.status(201).json({
            status: true,
            message: "รายงานสำเร็จ! โพสต์นี้ถูกซ่อนเนื่องจากมีการรายงานจำนวนมาก"
          });
        });
      } else {
        res.status(201).json({
          status: true,
          message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ"
        });
      }
    });
  });
});

// report comments
router.post("/comment", (req: Request, res: Response): void => {
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

// report user profile. 
router.post("/profile", (req: Request, res: Response): void => {
  const { reported_uid, reporter_uid } = req.body;
  if (!reported_uid || !reporter_uid) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบถ้วน" });
    return;
  }
  const insertReport = "INSERT INTO report_profile (reported_user_id, reporter_user_id, date) VALUES (?, ?, NOW())";
  conn.query(insertReport, [reported_uid, reporter_uid], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          status: false,
          message: "คุณเคยรายงานโปรไฟล์นี้ไปแล้ว!"
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

router.get('/get-reports/reviews', (req, res) => {
  conn.query(`
        SELECT 
            rr.pid,
            rr.uid,
            rr.date,
            u.name        AS reporter_name
        FROM report_review rr
        JOIN review r ON rr.pid = r.pid
        JOIN users u ON rr.uid = u.uid
    `, (err: any, result: any[]) => {
    if (err) {
      console.error("Database error:", err);
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
      return;
    }
    if (!result.length) {
      res.status(404).json({ status: false, message: "ไม่พบข้อมูลการรายงาน" });
      return;
    }
    res.json({ status: true, result });
  });
});
export default router;