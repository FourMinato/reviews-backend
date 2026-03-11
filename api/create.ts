import express from "express";
import { conn } from "../db";
import { Request, Response } from 'express';
export const router = express.Router();

// Create review.
router.post("/review", (req: Request, res: Response): void => {
  const {
    sid, uid, rate, descriptions, anonymous_type, showpost
  } = req.body;

  if (!sid || !uid || !rate || !descriptions) {
    res.status(400).json({
      status: false,
      message: "กรุณากรอกข้อมูลให้ครบ"
    });
    return;
  }


  const checkSql = `SELECT pid FROM review WHERE sid = ? AND uid = ? LIMIT 1`;
  conn.query(checkSql, [sid, uid], (err, result) => {
    if (result.length > 0) {
      res.status(200).json({
        status: false,
        message: "คุณเคยรีวิวรายวิชานี้แล้ว"
      });
      return;
    }
    if (err) {
      res.status(500).json({
        status: false,
        message: "เกิดข้อผิดพลาดในระบบ"
      });
      return;
    }
    const insertSql = `
      INSERT INTO review 
      (sid, uid, rate, descriptions, is_anonymous, date, showpost)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    `;
    conn.query(
      insertSql,
      [sid, uid, rate, descriptions, anonymous_type, showpost],
      (err, result: any) => {
        if (err) {
          res.status(500).json({
            status: false,
            message: "เกิดข้อผิดพลาดกรุณาลองใหม่ภายหลัง"
          });
          return;
        }
        res.status(201).json({
          status: true,
          message: "บันทึกรีวิวสำเร็จ",
        });
      }
    );
  });
});

// Create question.
router.post("/question", (req: Request, res: Response): void => {
  const {
    uid, descriptions
  } = req.body;

  if (!uid || !descriptions) {
    res.status(400).json({
      status: false,
      message: "กรุณากรอกข้อมูลให้ครบ"
    });
    return;
  }


  const checkSql = `SELECT id FROM question WHERE uid = ?`;
  conn.query(checkSql, [uid], (err, result) => {
    if (result.length >= 5) {
      res.status(200).json({
        status: false,
        message: "คุณตั้งคำถามมากเกินไป"
      });
      return;
    }
    if (err) {
      res.status(500).json({
        status: false,
        message: "เกิดข้อผิดพลาดในระบบ"
      });
      return;
    }
    const insertSql = `
      INSERT INTO question 
      (uid, descriptions, date, open)
      VALUES (?, ?, NOW(), 1)
    `;
    conn.query(
      insertSql,
      [uid, descriptions],
      (err, result: any) => {
        if (err) {
          res.status(500).json({
            status: false,
            message: "เกิดข้อผิดพลาดกรุณาลองใหม่ภายหลัง"
          });
          return;
        }
        res.status(201).json({
          status: true,
          message: "สร้างโพสต์คำถามสำเร็จ"
        });
      }
    );
  });
});

//Create comments (Review)
router.post("/comment/review", (req: Request, res: Response): void => {
  const { uid, type, descriptions, reviewID } = req.body;

  if (!uid || !type || !descriptions || !reviewID) {
    res.status(400).json({ status: false, message: "กรุณาเข้าสู่ระบบก่อน!" });
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
        connection.release(); // คืน connection กลับไปที่ pool
        res.status(500).json({ status: false, message: "ไม่สามารถเริ่ม transaction ได้" });
        return;
      }

      // ดึงข้อมูลเจ้าของ review
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
            res.status(404).json({ status: false, message: "ไม่พบรีวิวนี้!" });
          });
        }

        const reviewOwnerUid = reviewResult[0].uid;

        // สร้าง comment
        const insertCommentSql = "INSERT INTO comments (uid, type, descriptions, ref_id, replies_to_id) VALUES (?, ?, ?, ?, NULL)";
        
        connection.query(insertCommentSql, [uid, type, descriptions, reviewID], (err, commentResult: any) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
            });
          }

          const commentId = commentResult.insertId;

          // สร้างแจ้งเตือนถ้าไม่ใช่เจ้าของโพสต์
          if (uid !== reviewOwnerUid) {
            const insertNotificationSql = `
              INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid) 
              VALUES (?, ?, NOW(), 0, ?, ?, ?)
            `;
            
            const notificationTitle = "มีความคิดเห็นใหม่ในรีวิวของคุณ";
            const notificationContent = "มีคนแสดงความคิดเห็นในรีวิวของคุณ";
            const refType = "review"; // เพิ่ม: บอกว่าเป็นรีวิว
            const refId = reviewID;   // เพิ่ม: ID ของรีวิว

            connection.query(
              insertNotificationSql,
              [notificationTitle, notificationContent, refType, refId, reviewOwnerUid],
              (err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ status: false, message: "ไม่สามารถส่งการแจ้งเตือนได้" });
                  });
                }

                // Commit transaction
                connection.commit((err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ status: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
                    });
                  }

                  connection.release(); // คืน connection กลับไปที่ pool
                  res.status(201).json({
                    status: true,
                    message: "แสดงความคิดเห็นสำเร็จ!",
                    commentId: commentId,
                    type: type
                  });
                });
              }
            );
          } else {
            // ถ้าเป็นเจ้าของเอง ไม่ต้องส่งแจ้งเตือน
            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ status: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
                });
              }

              connection.release(); // คืน connection กลับไปที่ pool
              res.status(201).json({
                status: true,
                message: "แสดงความคิดเห็นสำเร็จ!",
                commentId: commentId,
                type: type
              });
            });
          }
        });
      });
    });
  });
});


//Create Replies (Review)
router.post("/comment/reply/review", (req: Request, res: Response): void => {
  const { uid, type, descriptions, reviewID, replies_to_id } = req.body;

  if (!uid || !type || !descriptions || !reviewID || !replies_to_id) {
    res.status(400).json({ status: false, message: "กรุณาเข้าสู่ระบบก่อน!" });
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

      // ดึงข้อมูลเจ้าของ comment ที่ถูก reply
      const getCommentOwnerSql = "SELECT uid FROM comments WHERE id = ?";
      
      connection.query(getCommentOwnerSql, [replies_to_id], (err, commentResult: any) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
          });
        }

        if (!commentResult || commentResult.length === 0) {
          return connection.rollback(() => {
            connection.release();
            res.status(404).json({ status: false, message: "ไม่พบความคิดเห็นนี้!" });
          });
        }

        const commentOwnerUid = commentResult[0].uid;

        // สร้าง reply
        const insertReplySql = "INSERT INTO comments (uid, type, descriptions, ref_id, replies_to_id) VALUES (?, ?, ?, ?, ?)";
        
        connection.query(insertReplySql, [uid, type, descriptions, reviewID, replies_to_id], (err, replyResult: any) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
            });
          }

          const replyId = replyResult.insertId;

          // สร้างแจ้งเตือนถ้าไม่ใช่เจ้าของ comment
          if (uid !== commentOwnerUid) {
            const insertNotificationSql = `
              INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid) 
              VALUES (?, ?, NOW(), 0, ?, ?, ?)
            `;
            
            const notificationTitle = "มีการตอบกลับความคิดเห็นของคุณ";
            const notificationContent = "มีคนตอบกลับความคิดเห็นของคุณ";
            const refType = "review"; // ยังคงชี้ไปที่ review
            const refId = reviewID;   // ID ของ review

            connection.query(
              insertNotificationSql,
              [notificationTitle, notificationContent, refType, refId, commentOwnerUid],
              (err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ status: false, message: "ไม่สามารถส่งการแจ้งเตือนได้" });
                  });
                }

                // Commit transaction
                connection.commit((err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ status: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
                    });
                  }

                  connection.release();
                  res.status(201).json({
                    status: true,
                    message: "ตอบกลับสำเร็จ!",
                    replyId: replyId,
                    type: type
                  });
                });
              }
            );
          } else {
            // ถ้าตอบกลับตัวเอง ไม่ต้องส่งแจ้งเตือน
            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ status: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
                });
              }

              connection.release();
              res.status(201).json({
                status: true,
                message: "ตอบกลับสำเร็จ!",
                replyId: replyId,
                type: type
              });
            });
          }
        });
      });
    });
  });
});


//Create comments (Question)
router.post("/comment/question", (req: Request, res: Response): void => {
  const { uid, type, descriptions, questionID } = req.body;

  if (!uid || !type || !descriptions || !questionID) {
    res.status(400).json({ status: false, message: "กรุณาเข้าสู่ระบบก่อน!" });
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
        connection.release(); // คืน connection กลับไปที่ pool
        res.status(500).json({ status: false, message: "ไม่สามารถเริ่ม transaction ได้" });
        return;
      }

      // ดึงข้อมูลเจ้าของ review
      const getReviewOwnerSql = "SELECT uid FROM question WHERE id = ?";
      
      connection.query(getReviewOwnerSql, [questionID], (err, reviewResult: any) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
          });
        }

        if (!reviewResult || reviewResult.length === 0) {
          return connection.rollback(() => {
            connection.release();
            res.status(404).json({ status: false, message: "ไม่พบรีวิวนี้!" });
          });
        }

        const reviewOwnerUid = reviewResult[0].uid;

        // สร้าง comment
        const insertCommentSql = "INSERT INTO comments (uid, type, descriptions, ref_id, replies_to_id) VALUES (?, ?, ?, ?, NULL)";
        
        connection.query(insertCommentSql, [uid, type, descriptions, questionID], (err, commentResult: any) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
            });
          }

          const commentId = commentResult.insertId;

          // สร้างแจ้งเตือนถ้าไม่ใช่เจ้าของโพสต์
          if (uid !== reviewOwnerUid) {
            const insertNotificationSql = `
              INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid) 
              VALUES (?, ?, NOW(), 0, ?, ?, ?)
            `;
            
            const notificationTitle = "มีความคิดเห็นใหม่ในคำถามของคุณ";
            const notificationContent = "มีคนแสดงความคิดเห็นในคำถามของคุณ";
            const refType = "question"; // เพิ่ม: บอกว่าเป็นคำถาม
            const refId = questionID;   // เพิ่ม: ID ของคำถาม

            connection.query(
              insertNotificationSql,
              [notificationTitle, notificationContent, refType, refId, reviewOwnerUid],
              (err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ status: false, message: "ไม่สามารถส่งการแจ้งเตือนได้" });
                  });
                }

                // Commit transaction
                connection.commit((err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ status: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
                    });
                  }

                  connection.release(); // คืน connection กลับไปที่ pool
                  res.status(201).json({
                    status: true,
                    message: "แสดงความคิดเห็นสำเร็จ!",
                    commentId: commentId,
                    type: type
                  });
                });
              }
            );
          } else {
            // ถ้าเป็นเจ้าของเอง ไม่ต้องส่งแจ้งเตือน
            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ status: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
                });
              }

              connection.release(); // คืน connection กลับไปที่ pool
              res.status(201).json({
                status: true,
                message: "แสดงความคิดเห็นสำเร็จ!",
                commentId: commentId,
                type: type
              });
            });
          }
        });
      });
    });
  });
});



//Create Replies (question)
router.post("/comment/reply/question", (req: Request, res: Response): void => {
  const { uid, type, descriptions, questionID, replies_to_id } = req.body;

  if (!uid || !type || !descriptions || !questionID || !replies_to_id) {
    res.status(400).json({ status: false, message: "กรุณาเข้าสู่ระบบก่อน!" });
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

      // ดึงข้อมูลเจ้าของ comment ที่ถูก reply
      const getCommentOwnerSql = "SELECT uid FROM comments WHERE id = ?";
      
      connection.query(getCommentOwnerSql, [replies_to_id], (err, commentResult: any) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
          });
        }

        if (!commentResult || commentResult.length === 0) {
          return connection.rollback(() => {
            connection.release();
            res.status(404).json({ status: false, message: "ไม่พบความคิดเห็นนี้!" });
          });
        }

        const commentOwnerUid = commentResult[0].uid;

        // สร้าง reply
        const insertReplySql = "INSERT INTO comments (uid, type, descriptions, ref_id, replies_to_id) VALUES (?, ?, ?, ?, ?)";
        
        connection.query(insertReplySql, [uid, type, descriptions, questionID, replies_to_id], (err, replyResult: any) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
            });
          }

          const replyId = replyResult.insertId;

          // สร้างแจ้งเตือนถ้าไม่ใช่เจ้าของ comment
          if (uid !== commentOwnerUid) {
            const insertNotificationSql = `
              INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid) 
              VALUES (?, ?, NOW(), 0, ?, ?, ?)
            `;
            
            const notificationTitle = "มีการตอบกลับความคิดเห็นของคุณ";
            const notificationContent = "มีคนตอบกลับความคิดเห็นของคุณ";
            const refType = "question"; 
            const refId = questionID;  

            connection.query(
              insertNotificationSql,
              [notificationTitle, notificationContent, refType, refId, commentOwnerUid],
              (err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ status: false, message: "ไม่สามารถส่งการแจ้งเตือนได้" });
                  });
                }

                // Commit transaction
                connection.commit((err) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ status: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
                    });
                  }

                  connection.release();
                  res.status(201).json({
                    status: true,
                    message: "ตอบกลับสำเร็จ!",
                    replyId: replyId,
                    type: type
                  });
                });
              }
            );
          } else {
            // ถ้าตอบกลับตัวเอง ไม่ต้องส่งแจ้งเตือน
            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ status: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
                });
              }

              connection.release();
              res.status(201).json({
                status: true,
                message: "ตอบกลับสำเร็จ!",
                replyId: replyId,
                type: type
              });
            });
          }
        });
      });
    });
  });
});