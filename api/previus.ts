import express from "express";
import path, { dirname } from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { conn } from "../db";
import mysql from "mysql2";
import fs from "fs";
import { Request, Response } from 'express';

export const router = express.Router();

//Register 
router.post("/register", (req, res): any => {
  const d = req.body;
  const profile = "1e346a4b-7fb4-4f94-929d-9093df91ce85.jpg";

  conn.query("SELECT 1 FROM users WHERE email=?", [d.email], (err, result) =>
    err
      ? res.status(500).json({ message: "เกิดข้อผิดพลาด" })
      : result.length
        ? res.json({ success: false, message: "อีเมลนี้ถูกใช้งานแล้ว" })
        : conn.query(
          `INSERT INTO users (name,email,password,anonymous_name,profile,type)
           VALUES (?,?,?,?,?,?)`,
          [d.name, d.email, d.password, d.anonymous_name, profile, d.type],
          (e2, rs) =>
            e2
              ? res.status(500).json({ message: "เกิดข้อผิดพลาดในการสมัคร" })
              : res.json({ message: "สมัครสมาชิกสำเร็จ", userId: rs.insertId })
        )
  );
});


// Login
router.post("/login", (req, res): any =>
  conn.query(
    `SELECT uid, type 
     FROM users WHERE email=? AND password=?`,
    [req.body.email, req.body.password],
    (err, result) =>
      err
        ? res.status(500).json({ error: "Database error" })
        : !result.length
          ? res.json({ success: false, error: "Invalid email or password" })
          : res.json({ success: true, ...result[0] })
  )
);



// Select Category
router.get("/category", (req, res) => {
  const sql = "SELECT * FROM category";
  conn.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching category:", err);
      return res.status(500).json({ message: "Database query error" });
    }
    res.json(result);
  });
});

// Select subjects by category
router.get("/subject/:cateid", (req, res): any =>
  conn.query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM review WHERE sid=s.subid AND showpost=0) review_count,
      (SELECT IFNULL(AVG(rate),0) FROM review WHERE sid=s.subid AND showpost=0) avg_rate
    FROM subject s
    WHERE cateid=?
    ORDER BY subcode ASC
  `, [req.params.cateid],
    (err, r) => err ? res.status(500).json({ message: "Database query error" }) : res.json(r)
  )
);


// Select subject data for show subject name, subject code
router.get('/subjectData/:subid', (req, res): any => {
  const { subid } = req.params;

  if (!subid) return res.status(400).json({ success: false, message: "กรุณาระบุรหัสรายวิชา" });

  conn.query("SELECT * FROM subject WHERE subid = ?", [subid], (err, r: any[]) => {
    if (err) return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    if (!r.length) return res.status(404).json({ success: false, message: "ไม่พบรายวิชานี้" });
    return res.json({ success: true, data: r[0] });
  });
});


// Select post review by subject id

router.get('/review/:subid', (req: Request, res: Response): void => {
  const subid = req.params.subid;
  if (!subid) {
    res.status(400).json({ status: false, message: "กรุณาระบุรหัสรายวิชา" });
    return;
  }
  const sql = `
    SELECT 
      r.*,
      u.name AS user_name,
      u.profile AS user_profile,
      COUNT(l.pid) AS like
    FROM review r
    LEFT JOIN users u ON r.uid = u.uid
    LEFT JOIN like l ON r.pid = l.pid
    WHERE r.sid = ? AND r.showpost = 0
    GROUP BY r.pid
    ORDER BY r.pid ASC
  `;

  conn.query(sql, [subid], (err, result: any) => {
    if (err) {
      console.error("SQL Error:", err);
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
      return;
    }
    if (result.length === 0) {
      res.status(404).json({ status: false, message: "ยังไม่มีรีวิวในรายวิชานี้" });
      return;
    }
    res.status(200).json({
      status: true,
      data: result
    });
  });
});


router.post('/favorite', (req: Request, res: Response): void => {
  const { pid, uid } = req.body as { pid: number, uid: number };
  if (!pid || !uid) {
    res.status(400).json({ success: false, message: "กรุณาระบุ pid และ uid" });
    return;
  }
  const checkSql = "SELECT * FROM favorite_review WHERE pid = ? AND uid = ?";
  conn.query(checkSql, [pid, uid], (err, result) => {
    if (err) {
      console.error("SQL Error:", err);
      res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
      return;
    }
    if (result.length > 0) {
      const deleteSql = "DELETE FROM favorite_review WHERE pid = ? AND uid = ?";
      conn.query(deleteSql, [pid, uid], (err) => {
        if (err) {
          console.error("Delete Error:", err);
          res.status(500).json({ success: false, message: "ไม่สามารถลบออกจากรายการโปรดได้" });
          return;
        }
        res.status(200).json({ success: true, favorited: false, message: "นำออกจากรายการโปรดแล้ว" });
      });
    } else {
      const insertSql = "INSERT INTO favorite_review (uid, pid) VALUES (?, ?)";
      conn.query(insertSql, [uid, pid], (err) => {
        if (err) {
          console.error("Insert Error:", err);
          res.status(500).json({ success: false, message: "ไม่สามารถเพิ่มลงรายการโปรดได้" });
          return;
        }
        res.status(200).json({ success: true, favorited: true, message: "เพิ่มลงรายการโปรดแล้ว" });
      });
    }
  });
});





router.post("/add", (req: Request, res: Response): void => {
  console.log("RECEIVED BODY:", req.body);

  const {
    sid,
    uid,
    rate,
    descriptions,
    anonymous_type,
    date_post,
    showpost
  } = req.body;

  if (!sid || !uid || !rate || !descriptions) {
    res.status(400).json({
      success: false,
      message: "กรุณากรอกข้อมูลให้ครบ"
    });
    return;
  }


  const checkSql = `SELECT pid FROM review WHERE sid = ? AND uid = ? LIMIT 1`;
  conn.query(checkSql, [sid, uid], (err, result) => {
    if (result.length > 0) {
      res.status(200).json({
        success: false,
        message: "ผู้ใช้นี้เคยรีวิวรายวิชานี้แล้ว"
      });
      return;
    }
    if (err) {
      console.error("Check SQL Error:", err);
      res.status(500).json({
        success: false,
        message: "เกิดข้อผิดพลาดในระบบ"
      });
      return;
    }
    const insertSql = `
      INSERT INTO review 
      (sid, uid, rate, descriptions, anonymous_type, date_post, showpost)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    conn.query(
      insertSql,
      [sid, uid, rate, descriptions, anonymous_type, date_post, showpost],
      (err, result: any) => {
        if (err) {
          console.error("Insert Error:", err);
          res.status(500).json({
            success: false,
            message: "ไม่สามารถบันทึกรีวิวได้"
          });
          return;
        }
        res.status(201).json({
          success: true,
          message: "บันทึกรีวิวสำเร็จ",
          reviewId: result.insertId
        });
      }
    );
  });
});


router.post('/favrev', (req, res): any => {
  const { uid } = req.body;

  if (!uid) return res.status(400).json({ success: false, message: "ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบก่อน!" });

  conn.query(`select favorite_review.pid, review.date_post, subject.subcode
              from favorite_review, review, subject
              where favorite_review.pid = review.pid
              and review.sid = subject.subid
              and favorite_review.uid = ?`, [uid], (err, r: any[]) => {
    if (err) return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    if (!r.length) return res.status(404).json({ success: false, message: "ไม่พบรายการโปรด" });
    return res.json({ success: true, message: "พบรายการโปรด", r });
  });
});

router.post('/detail', (req, res): any => {
  const { pid } = req.body;

  if (!pid) return res.status(400).json({ success: false, message: "ไม่รายการรีวิว!" });

  conn.query(`select subject.name, r.rate, r.anonymous_type, r.date_post, r.descriptions,
              u.name, u.profile
              from subject, review r, users u
              where subject.subid = r.sid
              and u.uid = r.uid
              and r.pid = ?`, [pid], (err, r: any[]) => {
    if (err) return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    if (!r.length) return res.status(404).json({ success: false, message: "ไม่พบรายการรีวิว" });
    return res.json({ success: true, r });
  });
});



router.post("/comment", (req: Request, res: Response): void => {
  console.log("RECEIVED BODY:", req.body);

  const {
    uid,
    pid,
    descript
  } = req.body;

  if (!pid || !uid || !descript) {
    res.status(400).json({
      success: false,
      message: "กรุณาส่งข้อมูลมาให้ครบ"
    });
    return;
  }

    const insertSql = `
      INSERT INTO comment 
      (uid, pid, descript)
      VALUES (?, ?, ?)
    `;
    conn.query(
      insertSql,
      [uid, pid, descript],
      (err, result: any) => {
        if (err) {
          console.error("Insert Error:", err);
          res.status(500).json({
            success: false,
            message: "ไม่สามารถเพิ่มความคิดเห็นได้"
          });
          return;
        }
        res.status(201).json({
          success: true,
          message: "เพิ่มความคิดเห็นสำเร็จ",
          reviewId: result.insertId
        });
      }
    );
  });

router.post('/select/comment', (req, res): any => {
  const { pid } = req.body;

  if (!pid) return res.status(400).json({ success: false, message: "ไม่รายการรีวิว!" });

  conn.query(`select u.name, c.descript, u.profile
              from users u, comment c
              where u.uid = c.uid
              and c.pid = ?
              `, [pid], (err, r: any[]) => {
    if (err) return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    if (!r.length) return res.status(404).json({ success: false, message: "ไม่พบความคิดเห็น" });
    return res.json({ success: true, r });
  });
});






router.post("/add/subject", (req: Request, res: Response): void => {
  console.log("RECEIVED BODY:", req.body);

  const { cateid, subcode, name } = req.body;

  if (!cateid || !subcode || !name) {
    res.status(400).json({
      success: false,
      message: "กรุณากรอกข้อมูลให้ครบ"
    });
    return;
  }

  const checkSql = `SELECT subcode FROM subject WHERE subcode = ? LIMIT 1`;
  conn.query(checkSql, [subcode], (err, result) => {
    if (result.length > 0) {
      res.status(200).json({
        success: false,
        message: "มีวิชา "+subcode+" ในระบบแล้ว"
      });
      return;
    }
    if (err) {
      res.status(500).json({
        success: false,
        message: "เกิดข้อผิดพลาดในระบบ!"
      });
      return;
    }
    const open = 1;
    const insertSql = `
      INSERT INTO subject 
      (cateid, subcode, name, open)
      VALUES (?, ?, ?, ?)
    `;
    conn.query(
      insertSql,
      [cateid, subcode, name, open],
      (err, result: any) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาด กรุณาตรวจสอบฐานข้อมูล!"
          });
          return;
        }
        res.status(201).json({
          success: true,
          message: "เพิ่มรายวิชาสำเร็จ!",
          result
        });
      }
    );
  });
});