import express from "express";
import { conn } from "../db";
import { Request, Response } from 'express';
export const router = express.Router();


// Admin close review.
router.put("/review/visibility", (req: Request, res: Response): void => {
  const { reviewID } = req.body;

  if (!reviewID) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบ" });
    return;
  }

  // ใช้ getConnection เพื่อทำ transaction
  conn.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ status: false, message: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้" });
      return;
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        res.status(500).json({ status: false, message: "ไม่สามารถเริ่ม transaction ได้" });
        return;
      }

      // ดึง uid เจ้าของโพสต์ก่อน
      const getOwnerSql = "SELECT uid FROM review WHERE pid = ?";

      connection.query(getOwnerSql, [reviewID], (err, reviewResult: any) => {
        if (err || !reviewResult || reviewResult.length === 0) {
          return connection.rollback(() => {
            connection.release();
            res.status(404).json({ status: false, message: "ไม่พบรีวิวที่ต้องการ" });
          });
        }

        const reviewOwnerUid = reviewResult[0].uid;

        // ปิดการมองเห็นโพสต์
        const updateSql = "UPDATE review SET showpost = 0 WHERE pid = ?";

        connection.query(updateSql, [reviewID], (err, result: any) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
            });
          }

          // ส่ง notification ไปหาเจ้าของโพสต์
          const insertNotificationSql = `
            INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid)
            VALUES (?, ?, NOW(), 0, ?, ?, ?)
          `;

          connection.query(
            insertNotificationSql,
            [
              "โพสต์ของคุณถูกปิดการมองเห็นโดยผู้ดูแลระบบ",
              "โพสต์ของคุณถูกซ่อนเนื่องจากพบพฤติกรรมที่ไม่เหมาะสม",
              "review",
              reviewID,
              reviewOwnerUid,
            ],
            (err) => {
              if (err) {
                console.error("Failed to send notification:", err);
                // ไม่ rollback เพราะ update โพสต์สำเร็จแล้ว (เหมือน delete endpoint)
              }

              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ status: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
                  });
                }

                connection.release();
                res.status(200).json({ status: true, message: "ปิดรีวิวและแจ้งเตือนผู้ใช้สำเร็จ" });
              });
            }
          );
        });
      });
    });
  });
});

// Admin close question.
router.put("/question/visibility", (req: Request, res: Response): void => {
  const { questionID } = req.body;

  if (!questionID) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบ" });
    return;
  }

  // ใช้ getConnection เพื่อทำ transaction
  conn.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ status: false, message: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้" });
      return;
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        res.status(500).json({ status: false, message: "ไม่สามารถเริ่ม transaction ได้" });
        return;
      }

      // ดึง uid เจ้าของโพสต์ก่อน
      const getOwnerSql = "SELECT uid FROM question WHERE id = ?";

      connection.query(getOwnerSql, [questionID], (err, questionResult: any) => {
        if (err || !questionResult || questionResult.length === 0) {
          return connection.rollback(() => {
            connection.release();
            res.status(404).json({ status: false, message: "ไม่พบโพสต์ที่ต้องการ" });
          });
        }

        const questionOwnerUid = questionResult[0].uid;

        // ปิดการมองเห็นโพสต์
        const updateSql = "UPDATE question SET open = 0 WHERE id = ?";

        connection.query(updateSql, [questionID], (err, result: any) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
            });
          }

          // ส่ง notification ไปหาเจ้าของโพสต์
          const insertNotificationSql = `
            INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid)
            VALUES (?, ?, NOW(), 0, ?, ?, ?)
          `;

          connection.query(
            insertNotificationSql,
            [
              "โพสต์ของคุณถูกปิดการมองเห็นโดยผู้ดูแลระบบ",
              "โพสต์ของคุณถูกซ่อนเนื่องจากพบพฤติกรรมที่ไม่เหมาะสม",
              "question",
              questionID,
              questionOwnerUid,
            ],
            (err) => {
              if (err) {
                console.error("Failed to send notification:", err);
                // ไม่ rollback เพราะ update โพสต์สำเร็จแล้ว (เหมือน delete endpoint)
              }

              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ status: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
                  });
                }

                connection.release();
                res.status(200).json({ status: true, message: "ปิดโพสต์และแจ้งเตือนผู้ใช้สำเร็จ" });
              });
            }
          );
        });
      });
    });
  });
});