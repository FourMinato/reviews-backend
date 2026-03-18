import express from "express";
import { conn } from "../db";
import { Request, Response } from 'express';
import { checkAdmin } from "../middleware/auth";
export const router = express.Router();

// Admin delete subject
router.delete("/subject/:subid", checkAdmin, (req: Request, res: Response): void => {
  const subid = req.params.subid;

  if (!subid) {
    res.status(400).json({
      status: false,
      message: "ข้อมูลไม่ครบ",
    });
    return;
  }

  // ลบ comments ก่อน (เพราะอ้างอิงถึง review)
  const deleteSubject = "DELETE FROM subject WHERE subid = ?";
  
  conn.query(deleteSubject, [subid], (err, result: any) => {
    if (err) {
      res.status(200).json({ 
        status: false, 
        message: "มีรีวิวอยู่ในรายวิชาขณะนี้!" 
      });
      return;
    }
      
      if (result.affectedRows === 0) {
        res.status(404).json({
          status: false,
          message: "ไม่พบรายวิชาที่ต้องการลบ",
        });
        return;
      }
      
      res.status(200).json({
        status: true,
        message: "ลบรายวิชาสำเร็จ",
      });
    });
  });

  



// Admin delete question (with CASCADE)
router.delete("/admin/delete/question/:questionID", (req: Request, res: Response): void => {
  const questionID = req.params.questionID;
  if (!questionID) {
    res.status(400).json({
      status: false,
      message: "ข้อมูลไม่ครบ",
    });
    return;
  }

  // Get connection from pool
  conn.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ status: false, message: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้" });
      return;
    }

    // เริ่ม transaction
    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        res.status(500).json({ status: false, message: "ไม่สามารถเริ่ม transaction ได้" });
        return;
      }

      // ดึงข้อมูลเจ้าของ question ก่อนลบ
      const getQuestionOwnerSql = "SELECT uid FROM question WHERE id = ?";
      
      connection.query(getQuestionOwnerSql, [questionID], (err, questionResult: any) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
          });
        }

        if (!questionResult || questionResult.length === 0) {
          return connection.rollback(() => {
            connection.release();
            res.status(404).json({ status: false, message: "ไม่พบคำถามที่ต้องการลบ" });
          });
        }

        const questionOwnerUid = questionResult[0].uid;
        // ลบ comments ก่อน
        const deleteCommentsSql = "DELETE FROM comments WHERE type = 'question' AND ref_id = ?";
        
        connection.query(deleteCommentsSql, [questionID], (err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ 
                status: false, 
                message: "เกิดข้อผิดพลาดในการลบความคิดเห็น!" 
              });
            });
          }

          // ลบ question
          const deleteQuestionSql = "DELETE FROM question WHERE id = ?";
          
          connection.query(deleteQuestionSql, [questionID], (err, result: any) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ 
                  status: false, 
                  message: "เกิดข้อผิดพลาดในการลบคำถาม!" 
                });
              });
            }

            if (result.affectedRows === 0) {
              return connection.rollback(() => {
                connection.release();
                res.status(404).json({
                  status: false,
                  message: "ไม่พบคำถามที่ต้องการลบ",
                });
              });
            }

            // ส่งการแจ้งเตือนไปหาเจ้าของ question
            const insertNotificationSql = `
              INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid) 
              VALUES (?, ?, NOW(), 0, ?, ?, ?)
            `;
            
            const notificationTitle = "โพสต์ของคุณถูกลบโดยผู้ดูแลระบบ";
            const notificationContent = "โพสต์ของคุณถูกลบเนื่องจากพบพฤติกรรมที่ไม่เหมาะสม"
            const refType = "question";
            const refId = questionID; 

            connection.query(
              insertNotificationSql,
              [
                notificationTitle, 
                notificationContent, 
                refType, 
                refId, 
                questionOwnerUid
              ],
              (err) => {
                if (err) {
                  // Log error แต่ไม่ rollback เพราะลบโพสต์สำเร็จแล้ว
                  console.error("Failed to send notification:", err);
                }

                // Commit transaction
                connection.commit((err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ 
                        status: false, 
                        message: "ไม่สามารถบันทึกข้อมูลได้" 
                      });
                    });
                  }

                  connection.release();
                  res.status(200).json({
                    status: true,
                    message: "ลบคำถามและความคิดเห็นสำเร็จ",
                  });
                });
              }
            );
          });
        });
      });
    });
  });
});


// User delete question
router.delete("/question/:questionID", (req: Request, res: Response): void => {
  const questionID = req.params.questionID;

  if (!questionID) {
    res.status(400).json({
      status: false,
      message: "ข้อมูลไม่ครบ",
    });
    return;
  }

  // ลบ comments ก่อน (เพราะอ้างอิงถึง review)
  const deleteCommentsSql = "DELETE FROM comments WHERE type = 'question' AND ref_id = ?";
  
  conn.query(deleteCommentsSql, [questionID], (err) => {
    if (err) {
      res.status(500).json({ 
        status: false, 
        message: "เกิดข้อผิดพลาดในการลบความคิดเห็น!" 
      });
      return;
    }

    // ลบ question
    const deleteQuestionSql = "DELETE FROM question WHERE id = ?";
    
    conn.query(deleteQuestionSql, [questionID], (err, result: any) => {
      if (err) {
        res.status(500).json({ 
          status: false, 
          message: "เกิดข้อผิดพลาดในการลบคำถาม!" 
        });
        return;
      }
      
      if (result.affectedRows === 0) {
        res.status(404).json({
          status: false,
          message: "ไม่พบคำถามที่ต้องการลบ",
        });
        return;
      }
      
      res.status(200).json({
        status: true,
        message: "ลบคำถามและความคิดเห็นสำเร็จ",
      });
    });
  });
});


// Admin delete review (with CASCADE)
router.delete("/admin/delete/review/:reviewID", (req: Request, res: Response): void => {
  const reviewID = req.params.reviewID;
  if (!reviewID) {
    res.status(400).json({
      status: false,
      message: "ข้อมูลไม่ครบ",
    });
    return;
  }

  // Get connection from pool
  conn.getConnection((err, connection) => {
    if (err) {
      res.status(500).json({ status: false, message: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้" });
      return;
    }

    // เริ่ม transaction
    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        res.status(500).json({ status: false, message: "ไม่สามารถเริ่ม transaction ได้" });
        return;
      }

      // ดึงข้อมูลเจ้าของ review ก่อนลบ
      const getReviewOwnerSql = "SELECT uid FROM review WHERE pid = ?";
      
      connection.query(getReviewOwnerSql, [reviewID], (err, reviewResult: any) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
          });
        }

        if (!reviewResult || reviewResult.length === 0) {
          return connection.rollback(() => {
            connection.release();
            res.status(404).json({ status: false, message: "ไม่พบรีวิวที่ต้องการลบ" });
          });
        }

        const reviewOwnerUid = reviewResult[0].uid;
        // ลบ comments ก่อน
        const deleteCommentsSql = "DELETE FROM comments WHERE type = 'review' AND ref_id = ?";
        
        connection.query(deleteCommentsSql, [reviewID], (err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ 
                status: false, 
                message: "เกิดข้อผิดพลาดในการลบความคิดเห็น!" 
              });
            });
          }

          // ลบ review
          const deleteReviewSql = "DELETE FROM review WHERE pid = ?";
          
          connection.query(deleteReviewSql, [reviewID], (err, result: any) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ 
                  status: false, 
                  message: "เกิดข้อผิดพลาดในการลบรีวิว!" 
                });
              });
            }

            if (result.affectedRows === 0) {
              return connection.rollback(() => {
                connection.release();
                res.status(404).json({
                  status: false,
                  message: "ไม่พบรีวิวที่ต้องการลบ",
                });
              });
            }

            // ส่งการแจ้งเตือนไปหาเจ้าของ review
            const insertNotificationSql = `
              INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid) 
              VALUES (?, ?, NOW(), 0, ?, ?, ?)
            `;
            
            const notificationTitle = "โพสต์ของคุณถูกลบโดยผู้ดูแลระบบ";
            const notificationContent = "โพสต์ของคุณถูกลบเนื่องจากพบพฤติกรรมที่ไม่เหมาะสม"
            const refType = "review";
            const refId = reviewID; 

            connection.query(
              insertNotificationSql,
              [
                notificationTitle, 
                notificationContent, 
                refType, 
                refId, 
                reviewOwnerUid
              ],
              (err) => {
                if (err) {
                  // Log error แต่ไม่ rollback เพราะลบโพสต์สำเร็จแล้ว
                  console.error("Failed to send notification:", err);
                }

                // Commit transaction
                connection.commit((err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ 
                        status: false, 
                        message: "ไม่สามารถบันทึกข้อมูลได้" 
                      });
                    });
                  }

                  connection.release();
                  res.status(200).json({
                    status: true,
                    message: "ลบรีวิวและความคิดเห็นสำเร็จ",
                  });
                });
              }
            );
          });
        });
      });
    });
  });
});

//delete comment
router.delete("/comment/:commentID", (req: Request, res: Response): void => {
  const commentID = req.params.commentID;

  if (!commentID) {
    res.status(400).json({
      status: false,
      message: "ข้อมูลไม่ครบ",
    });
    return;
  }
  const sql = "DELETE FROM comments WHERE id = ?";

  conn.query(sql, [commentID], (err, result: any) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในการลบความคิดเห็น!" });
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).json({
        status: false,
        message: "ไม่พบความคิดเห็นที่ต้องการลบ",
      });
      return;
    }
    res.status(200).json({
      status: true,
      message: "ลบความคิดเห็นสำเร็จ",
    });
  });
});



// User delete review (with CASCADE)
router.delete("/review/:reviewID", (req: Request, res: Response): void => {
  const reviewID = req.params.reviewID;

  if (!reviewID) {
    res.status(400).json({
      status: false,
      message: "ข้อมูลไม่ครบ",
    });
    return;
  }

  // ลบ comments ก่อน (เพราะอ้างอิงถึง review)
  const deleteCommentsSql = "DELETE FROM comments WHERE type = 'review' AND ref_id = ?";
  
  conn.query(deleteCommentsSql, [reviewID], (err) => {
    if (err) {
      res.status(500).json({ 
        status: false, 
        message: "เกิดข้อผิดพลาดในการลบความคิดเห็น!" 
      });
      return;
    }

    // ลบ review
    const deleteReviewSql = "DELETE FROM review WHERE pid = ?";
    
    conn.query(deleteReviewSql, [reviewID], (err, result: any) => {
      if (err) {
        res.status(500).json({ 
          status: false, 
          message: "เกิดข้อผิดพลาดในการลบรีวิว!" 
        });
        return;
      }
      
      if (result.affectedRows === 0) {
        res.status(404).json({
          status: false,
          message: "ไม่พบรีวิวที่ต้องการลบ",
        });
        return;
      }
      
      res.status(200).json({
        status: true,
        message: "ลบรีวิวและความคิดเห็นสำเร็จ",
      });
    });
  });
});