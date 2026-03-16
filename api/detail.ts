import express from "express";
import { conn } from "../db";
import { Request, Response } from 'express';
export const router = express.Router();
router.get("/review/:pid", (req, res) => {
  const { pid } = req.params;
  const sql = `SELECT 
    review.pid, 
    review.uid,
    review.showpost,
    users.profile,
    users.name, 
    review.date, 
    review.rate, 
    review.descriptions, 
    review.is_anonymous
  FROM users, review
  WHERE users.uid = review.uid
  AND review.pid = ?`; // เอา AND review.showpost = 1 ออก

  conn.query(sql, [pid], (err, result: any) => {
    if (err) return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });

    if (!result || result.length === 0) {
      res.status(404).json({ status: false, message: "ไม่พบรีวิวนี้", reason: "not_found" });
      return;
    }

    if (result[0].showpost === 0) {
      res.status(404).json({ status: false, message: "รีวิวถูกปิดการมองเห็น", reason: "hidden" });
      return;
    }

    const processedData = result.map((review: any) => ({
      ...review,
      is_anonymous: Boolean(review.is_anonymous),
      name: review.is_anonymous ? 'ผู้โพสต์ไม่ระบุตัวตน' : review.name,
      profile: review.is_anonymous ? 'a25d9385-c882-4b3d-aa5b-508eabcd5987.png' : review.profile
    }));
    res.json({ status: true, result: processedData });
  });
});

router.get("/admin/review/:pid", (req, res) => {
  const { pid } = req.params;
  const sql = `SELECT 
    review.pid, 
    review.uid,
    review.showpost,
    users.profile,
    users.name, 
    review.date, 
    review.rate, 
    review.descriptions, 
    review.is_anonymous
  FROM users, review
  WHERE users.uid = review.uid
  AND review.pid = ?`;

  conn.query(sql, [pid], (err, result: any) => {
    if (err) return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });

    if (!result || result.length === 0) {
      res.status(404).json({ status: false, message: "ไม่พบรีวิวนี้", reason: "not_found" });
      return;
    }

    const processedData = result.map((review: any) => ({
      ...review,
      is_anonymous: Boolean(review.is_anonymous),
      name: review.is_anonymous ? 'ผู้โพสต์ไม่ระบุตัวตน' : review.name,
      profile: review.is_anonymous ? 'a25d9385-c882-4b3d-aa5b-508eabcd5987.png' : review.profile
    }));

    res.json({ 
      status: true, 
      result: processedData,
      is_hidden: result[0].showpost === 0
    });
  });
});

router.get("/question/:pid", (req, res) => {
  const { pid } = req.params;

  // ดึงข้อมูลโดยไม่เช็ค open ก่อน
  const sql = `SELECT 
    question.id, 
    question.uid,
    question.open,
    users.profile,
    users.name, 
    question.date, 
    question.descriptions
  FROM users, question
  WHERE users.uid = question.uid
  AND question.id = ?`;

  conn.query(sql, [pid], (err, result: any) => {
    if (err) return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });

    if (!result || result.length === 0) {
      res.status(404).json({ status: false, message: "ไม่พบโพสต์นี้", reason: "not_found" });
      return;
    }

    if (result[0].open === 0) {
      res.status(404).json({ status: false, message: "โพสต์ถูกปิดการมองเห็น", reason: "hidden" });
      return;
    }

    res.json({ status: true, result });
  });
});


router.get("/admin/question/:pid", (req, res) => {
  const { pid } = req.params;

  // ดึงข้อมูลโดยไม่เช็ค open ก่อน
  const sql = `SELECT 
    question.id, 
    question.uid,
    question.open,
    users.profile,
    users.name, 
    question.date, 
    question.descriptions
  FROM users, question
  WHERE users.uid = question.uid
  AND question.id = ?`;

  conn.query(sql, [pid], (err, result: any) => {
    if (err) return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });

    if (!result || result.length === 0) {
      res.status(404).json({ status: false, message: "ไม่พบโพสต์นี้", reason: "not_found" });
      return;
    }

    res.json({ status: true, result, is_hidden: result[0].open === 0 });
  });
});