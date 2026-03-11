import express from "express";
import { conn } from "../db";
import { Request, Response } from 'express';
export const router = express.Router();

router.get("/review/:type/:refId", (req: Request, res: Response): void => {
  const { type, refId } = req.params;
  if (!type || !refId) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบ" });
    return;
  }

  // ✅ ดึงข้อมูลโพสต์หลักก่อน เพื่อเช็ค is_anonymous และ uid ของเจ้าของโพสต์
  const getMainPost = `
    SELECT uid, is_anonymous 
    FROM review
    WHERE pid = ?
  `;

  conn.query(getMainPost, [refId], (err, mainPost: any[]) => {
    if (err) {
      console.error(err);
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }

    if (mainPost.length === 0) {
      res.status(404).json({ status: false, message: "ไม่พบโพสต์" });
      return;
    }

    const postOwnerUid = mainPost[0].uid;
    const isPostAnonymous = mainPost[0].is_anonymous === 1 || mainPost[0].is_anonymous === true;

    // ดึงคอมเมนต์ทั้งหมด
    const getAllComments = `
      SELECT 
        comments.id,
        comments.descriptions as content,
        comments.replies_to_id,
        comments.uid,
        users.name as username,
        users.profile as avatarUrl
      FROM comments
      LEFT JOIN users ON users.uid = comments.uid
      WHERE comments.ref_id = ? 
        AND comments.type = ?
      ORDER BY comments.id ASC
    `;

    conn.query(getAllComments, [refId, type], (err, allComments: any[]) => {
      if (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }

      if (allComments.length === 0) {
        res.status(200).json({ status: true, data: [] });
        return;
      }

      // ✅ ฟังก์ชัน Recursive พร้อม logic การซ่อนตัวตน
      const buildCommentTree = (parentId: number | null = null): any[] => {
        return allComments
          .filter((comment: any) => comment.replies_to_id === parentId)
          .map((comment: any) => {
            // ✅ เช็คว่าเป็นเจ้าของโพสต์หรือไม่
            const isPostOwner = comment.uid === postOwnerUid;
            
            // ✅ ถ้าโพสต์เป็น anonymous และคอมเมนต์นี้เป็นของเจ้าของโพสต์
            const shouldHideIdentity = isPostAnonymous && isPostOwner;

            return {
              id: comment.id,
              uid: comment.uid, // เก็บไว้ใช้ในการเช็คสิทธิ์ลบ/แก้ไข
              username: shouldHideIdentity ? 'เจ้าของโพสต์' : comment.username,
              avatarUrl: shouldHideIdentity ? 'a25d9385-c882-4b3d-aa5b-508eabcd5987.png' : comment.avatarUrl,
              content: comment.content,
              isPostOwner: isPostOwner, // ✅ ส่งไปให้ Frontend รู้ว่าเป็นเจ้าของโพสต์
              isAnonymous: shouldHideIdentity, // ✅ flag บอกว่าแสดงแบบ anonymous
              showReplies: false,
              isReportable: !isPostOwner, // เจ้าของโพสต์รีพอร์ตตัวเองไม่ได้
              replies: buildCommentTree(comment.id)
            };
          });
      };

      const result = buildCommentTree(null);

      res.status(200).json({
        status: true,
        data: result
      });
    });
  });
});


router.get("/question/:refId", (req: Request, res: Response): void => {
  const { refId } = req.params;
  if (!refId) {
    res.status(400).json({ status: false, message: "ข้อมูลไม่ครบ" });
    return;
  }

  const getAllComments = `
    SELECT 
      comments.id,
      comments.descriptions as content,
      comments.replies_to_id,
      comments.uid,
      users.name as username,
      users.profile as avatarUrl
    FROM comments
    LEFT JOIN users ON users.uid = comments.uid
    WHERE comments.ref_id = ? 
      AND comments.type = 'question'
    ORDER BY comments.id ASC
  `;

  conn.query(getAllComments, [refId], (err, allComments: any[]) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }

    if (allComments.length === 0) {
      res.status(200).json({ status: true, data: [] });
      return;
    }

    const buildCommentTree = (parentId: number | null = null): any[] => {
      return allComments
        .filter((comment: any) => comment.replies_to_id === parentId)
        .map((comment: any) => ({
          id: comment.id,
          uid: comment.uid,
          username: comment.username,
          avatarUrl: comment.avatarUrl,
          content: comment.content,
          isAnonymous: false,
          showReplies: false,
          isReportable: true,
          replies: buildCommentTree(comment.id)
        }));
    };

    res.status(200).json({ status: true, data: buildCommentTree(null) });
  });
});