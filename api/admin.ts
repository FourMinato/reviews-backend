import express from "express";
import { conn } from "../db";

export const router = express.Router();





// Admin get users
router.get('/get-users', (_req, res) => {

  conn.query(`SELECT uid, name, email, profile, type
                FROM users
              `, (err: any, result: any[]) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
      return;
    }
    if (!result.length) {
      res.status(404).json({ status: false, message: "ไม่พบผู้ใช้" });
      return;
    }
    res.json({ status: true, data: result });
  });
});

router.get('/search-users', (req, res) => {
  const keyword = `%${req.query.name || ''}%`;

  conn.query(
    `SELECT uid, name, email, profile, type
     FROM users
     WHERE name LIKE ?`,
    [keyword],
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

router.get('/get-user/:uid', (req, res) => {
  const uid = req.params.uid;

  conn.query(
    `SELECT uid, name, email, profile, type
     FROM users
     WHERE uid = ?`,
    [uid],
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      if (!result.length) {
        res.status(404).json({ status: false, message: "ไม่พบผู้ใช้" });
        return;
      }
      res.json({ status: true, data: result[0] }); // [0] เพราะได้แค่คนเดียว
    }
  );
});


router.put('/update-role/:uid', (req, res) => {
  const uid = req.params.uid;
  const type = req.body.role === 'Admin' ? 0 : 1; // แปลง role → type

  conn.query(
    `UPDATE users SET type = ? WHERE uid = ?`,
    [type, uid],
    (err: any) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      res.json({ status: true, message: "อัปเดต role สำเร็จ" });
    }
  );
});

router.delete('/delete-user/:uid', (req, res) => {
  const uid = req.params.uid;

  conn.query(
    `DELETE FROM users WHERE uid = ?`,
    [uid],
    (err: any) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      res.json({ status: true, message: "ลบผู้ใช้สำเร็จ" });
    }
  );
});


router.get('/get-report-review', (_req, res) => {
  conn.query(
    `SELECT 
      rr.uid, 
      rr.pid, 
      rr.date,
      reporter.name AS reporter_name
     FROM report_review rr
     JOIN users reporter ON rr.uid = reporter.uid
     ORDER BY rr.date DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      if (!result.length) {
        res.status(404).json({ status: false, message: "ไม่พบรายงาน" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

router.get('/get-report-question', (_req, res) => {
  conn.query(
    `SELECT 
      rq.uid, 
      rq.pid, 
      rq.date,
      reporter.name AS reporter_name
     FROM report_question rq
     JOIN users reporter ON rq.uid = reporter.uid
     ORDER BY rq.date DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      if (!result.length) {
        res.status(404).json({ status: false, message: "ไม่พบรายงาน" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

router.get('/get-report-comments', (_req, res) => {
  conn.query(
    `SELECT 
  rc.uid, 
  rc.cid, 
  rc.date,
  reporter.name AS reporter_name,
  c.type,
  c.ref_id
 FROM report_comment rc
 JOIN users reporter ON rc.uid = reporter.uid
 JOIN comments c ON rc.cid = c.id
 ORDER BY rc.date DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      if (!result.length) {
        res.status(404).json({ status: false, message: "ไม่พบรายงาน" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

router.get('/get-questions', (_req, res) => {
  conn.query(
    `SELECT 
      q.id,
      q.uid,
      q.descriptions,
      q.open,
      u.name,
      u.profile,
      q.date
     FROM question q
     JOIN users u ON q.uid = u.uid
     WHERE q.open = 0
     ORDER BY q.id DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      if (!result.length) {
        res.status(404).json({ status: false, message: "ไม่พบคำถาม" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});


router.put('/open-question/:id', (req, res) => {
  const id = req.params.id;

  conn.query(
    `UPDATE question SET open = 1 WHERE id = ?`,
    [id],
    (err: any) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }

      // ลบ report ทั้งหมดของ question นี้
      conn.query(
        `DELETE FROM report_question WHERE pid = ?`,
        [id],
        (err: any) => {
          if (err) {
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
            return;
          }
          res.json({ status: true, message: "เปิดการมองเห็นและรีเซ็ตรายงานสำเร็จ" });
        }
      );
    }
  );
});


router.get('/get-review', (_req, res) => {
  conn.query(
    `SELECT 
      r.pid,
      r.uid,
      r.descriptions,
      r.showpost,
      u.name,
      u.profile,
      r.date
     FROM review r
     JOIN users u ON r.uid = u.uid
     WHERE r.showpost = 0
     ORDER BY r.pid DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      if (!result.length) {
        res.status(404).json({ status: false, message: "ไม่พบคำถาม" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

router.put('/open-review/:id', (req, res) => {
  const id = req.params.id;

  conn.query(
    `UPDATE review SET showpost = 1 WHERE pid = ?`,
    [id],
    (err: any) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }

      // ลบ report ทั้งหมดของ question นี้
      conn.query(
        `DELETE FROM report_review WHERE pid = ?`,
        [id],
        (err: any) => {
          if (err) {
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
            return;
          }
          res.json({ status: true, message: "เปิดการมองเห็นและรีเซ็ตรายงานสำเร็จ" });
        }
      );
    }
  );
});