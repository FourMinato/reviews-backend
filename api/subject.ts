import express from "express";
import { conn } from "../db"; 
import mysql from "mysql2";
import { Router, Request, Response } from 'express';
import { checkAdmin } from "../middleware/auth";

export const router = express.Router();

router.post("/create/subject", checkAdmin, (req: Request, res: Response): void => {
  const { cateID, subcode, name } = req.body;

  if (!cateID || !subcode || !name) {
    res.status(400).json({ status: false, message: "กรุณาใส่ข้อมูลรายวิชาให้ครบถ้วน" });
    return;
  }
  if (subcode.length > 7) {
    res.status(400).json({ status: false, message: "รหัสวิชาต้องไม่เกิน 7 ตัวอักษร" });
    return;
  }
  const checkReported = "SELECT * FROM subject WHERE subcode = ?";
  conn.query(checkReported, [subcode], (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }
    if (result.length > 0) {
      res.status(200).json({ status: false, message: "มีรายวิชานี้ในระบบแล้ว!" });
      return;
    }

    const insertSubject = "INSERT INTO subject (cateid, subcode, name, open) VALUES (?, ?, ?, 1)";
    conn.query(insertSubject, [cateID, subcode, name], (err, result) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }
      res.status(201).json({
        status: true,
        message: "เพิ่มรายวิชาสำเร็จ!",
        subject: result.insertId,
      });
    });
  });
});

router.get('/data/:subcode', (req, res) => {
    const { subcode } = req.params;
    if (!subcode) {
        res.status(400).json({ status: false, message: "กรุณากรอกรหัสรายวิชา!" });
        return;
    }

    conn.query(`SELECT subid, subcode, name
                FROM subject
                WHERE subid=?
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


router.put("/update/subject/:subid", checkAdmin, (req: Request, res: Response): void => {
  const { subid } = req.params;
  const { category, subcode, subname, open } = req.body;

  const selectSql = `SELECT * FROM subject WHERE subid = ?`;

  conn.query(selectSql, [subid], (err, result: any[]) => {
    if (err) {
      res.status(500).json({ status: false, message: "Database error" });
      return;
    }

    if (result.length === 0) {
      res.status(404).json({ status: false, message: "ไม่พบข้อมูล" });
      return;
    }

    const existing = result[0];

    const toString = (val: any) => (val !== undefined && val !== null ? String(val).trim() : "");

    const updatedCategory = toString(category) || existing.cateid;
    const updatedSubcode  = toString(subcode)  || existing.subcode;
    const updatedSubname  = toString(subname)  || existing.name;
    const updatedOpen = (open !== undefined && open !== null) ? open : existing.open;

    // ✅ เช็ค duplicate subcode เฉพาะเมื่อมีการส่ง subcode ใหม่มา และไม่ใช่ subcode ของตัวเอง
    if (subcode && toString(subcode) !== toString(existing.subcode)) {
      const checkDupSql = `SELECT subid FROM subject WHERE subcode = ? AND subid != ?`;

      conn.query(checkDupSql, [updatedSubcode, subid], (err, dupResult: any[]) => {
        if (err) {
          res.status(500).json({ status: false, message: "Database error" });
          return;
        }

        if (dupResult.length > 0) {
          res.status(409).json({ status: false, message: "รหัสวิชานี้มีอยู่ในระบบแล้ว" });
          return;
        }

        // ไม่ซ้ำ → update ได้เลย
        runUpdate();
      });
    } else {
      // ไม่ได้ส่ง subcode ใหม่มา → update ได้เลย
      runUpdate();
    }

    function runUpdate() {
      const updateSql = `UPDATE subject 
                         SET cateid = ?, subcode = ?, name = ?, open = ?
                         WHERE subid = ?`;

      conn.query(updateSql, [updatedCategory, updatedSubcode, updatedSubname, updatedOpen, subid], (err) => {
        if (err) {
          console.error("Update error:", err);
          res.status(500).json({ status: false, message: "Database error" });
          return;
        }
        res.json({ status: true, message: "อัปเดตสำเร็จ" });
      });
    }
  });
});

router.get('/subject/search/:subcode', (req, res) => {
    const { subcode } = req.params;
    if (!subcode) {
        res.status(400).json({ status: false, message: "กรุณากรอกรหัสรายวิชา!" });
        return;
    }

    const searchTerm = `%${subcode}%`;

    conn.query(`SELECT s.*,
                (SELECT COUNT(*) FROM review WHERE sid=s.subid AND showpost=1) review_count,
                (SELECT ROUND(IFNULL(AVG(rate), 0), 1) FROM review WHERE sid = s.subid AND showpost = 1) AS avg_rate
                FROM subject s
                WHERE subcode LIKE ? OR name LIKE ?
              `, [searchTerm, searchTerm], (err, result: any[]) => {
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