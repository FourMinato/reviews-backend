import { OAuth2Client } from "google-auth-library";
import express from "express";
import path, { dirname } from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { conn } from "../db";
import mysql from "mysql2";
import fs from "fs";
import { Request, Response } from 'express';
import jwt from "jsonwebtoken";

export const router = express.Router();

// ค้นหาด้วยรหัสวิชา *หาผ่านเส้น API
router.get('/subject/search/:subcode', (req, res) => {
    const { subcode } = req.params;
    if (!subcode) {
        res.status(400).json({ status: false, message: "กรุณากรอกรหัสรายวิชา!" });
        return;
    }

    conn.query(`SELECT s.*,
                (SELECT COUNT(*) FROM review WHERE sid=s.subid AND showpost=1) review_count,
                (SELECT ROUND(IFNULL(AVG(rate), 0), 1) FROM review WHERE sid = s.subid AND showpost = 1) AS avg_rate
                FROM subject s
                WHERE subcode=?
              `, [subcode], (err, result: any[]) => {
        if (err) {
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
            return;
        }
        if (!result.length) {
            res.status(404).json({ status: false, message: "ไม่พบรายวิชา" });
            return;
        }
        res.json({ status: true, result });
    });
});

// Select All subject where category = ?
router.post("/subject/select", (req: Request, res: Response): void => {
  const { cateids } = req.body;

  if (!Array.isArray(cateids) || cateids.length === 0) {
    res.status(400).json({ status: false, message: "cateids ต้องเป็น array" });
    return;
  }

  const sql = `SELECT s.*,
                (SELECT COUNT(*) FROM review WHERE sid=s.subid AND showpost=1) review_count,
                (SELECT IFNULL(AVG(rate),0) FROM review WHERE sid=s.subid AND showpost=1) avg_rate
                FROM subject s
                WHERE cateid IN (?)
                ORDER BY subcode asc`;
  conn.query(sql, [cateids], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ status: false, message: "Database error" });
      return;
    }
    res.json({ status: true, result });
  });
});

// Select All subject where category = ? and order by review amount
router.post("/subject/select/review", (req: Request, res: Response): void => {
  const { cateids } = req.body;

  if (!Array.isArray(cateids) || cateids.length === 0) {
    res.status(400).json({ status: false, message: "cateids ต้องเป็น array" });
    return;
  }

  const sql = `SELECT s.*,
                (SELECT COUNT(*) FROM review WHERE sid=s.subid AND showpost=1) review_count,
                (SELECT IFNULL(AVG(rate),0) FROM review WHERE sid=s.subid AND showpost=1) avg_rate
                FROM subject s
                WHERE cateid IN (?)
                ORDER BY review_count desc`;
  conn.query(sql, [cateids], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ status: false, message: "Database error" });
      return;
    }
    res.json({ status: true, result });
  });
});

// Select All subject where category = ? and order by rate
router.post("/subject/select/rate", (req: Request, res: Response): void => {
  const { cateids } = req.body;

  if (!Array.isArray(cateids) || cateids.length === 0) {
    res.status(400).json({ status: false, message: "cateids ต้องเป็น array" });
    return;
  }

  const sql = `SELECT s.*,
                (SELECT COUNT(*) FROM review WHERE sid=s.subid AND showpost=1) review_count,
                (SELECT IFNULL(AVG(rate),0) FROM review WHERE sid=s.subid AND showpost=1) avg_rate
                FROM subject s
                WHERE cateid IN (?)
                ORDER BY avg_rate desc`;
  conn.query(sql, [cateids], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ status: false, message: "Database error" });
      return;
    }
    res.json({ status: true, result });
  });
});

// report review
router.post("/report/review", (req: Request, res: Response): void => {
  const { uid, reviewID } = req.body;
  const type = 'review'

  if (!uid || !reviewID) {
    res.status(401).json({ status: false, message: "ข้อมูลไม่ครบถ้วน" });
    return;
  }
  const checkReported = "SELECT * FROM reports WHERE fk_id = ? AND uid = ? AND type = ?";
  conn.query(checkReported, [reviewID, uid, type], (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }
    if (result.length > 0) {
      res.status(200).json({ status: false, message: "คุณเคยรายงานโพสต์นี้แล้ว!" });
      return;
    }

    const insertReport = "INSERT INTO reports (uid, type, fk_id, date) VALUES (?, ?, ?, NOW())";
    conn.query(insertReport, [uid, type, reviewID], (err, result) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }
      res.status(201).json({
        status: true,
        message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ",
        reportId: result.insertId,
        type: type
      });
    });
  });
});

// report post question
router.post("/report/question", (req: Request, res: Response): void => {
  const { uid, questionID } = req.body;
  const type = 'question'

  if (!uid || !questionID) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบถ้วน" });
    return;
  }
  const checkReported = "SELECT * FROM reports WHERE fk_id = ? AND uid = ? AND type = ?";
  conn.query(checkReported, [questionID, uid, type], (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }
    if (result.length > 0) {
      res.status(200).json({ status: false, message: "คุณเคยรายงานโพสต์นี้แล้ว!" });
      return;
    }

    const insertReport = "INSERT INTO reports (uid, type, fk_id, date) VALUES (?, ?, ?, NOW())";
    conn.query(insertReport, [uid, type, questionID], (err, result) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }
      res.status(201).json({
        status: true,
        message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ",
        reportId: result.insertId,
        type: type
      });
    });
  });
});


// favorite review
router.post("/favorite/review", (req: Request, res: Response): void => {
  const { uid, reviewID } = req.body;
  const type = 'review'

  if (!uid || !reviewID) {
    res.status(400).json({ status: false, message: "กรุณาเข้าสู่ระบบก่อน!" });
    return;
  }
  const checkFavorite = "SELECT * FROM favorite WHERE fk_id = ? AND uid = ? AND type = ?";
  conn.query(checkFavorite, [reviewID, uid, type], (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }
    if (result.length > 0) {
      res.status(200).json({ status: false, message: "คุณได้ทำการบันทึกโพสต์นี้ไปแล้ว" });
      return;
    }

    const insertFavorite = "INSERT INTO favorite (uid, type, fk_id, date) VALUES (?, ?, ?, NOW())";
    conn.query(insertFavorite, [uid, type, reviewID], (err, result) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }
      res.status(201).json({
        status: true,
        message: "บันทึกโพสต์สำเร็จ!",
        reportId: result.insertId,
        type: type
      });
    });
  });
});

// review details
router.get("/review/details/:pid", (req, res) => {
  const { pid } = req.params;
  const sql = `SELECT 
    review.pid, 
    review.uid,
    users.profile,
    users.name, 
    review.date, 
    review.rate, 
    review.descriptions, 
    review.is_anonymous
  FROM users, review
  WHERE users.uid = review.uid
  AND review.pid = ?
  AND review.showpost = 1`;

  conn.query(sql, [pid], (err, result) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    const processedData = result.map((review: any) => ({
      ...review,
      is_anonymous: Boolean(review.is_anonymous), //แปลง boolean 0 → false, 1 → true
      uid: review.is_anonymous ? null : review.uid, // ซ่อน uid
      name: review.is_anonymous ? 'ผู้โพสต์ไม่ระบุตัวตน' : review.name, // ซ่อนชื่อ
      profile: review.is_anonymous ? 'a25d9385-c882-4b3d-aa5b-508eabcd5987.png' : review.profile //ใช้ profle นี้ถ้าคนโพสต์ไม่ระบุตัวตน
    }));
    res.json({ status: true, data: processedData });
  });
});

//Create comments (Review)
router.post("/create/comments/review", (req: Request, res: Response): void => {
  const { uid, descriptions, reviewID } = req.body;
  const type = 'review'

  if (!uid || !descriptions || !reviewID) {
    res.status(400).json({ status: false, message: "กรุณาเข้าสู่ระบบก่อน!" });
    return;
  }
    const insertCpmment = "INSERT INTO comments (uid, type, descriptions, ref_id, replies_to_id) VALUES (?, ?, ?, ?, NULL)";
    conn.query(insertCpmment, [uid, type, descriptions, reviewID], (err, result) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }
      res.status(201).json({
        status: true,
        message: "แสดงความคิดเห็นสำเร็จ!",
        commentId: result.insertId,
        type: type
      });
    });
});

//Create Replies (Review)
router.post("/create/replies/review", (req: Request, res: Response): void => {
  const { uid, descriptions, reviewID, commentID } = req.body;
  const type = 'review'

  if (!uid || !descriptions || !reviewID || !commentID) {
    res.status(400).json({ status: false, message: "กรุณาระบุข้อมูลให้ครบถ้วน!" });
    return;
  }

    // INSERT reply
    const insertReplie = "INSERT INTO comments (uid, type, descriptions, ref_id, replies_to_id) VALUES (?, ?, ?, ?, ?)";
    
    conn.query(insertReplie, [uid, type, descriptions, reviewID, commentID], (err, result) => {
      if (err) {
        console.error("Insert Error:", err);  // ← เพิ่ม log ดู error
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }

      res.status(201).json({
        status: true,
        message: "แสดงการตอบกลับสำเร็จ!",
        replieId: result.insertId,
        type: type
      });
    });
  }); 

  // Report other user profile.
  router.get("/user/profile/:uid", (req, res) => {
      const uid = req.params.uid;
      const sql = `SELECT users.name, users.profile, users.uid
      FROM users
      WHERE users.uid = ?`;
  
      conn.query(sql, [uid], (err, result) => {
        if (err) {
          console.error("SQL Error:", err);
          return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
        }
        if (result.length === 0) {
          return res.status(404).json({ status: false, message: "ไม่พบผู้ใช้" });
        }
        res.json({ status: true, data: result[0] });
      });
  });

// Report user profile
router.post("/report/profile", (req: Request, res: Response): void => {
  const { reporter_uid, reported_uid } = req.body; //reporter คนที่รายงาน / reported คนที่โดนรายงาน
  const type = 'profile'

  if (!reporter_uid || !reported_uid ) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบถ้วน" });
    return;
  }
  const checkReported = "SELECT * FROM reports WHERE fk_id = ? AND uid = ? AND type = ?";
  conn.query(checkReported, [reported_uid, reporter_uid, type], (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }
    if (result.length > 0) {
      res.status(200).json({ status: false, message: "คุณเคยรายงานผู้ใช้คนนี้ไปแล้ว!" });
      return;
    }

    const insertReportProfile = "INSERT INTO reports (uid, type, fk_id, date) VALUES (?, ?, ?, NOW())";
    conn.query(insertReportProfile, [reporter_uid, type, reported_uid], (err, result) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }
      res.status(201).json({
        status: true,
        message: "รายงานสำเร็จ! โปรดรอการตรวจสอบ",
        reportId: result.insertId,
        type: type
      });
    });
  });
});




// Admin get subject details.
  router.get("/subject/destail/:subid", (req, res) => {
      const subid = req.params.subid;
      const sql = `SELECT s.*,
                (SELECT COUNT(*) FROM review WHERE sid=s.subid AND showpost=1) review_count,
                (SELECT IFNULL(AVG(rate),0) FROM review WHERE sid=s.subid AND showpost=1) avg_rate
                FROM subject s
                WHERE subid = ?`;
      conn.query(sql, [subid], (err, result) => {
        if (err) {
          console.error("SQL Error:", err);
          return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
        }
        if (result.length === 0) {
          return res.status(404).json({ status: false, message: "ไม่มีรหัสวิชานี้ใน Database" });
        }
        res.json({ status: true, data: result });
      });
  });

// Update subject data.
router.put("/update/subject", (req: Request, res: Response): void => {
  const { subjectID, cateID, subcode, name } = req.body;

  if (!subjectID) {
    res.status(400).json({ status: false, message: "กรุณาระบุรหัสรายวิชา" });
    return;
  }

  const sql = `
    UPDATE subject
    SET
      cateid = IFNULL(?, cateid),
      subcode = IFNULL(?, subcode),
      name = IFNULL(?, name)
    WHERE subid = ?
  `;

  conn.query(
    sql,
    [cateID ?? null, subcode ?? null, name ?? null, subjectID],
    (err) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }

      res.status(200).json({
        status: true,
        message: "อัปเดตรายวิชาสำเร็จ",
      });
    }
  );
});

// Admin close/open subject. --ส่งค่า 0 1 มาจากฝั่งหน้าบ้านเอา
router.put("/subject/visibility", (req: Request, res: Response): void => {
  const { subjectID, open } = req.body;

  if (subjectID === undefined || open === undefined) {
    res.status(400).json({
      status: false,
      message: "ข้อมูลไม่ครบ",
    });
    return;
  }

  const sql = `
    UPDATE subject
    SET open = ?
    WHERE subid = ?
  `;

  conn.query(sql, [open, subjectID], (err, result: any) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }

    if (result.affectedRows === 0) {
      res.status(404).json({ status: false, message: "ไม่พบรายวิชา" });
      return;
    }

    res.status(200).json({
      status: true,
      message: open ? "เปิดรายวิชาสำเร็จ" : "ปิดรายวิชาสำเร็จ",
    });
  });
});

