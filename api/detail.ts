import express from "express";
import { conn } from "../db";
import { Request, Response } from 'express';
export const router = express.Router();

// review details
router.get("/review/:pid", (req, res) => {
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
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    if (!result || result.length === 0) {
      // ไม่พบรีวิว
      res.status(404).json({ 
        status: false, 
        message: "ไม่พบรีวิวนี้",
        reason: "not_found"
      });
      return;
    }
    const processedData = result.map((review: any) => ({
      ...review,
      is_anonymous: Boolean(review.is_anonymous), //แปลง boolean 0 → false, 1 → true
      name: review.is_anonymous ? 'ผู้โพสต์ไม่ระบุตัวตน' : review.name, // ซ่อนชื่อ
      profile: review.is_anonymous ? 'a25d9385-c882-4b3d-aa5b-508eabcd5987.png' : review.profile //ใช้ profle นี้ถ้าคนโพสต์ไม่ระบุตัวตน
    }));
    res.json({ status: true, result: processedData });
  });
});


// question details
router.get("/question/:pid", (req, res) => {
  const { pid } = req.params;
  const sql = `SELECT 
    question.id, 
    question.uid,
    users.profile,
    users.name, 
    question.date, 
    question.descriptions
  FROM users, question
  WHERE users.uid = question.uid
  AND question.id = ?
  AND question.open = 1`;

  conn.query(sql, [pid], (err, result) => {
    if (err) {
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    if (!result || result.length === 0) {
      // ไม่พบรีวิว
      res.status(404).json({ 
        status: false, 
        message: "ไม่พบโพสต์นี้",
        reason: "not_found"
      });
      return;
    }
    res.json({ status: true, result: result });
  });
});