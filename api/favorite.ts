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

// favorite review.
router.post("/review", checkSuspended, (req: Request, res: Response): void => {
  const { uid, reviewID } = req.body;

  if (!uid || !reviewID) {
    console.error("uid or reviewID is missing");
    res.status(400).json({ status: false, message: "กรุณาเข้าสู่ระบบก่อน!" });
    return;
  }

  const checkFavorite = "SELECT * FROM favorite_review WHERE revid = ? AND uid = ?";
  conn.query(checkFavorite, [reviewID, uid], (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }

    // ถ้ามีอยู่แล้ว ให้ลบออก (unfavorite)
    if (result.length > 0) {
      const deleteFavorite = "DELETE FROM favorite_review WHERE revid = ? AND uid = ?";
      conn.query(deleteFavorite, [reviewID, uid], (err, deleteResult) => {
        if (err) {
          res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
          return;
        }
        res.status(200).json({
          status: true,
          message: "ยกเลิกการบันทึกสำเร็จ!",
          action: "removed"
        });
      });
      return;
    }

    // ถ้ายังไม่มี ให้เพิ่มเข้าไป (favorite)
    const insertFavoriteReview = "INSERT INTO favorite_review (uid, revid, date) VALUES (?, ?, NOW())";
    conn.query(insertFavoriteReview, [uid, reviewID], (err, insertResult) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }
      res.status(201).json({
        status: true,
        message: "บันทึกรีวิวสำเร็จ!",
        action: "added",
        favoriteID: insertResult.insertId,
      });
    });
  });
});

// favorite question.
router.post("/question", checkSuspended, (req: Request, res: Response): void => {
  const { uid, questionID } = req.body;

  if (!uid || !questionID) {
    console.error("uid or questionID is missing");
    res.status(400).json({ status: false, message: "กรุณาเข้าสู่ระบบก่อน!" });
    return;
  }
  const checkFavorite = "SELECT * FROM favorite_question WHERE pid = ? AND uid = ?";
  conn.query(checkFavorite, [questionID, uid], (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }
    if (result.length > 0) {
      const deleteFavorite = "DELETE FROM favorite_question WHERE pid = ? AND uid = ?";
      conn.query(deleteFavorite, [questionID, uid], (err, deleteResult) => {
        if (err) {
          res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
          return;
        }
        res.status(200).json({
          status: true,
          message: "ยกเลิกการบันทึกสำเร็จ!",
          action: "removed"
        });
      });
      return;
    }

    const insertFavoriteQuestion = "INSERT INTO favorite_question (uid, pid, date) VALUES (?, ?, NOW())";
    conn.query(insertFavoriteQuestion, [uid, questionID], (err, result) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }
      res.status(201).json({
        status: true,
        message: "บันทึกรีวิวสำเร็จ!",
        action: "added"
      });
    });
  });
});


// Get user favorite Reviews order by date.
router.get("/review/date/:uid", (req, res) => {
  const uid = req.params.uid;
  const sql = `
    SELECT 
      review.pid, 
      review.descriptions, 
      review.date, 
      review.rate, 
      review.is_anonymous,
      subject.subcode,
      users.name,
      users.profile,
      (SELECT COUNT(*) FROM \`like\` WHERE \`like\`.pid = review.pid) AS like_count,
      (SELECT COUNT(*) FROM comments WHERE comments.ref_id = review.pid AND comments.type = 'review') AS comment_count,
      (SELECT COUNT(*) FROM favorite_review WHERE favorite_review.revid = review.pid AND favorite_review.uid = ?) AS is_saved,
      (SELECT COUNT(*) FROM \`like\` WHERE \`like\`.pid = review.pid AND \`like\`.uid = ?) AS is_liked
    FROM favorite_review
    JOIN review ON favorite_review.revid = review.pid
    JOIN subject ON review.sid = subject.subid
    JOIN users ON review.uid = users.uid
    WHERE favorite_review.uid = ?
    AND review.showpost = 1
    ORDER BY review.date DESC
  `;
  
  conn.query(sql, [uid, uid, uid], (err, result: any) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    const processedData = result.map((review: any) => ({
      ...review,
      is_anonymous: Boolean(review.is_anonymous),
      is_saved: Boolean(review.is_saved),
      is_liked: Boolean(review.is_liked),
      name: review.is_anonymous ? 'ผู้โพสต์ไม่ระบุตัวตน' : review.name,
      profile: review.is_anonymous ? 'a25d9385-c882-4b3d-aa5b-508eabcd5987.png' : review.profile
    }));
    res.json({ status: true, data: processedData });
  });
});

// Get user favorite Reviews order by subcode.
router.get("/review/subcode/:uid", (req, res) => {
  const uid = req.params.uid;
  const sql = `
    SELECT 
      review.pid, 
      review.descriptions, 
      review.date, 
      review.rate, 
      review.is_anonymous,
      subject.subcode,
      users.name,
      users.profile,
      (SELECT COUNT(*) FROM \`like\` WHERE \`like\`.pid = review.pid) AS like_count,
      (SELECT COUNT(*) FROM comments WHERE comments.ref_id = review.pid AND comments.type = 'review') AS comment_count,
      (SELECT COUNT(*) FROM favorite_review WHERE favorite_review.revid = review.pid AND favorite_review.uid = ?) AS is_saved,
      (SELECT COUNT(*) FROM \`like\` WHERE \`like\`.pid = review.pid AND \`like\`.uid = ?) AS is_liked
    FROM favorite_review
    JOIN review ON favorite_review.revid = review.pid
    JOIN subject ON review.sid = subject.subid
    JOIN users ON review.uid = users.uid
    WHERE favorite_review.uid = ?
    AND review.showpost = 1
    ORDER BY subject.subcode ASC
  `;
  
  conn.query(sql, [uid, uid, uid], (err, result: any) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    const processedData = result.map((review: any) => ({
      ...review,
      is_anonymous: Boolean(review.is_anonymous),
      is_saved: Boolean(review.is_saved),
      is_liked: Boolean(review.is_liked),
      name: review.is_anonymous ? 'ผู้โพสต์ไม่ระบุตัวตน' : review.name,
      profile: review.is_anonymous ? 'a25d9385-c882-4b3d-aa5b-508eabcd5987.png' : review.profile
    }));
    res.json({ status: true, data: processedData });
  });
});

// Get user favorite Questions.
router.get("/question/:uid", (req, res) => {
  const uid = req.params.uid;
  const sql = `
    SELECT 
      question.id, 
      question.descriptions, 
      question.date, 
      users.name, 
      users.profile,
      (SELECT COUNT(*) FROM comments WHERE comments.ref_id = question.id AND comments.type = 'question') AS comment_count,
      true AS is_saved
    FROM favorite_question
    JOIN question ON favorite_question.pid = question.id
    JOIN users ON question.uid = users.uid
    WHERE favorite_question.uid = ?
    AND question.open = 1
    ORDER BY question.date DESC
  `;
  
  conn.query(sql, [uid], (err, result) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    res.json({ status: true, data: result });
  });
});