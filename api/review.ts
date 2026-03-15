import express from "express";
import { conn } from "../db";
import mysql from "mysql2";
import { Request, Response } from 'express';

export const router = express.Router();

// get data for edit question
router.get("/data/question/:id", (req, res) => {
  const { id } = req.params;
  const sql = `SELECT 
    question.id, 
    question.uid,
    question.descriptions
  FROM users, question
  WHERE users.uid = question.uid
  AND question.id = ?`;

  conn.query(sql, [id], (err, result) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }

    res.json({ status: true, data: result });
  });
});


// get data for edit review
router.get("/data/:pid", (req, res) => {
  const { pid } = req.params;
  const sql = `SELECT 
    review.pid, 
    review.uid,
    review.rate, 
    review.descriptions
  FROM users, review
  WHERE users.uid = review.uid
  AND review.pid = ?
  AND review.showpost = 1`;

  conn.query(sql, [pid], (err, result) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }

    res.json({ status: true, data: result });
  });
});


router.get('/question/date/:uid', (req: Request, res: Response): void => {
    let uid = req.params.uid;
    const sql = `
      SELECT 
        question.id,
        question.uid,
        question.date,
        question.descriptions,
        users.name,
        users.profile,
        IF(favorite_question.uid IS NOT NULL, true, false) AS is_saved

      FROM question
      INNER JOIN users ON users.uid = question.uid
      LEFT JOIN favorite_question 
        ON favorite_question.pid = question.id 
        AND favorite_question.uid = ?

      WHERE question.open = 1
      ORDER BY question.date DESC
    `;

    conn.query(sql, [uid], (err, result: any) => {
        if (err) {
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
            return;
        }
        
        if (result.length === 0) {
            res.status(200).json({ 
                status: true, 
                result: [],
                message: "ยังไม่มีคำถาม" 
            });
            return;
        }
        res.status(200).json({
            status: true,
            result: result
        });
    });
});


router.get('/review/date/:subid/:uid?', (req: Request, res: Response): void => {
  const subid = req.params.subid;
  const uid = req.params.uid;
  
  if (!subid) {
    res.status(400).json({ status: false, message: "กรุณาระบุรหัสรายวิชา" });
    return;
  }
  
  const sql = `
  SELECT 
    review.pid,
    review.uid,
    review.date,
    review.rate,
    review.descriptions,
    review.is_anonymous,
    users.name,
    users.profile,
    (SELECT COUNT(*) FROM \`like\` WHERE \`like\`.pid = review.pid) AS like_count,
    ${uid ? `(SELECT COUNT(*) FROM favorite_review WHERE favorite_review.revid = review.pid AND favorite_review.uid = ?) AS is_saved,` : '0 AS is_saved,'}
    ${uid ? `(SELECT COUNT(*) FROM \`like\` WHERE \`like\`.pid = review.pid AND \`like\`.uid = ?) AS is_liked` : '0 AS is_liked'}
  FROM review
  INNER JOIN users ON users.uid = review.uid
  WHERE review.sid = ?
    AND review.showpost = 1
  ORDER BY review.date DESC
`;

  const params = uid ? [uid, uid, subid] : [subid];

  conn.query(sql, params, (err, result: any) => {
    if (err) {
      console.error(err);
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
      return;
    }
    if (result.length === 0) {
      res.status(200).json({ 
        status: true, 
        result: [],
        message: "ยังไม่มีรีวิวในรายวิชานี้" 
      });
      return;
    }
    const processedData = result.map((review: any) => ({
      ...review,
      is_anonymous: Boolean(review.is_anonymous),
      is_saved: Boolean(review.is_saved),
      is_liked: Boolean(review.is_liked),
      name: review.is_anonymous ? 'ผู้โพสต์ไม่ระบุตัวตน' : review.name,
      profile: review.is_anonymous ? 'a25d9385-c882-4b3d-aa5b-508eabcd5987.png' : review.profile
    }));
    res.status(200).json({
      status: true,
      result: processedData
    });
  });
});


router.get('/review/like/:subid/:uid?', (req: Request, res: Response): void => {
  const subid = req.params.subid;
  const uid = req.params.uid;
  
  if (!subid) {
    res.status(400).json({ status: false, message: "กรุณาระบุรหัสรายวิชา" });
    return;
  }
  
  const sql = `
  SELECT 
    review.pid,
    review.uid,
    review.date,
    review.rate,
    review.descriptions,
    review.is_anonymous,
    users.name,
    users.profile,
    (SELECT COUNT(*) FROM \`like\` WHERE \`like\`.pid = review.pid) AS like_count,
    ${uid ? `(SELECT COUNT(*) FROM favorite_review WHERE favorite_review.revid = review.pid AND favorite_review.uid = ?) AS is_saved,` : '0 AS is_saved,'}
    ${uid ? `(SELECT COUNT(*) FROM \`like\` WHERE \`like\`.pid = review.pid AND \`like\`.uid = ?) AS is_liked` : '0 AS is_liked'}
  FROM review
  INNER JOIN users ON users.uid = review.uid
  WHERE review.sid = ?
    AND review.showpost = 1
  ORDER BY like_count DESC
`;

  const params = uid ? [uid, uid, subid] : [subid];

  conn.query(sql, params, (err, result: any) => {
    if (err) {
      console.error(err);
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
      return;
    }
    if (result.length === 0) {
      res.status(200).json({ 
        status: true, 
        result: [],
        message: "ยังไม่มีรีวิวในรายวิชานี้" 
      });
      return;
    }
    const processedData = result.map((review: any) => ({
      ...review,
      is_anonymous: Boolean(review.is_anonymous),
      is_saved: Boolean(review.is_saved),
      is_liked: Boolean(review.is_liked),
      name: review.is_anonymous ? 'ผู้โพสต์ไม่ระบุตัวตน' : review.name,
      profile: review.is_anonymous ? 'a25d9385-c882-4b3d-aa5b-508eabcd5987.png' : review.profile
    }));
    res.status(200).json({
      status: true,
      result: processedData
    });
  });
});
