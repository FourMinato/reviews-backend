import express from "express";
import { conn } from "../db";
import mysql from "mysql2";
import { Router, Request, Response } from 'express';
import { pid } from "process";

export const router = express.Router();

// Update Like amount.
router.post("/like", (req: Request, res: Response): void => {
  const { uid, reviewID } = req.body;

  if (!uid || !reviewID) {
    console.error("uid or reviewID is missing");
    res.status(400).json({ status: false, message: "กรุณาเข้าสู่ระบบก่อน!" });
    return;
  }

  const checkLike = "SELECT * FROM `like` WHERE pid = ? AND uid = ?";
  conn.query(checkLike, [reviewID, uid], (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }

    // ถ้ามีอยู่แล้ว ให้ลบออก (unlike)
    if (result.length > 0) {
      const deleteLike = "DELETE FROM `like` WHERE pid = ? AND uid = ?";
      conn.query(deleteLike, [reviewID, uid], (err, deleteResult) => {
        if (err) {
          res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
          return;
        }

        // นับจำนวน like ที่เหลือ
        const countLikes = "SELECT COUNT(*) as like_count FROM `like` WHERE pid = ?";
        conn.query(countLikes, [reviewID], (err, countResult: any) => {
          if (err) {
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
            return;
          }
          res.status(200).json({
            status: true,
            message: "ยกเลิกการถูกใจสำเร็จ!",
            action: "unliked",
            like_count: countResult[0].like_count
          });
        });
      });
      return;
    }

    // ถ้ายังไม่มี ให้เพิ่มเข้าไป (like)
    const insertLike = "INSERT INTO `like` (uid, pid) VALUES (?, ?)";
    conn.query(insertLike, [uid, reviewID], (err, insertResult) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }

      // นับจำนวน like ใหม่
      const countLikes = "SELECT COUNT(*) as like_count FROM `like` WHERE pid = ?";
      conn.query(countLikes, [reviewID], (err, countResult: any) => {
        if (err) {
          res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
          return;
        }
        res.status(201).json({
          status: true,
          message: "ถูกใจสำเร็จ!",
          action: "liked",
          like_count: countResult[0].like_count
        });
      });
    });
  });
});


// Update review
router.put("/review", (req: Request, res: Response): void => {
  const { descriptions, rate, pid } = req.body;
  if (!pid || !descriptions || !rate) {
    res.status(400).json({
      status: false,
      message: "ข้อมูลไม่ครบถ้วน",
    });
    return;
  }

  const sql = `
    UPDATE review
    SET descriptions = ?, rate = ?
    WHERE pid = ?
  `;

  conn.query(sql, [descriptions, rate, pid], (err, result: any) => {
    if (err) {
      console.error("Error updating review:", err);
      res.status(500).json({
        status: false,
        message: "เกิดข้อผิดพลาดในการแก้ไขรีวิว!"
      });
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).json({
        status: false,
        message: "ไม่พบรีวิวที่ต้องการแก้ไข",
      });
      return;
    }

    res.status(200).json({
      status: true,
      message: "แก้ไขรีวิวสำเร็จ",
    });
  });
});

// Update question
router.put("/question", (req: Request, res: Response): void => {
  const { descriptions, questionID } = req.body;
  if (!pid || !descriptions) {
    res.status(400).json({
      status: false,
      message: "ข้อมูลไม่ครบถ้วน",
    });
    return;
  }

  const sql = `
    UPDATE question
    SET descriptions = ?
    WHERE id = ?
  `;

  conn.query(sql, [descriptions, questionID], (err, result: any) => {
    if (err) {
      console.error("Error updating question:", err);
      res.status(500).json({
        status: false,
        message: "เกิดข้อผิดพลาดในการแก้ไขคำถาม!"
      });
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).json({
        status: false,
        message: "ไม่พบคำถามที่ต้องการแก้ไข",
      });
      return;
    }

    res.status(200).json({
      status: true,
      message: "แก้ไขคำถามสำเร็จ",
    });
  });
});