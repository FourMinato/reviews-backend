import express from "express";
import { conn } from "../db";

export const router = express.Router();

router.get('/get-report-review', (_req, res) => {
  conn.query(
    `SELECT 
      rr.pid,
      rr.date,
      reporter.name AS reporter_name,
      reporter.profile AS reporter_profile,
      reported.name AS reported_name,
      rv.descriptions AS review_descriptions,
      COUNT(rr.pid) AS report_count
     FROM report_review rr
     JOIN users reporter ON rr.uid = reporter.uid
     JOIN review rv ON rr.pid = rv.pid
     JOIN users reported ON rv.uid = reported.uid
     GROUP BY rr.pid, rr.date, reporter.name, reporter.profile, reported.name, rv.descriptions
     ORDER BY report_count DESC, rr.date DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
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
      reporter.name AS reporter_name,
      reporter.profile AS reporter_profile,
      reported.name AS reported_name,
      q.descriptions AS question_descriptions
     FROM report_question rq
     JOIN users reporter ON rq.uid = reporter.uid
     JOIN question q ON rq.pid = q.id
     JOIN users reported ON q.uid = reported.uid
     ORDER BY rq.date DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
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
      reporter.profile AS reporter_profile,
      reported.name AS reported_name,
      c.type,
      c.ref_id,
      c.descriptions AS comment_descriptions
     FROM report_comment rc
     JOIN users reporter ON rc.uid = reporter.uid
     JOIN comments c ON rc.cid = c.id
     JOIN users reported ON c.uid = reported.uid
     ORDER BY rc.date DESC`,
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

router.delete('/delete-user/:uid', (req, res) => {
  const uid = req.params.uid;
  if (!uid) {
    res.status(400).json({ status: false, message: "กรุณาระบุ uid ของผู้ใช้!" });
    return;
  }

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

router.patch('/toggle-suspend-user/:uid', (req, res) => {
  const uid = req.params.uid;
  const { type } = req.body;

  if (![1, 2].includes(type)) {
    res.status(400).json({ status: false, message: "ค่า type ไม่ถูกต้อง" });
    return;
  }

  conn.query(`SELECT type FROM users WHERE uid = ?`, [uid], (err: any, result: any) => {
    if (err || !result.length) {
      res.status(500).json({ status: false, message: "ไม่พบผู้ใช้" });
      return;
    }

    if (result[0].type === 0) {
      res.json({ status: false, message: "ไม่สามารถระงับบัญชีผู้ดูแลระบบได้" });
      return;
    }

    conn.query(`UPDATE users SET type = ? WHERE uid = ?`, [type, uid], (err: any) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }

      const msg = type === 2 ? 'ระงับบัญชีสำเร็จ' : 'เปิดใช้งานบัญชีสำเร็จ';

     if (type === 2 || type === 1) {
  const title = type === 2 ? "บัญชีของคุณถูกระงับการใช้งาน" : "บัญชีของคุณได้รับการเปิดใช้งานแล้ว";
  const content = type === 2 ? "บัญชีของคุณถูกระงับเนื่องจากพบพฤติกรรมที่ไม่เหมาะสม" : "บัญชีของคุณได้รับการเปิดใช้งานอีกครั้งโดยผู้ดูแลระบบ";

  const notificationSql = `
    INSERT INTO message (title, content, date, is_read, ref_type, ref_id, uid)
    VALUES (?, ?, NOW(), 0, NULL, NULL, ?)
  `;
  conn.query(
    notificationSql,
    [title, content, uid],
    (err) => {
      if (err) console.error("Failed to send notification:", err);
    }
  );
}

res.json({ status: true, message: msg });
    });
  });
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
      q.date,
      COUNT(rq.pid) AS report_count
     FROM question q
     JOIN users u ON q.uid = u.uid
     LEFT JOIN report_question rq ON q.id = rq.pid
     WHERE q.open = 0
     GROUP BY q.id, q.uid, q.descriptions, q.open, u.name, u.profile, q.date
     ORDER BY report_count DESC, q.id DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      res.json({ status: true, data: result });
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
      r.date,
      COUNT(rr.pid) AS report_count
     FROM review r
     JOIN users u ON r.uid = u.uid
     LEFT JOIN report_review rr ON r.pid = rr.pid
     WHERE r.showpost = 0
     GROUP BY r.pid, r.uid, r.descriptions, r.showpost, u.name, u.profile, r.date
     ORDER BY report_count DESC, r.pid DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
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
