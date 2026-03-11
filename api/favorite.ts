import express from "express";
import { conn } from "../db";
import { Request, Response } from 'express';
export const router = express.Router();


// favorite review.
router.post("/review", (req: Request, res: Response): void => {
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
router.post("/question", (req: Request, res: Response): void => {
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
    SELECT review.pid, subject.subcode, review.date
    FROM favorite_review
    JOIN review ON favorite_review.revid = review.pid
    JOIN subject ON review.sid = subject.subid
    WHERE favorite_review.uid = ?
    AND review.showpost = 1
    ORDER BY review.date DESC
  `;
  
  conn.query(sql, [uid], (err, result) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    if (result.length === 0) {
      return res.status(200).json({ status: true, data: [], message: "ยังไม่มีรีวิวที่บันทึกไว้" });
    }
    res.json({ status: true, data: result });
  });
});

// Get user favorite Reviews order by subcode.
router.get("/review/subcode/:uid", (req, res) => {
  const uid = req.params.uid;
  const sql = `
    SELECT review.pid, subject.subcode, review.date
    FROM favorite_review
    JOIN review ON favorite_review.revid = review.pid
    JOIN subject ON review.sid = subject.subid
    WHERE favorite_review.uid = ?
    AND review.showpost = 1
    ORDER BY subject.subcode ASC
  `;
  
  conn.query(sql, [uid], (err, result) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    if (result.length === 0) {
      return res.status(200).json({ status: true, data: [], message: "ยังไม่มีรีวิวที่บันทึกไว้" });
    }
    res.json({ status: true, data: result });
  });
});

// Get user favorite Questions.
router.get("/question/:uid", (req, res) => {
  const uid = req.params.uid;
  const sql = `
    SELECT question.id, question.date, users.name
    FROM favorite_question
    JOIN question ON favorite_question.pid = question.id
    JOIN users ON question.uid = users.uid
    WHERE favorite_question.uid = ?
    AND question.open = 1
  `;
  
  conn.query(sql, [uid], (err, result) => {
    if (err) {
      console.error("SQL Error:", err);
      return res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด" });
    }
    if (result.length === 0) {
      return res.status(200).json({ status: true, data: [], message: "ยังไม่มีคำถามที่บันทึกไว้" });
    }
    res.json({ status: true, data: result });
  });
});