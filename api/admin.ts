import express, { Request, Response } from "express";
import { conn } from "../db";

export const router = express.Router();

// 1. Get Reported Reviews (Aggregated)
router.get('/get-report-review', (_req: Request, res: Response) => {
  conn.query(
    `SELECT 
      rv.pid,
      rv.showpost,
      rv.descriptions AS review_descriptions,
      u_owner.name AS reported_name,
      u_owner.profile AS reported_profile,
      COUNT(rr.pid) AS report_count,
      MAX(rr.date) AS last_report_date,
      (SELECT name FROM users WHERE uid = (SELECT uid FROM report_review WHERE pid = rv.pid ORDER BY date DESC LIMIT 1)) AS last_reporter_name,
      (SELECT profile FROM users WHERE uid = (SELECT uid FROM report_review WHERE pid = rv.pid ORDER BY date DESC LIMIT 1)) AS last_reporter_profile
     FROM review rv
     JOIN report_review rr ON rv.pid = rr.pid
     JOIN users u_owner ON rv.uid = u_owner.uid
     GROUP BY rv.pid
     ORDER BY report_count DESC, last_report_date DESC`,
    (err: any, result: any[]) => {
      if (err) {
        console.error("SQL Error (Review Reports):", err);
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

// 2. Get Reported Questions (Aggregated)
router.get('/get-report-question', (_req: Request, res: Response) => {
  conn.query(
    `SELECT 
      q.id AS pid,
      q.open,
      q.descriptions AS question_descriptions,
      u_owner.name AS reported_name,
      u_owner.profile AS reported_profile,
      COUNT(rq.pid) AS report_count,
      MAX(rq.date) AS last_report_date,
      (SELECT name FROM users WHERE uid = (SELECT uid FROM report_question WHERE pid = q.id ORDER BY date DESC LIMIT 1)) AS last_reporter_name,
      (SELECT profile FROM users WHERE uid = (SELECT uid FROM report_question WHERE pid = q.id ORDER BY date DESC LIMIT 1)) AS last_reporter_profile
     FROM question q
     JOIN report_question rq ON q.id = rq.pid
     JOIN users u_owner ON q.uid = u_owner.uid
     GROUP BY q.id
     ORDER BY report_count DESC, last_report_date DESC`,
    (err: any, result: any[]) => {
      if (err) {
        console.error("SQL Error (Question Reports):", err);
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

// 3. Get Reported Comments (Aggregated)
router.get('/get-report-comments', (_req: Request, res: Response) => {
  conn.query(
    `SELECT 
      c.id AS cid,
      c.descriptions AS comment_descriptions,
      c.type AS post_type,
      c.ref_id AS post_id,
      u_owner.name AS reported_name,
      u_owner.profile AS reported_profile,
      COUNT(rc.cid) AS report_count,
      MAX(rc.date) AS last_report_date,
      (SELECT name FROM users WHERE uid = (SELECT uid FROM report_comment WHERE cid = c.id ORDER BY date DESC LIMIT 1)) AS last_reporter_name,
      (SELECT profile FROM users WHERE uid = (SELECT uid FROM report_comment WHERE cid = c.id ORDER BY date DESC LIMIT 1)) AS last_reporter_profile,
      CASE 
        WHEN c.type = 'review' THEN (SELECT descriptions FROM review WHERE pid = c.ref_id)
        WHEN c.type = 'question' THEN (SELECT descriptions FROM question WHERE id = c.ref_id)
      END as post_description,
      CASE
        WHEN c.type = 'review' THEN (SELECT sid FROM review WHERE pid = c.ref_id)
      END as subject_code
     FROM comments c
     JOIN report_comment rc ON c.id = rc.cid
     JOIN users u_owner ON c.uid = u_owner.uid
     GROUP BY c.id
     ORDER BY report_count DESC, last_report_date DESC`,
    (err: any, result: any[]) => {
      if (err) {
        console.error("SQL Error (Comment Reports):", err);
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

// 4. Unified endpoint for fetching detailed reporter lists
router.get('/get-reporters/:type/:id', (req: Request, res: Response) => {
  const { type, id } = req.params;
  let table = '';
  let idField = '';

  if (type === 'review') {
    table = 'report_review';
    idField = 'pid';
  } else if (type === 'question') {
    table = 'report_question';
    idField = 'pid';
  } else if (type === 'comment') {
    table = 'report_comment';
    idField = 'cid';
  } else {
    res.status(400).json({ status: false, message: "ประเภทไม่ถูกต้อง" });
    return;
  }

  conn.query(
    `SELECT 
      u.name, 
      u.profile, 
      u.uid,
      r.date 
     FROM ${table} r
     JOIN users u ON r.uid = u.uid
     WHERE r.${idField} = ?
     ORDER BY r.date DESC`,
    [id],
    (err: any, result: any[]) => {
      if (err) {
        console.error("SQL Error (Reporters Detail):", err);
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

// --- User Management APIs ---

router.get('/get-user/:uid', (req: Request, res: Response) => {
  const uid = req.params.uid;
  conn.query(
    `SELECT uid, name, email, profile, type FROM users WHERE uid = ?`,
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
      res.json({ status: true, data: result[0] });
    }
  );
});

router.put('/update-role/:uid', (req: Request, res: Response) => {
  const uid = req.params.uid;
  let type = 0;
  if (req.body.role === 'Admin') type = 1;
  else if (req.body.role === 'Suspended') type = 2;
  else type = 0;
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

router.get('/get-users', (_req: Request, res: Response) => {
  conn.query(`SELECT uid, name, email, profile, type FROM users`, (err: any, result: any[]) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
      return;
    }
    res.json({ status: true, data: result });
  });
});

router.delete('/delete-user/:uid', (req: Request, res: Response) => {
  const uid = req.params.uid;
  if (!uid) {
    res.status(400).json({ status: false, message: "กรุณาระบุ uid!" });
    return;
  }
  
  // ป้องกันไม่ให้ลบ Admin
  conn.query(`SELECT type FROM users WHERE uid = ?`, [uid], (err: any, result: any[]) => {
    if (err || !result.length) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด หรือไม่พบผู้ใช้" });
      return;
    }
    
    if (result[0].type === 1) {
      res.json({ status: false, message: "ไม่สามารถลบบัญชีผู้ดูแลระบบได้" });
      return;
    }

    // Soft delete: set type = 2
    conn.query(`UPDATE users SET type = 2 WHERE uid = ?`, [uid], (err: any) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      res.json({ status: true, message: "ลบผู้ใช้สำเร็จ" });
    });
  });
});

router.patch('/toggle-suspend-user/:uid', (req: Request, res: Response) => {
  const uid = req.params.uid;
  const { type } = req.body;
  if (![0, 2].includes(type)) {
    res.status(400).json({ status: false, message: "ค่า type ไม่ถูกต้อง" });
    return;
  }

  conn.query(`SELECT type FROM users WHERE uid = ?`, [uid], (err: any, result: any) => {
    if (err || !result.length) {
      res.status(500).json({ status: false, message: "ไม่พบผู้ใช้" });
      return;
    }
    if (result[0].type === 1) {
      res.json({ status: false, message: "ไม่สามารถระงับบัญชี Admin ได้" });
      return;
    }

    conn.query(`UPDATE users SET type = ? WHERE uid = ?`, [type, uid], (err: any) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
        return;
      }
      
      const msg = type === 2 ? 'ระงับบัญชีสำเร็จ' : 'เปิดใช้งานบัญชีสำเร็จ';
      if (type === 2 || type === 0) {
        const title = type === 2 ? "บัญชีของคุณถูกระงับการใช้งาน" : "บัญชีของคุณได้รับการเปิดใช้งานแล้ว";
        const content = type === 2 ? "บัญชีของคุณถูกระงับหรือลบเนื่องจากพบพฤติกรรมที่ไม่เหมาะสม" : "บัญชีของคุณได้รับการเปิดใช้งานอีกครั้งโดยผู้ดูแลระบบ";

        conn.query(
          `INSERT INTO message (title, content, date, is_read, uid) VALUES (?, ?, NOW(), 0, ?)`,
          [title, content, uid],
          (err) => { if (err) console.error("Notification Error:", err); }
        );
      }
      res.json({ status: true, message: msg });
    });
  });
});

// --- Content Visibility Management ---

router.get('/get-questions-hidden', (_req: Request, res: Response) => {
  conn.query(
    `SELECT q.id, q.uid, q.descriptions, q.open, u.name, u.profile, q.date, COUNT(rq.uid) AS report_count
     FROM question q
     JOIN users u ON q.uid = u.uid
     LEFT JOIN report_question rq ON q.id = rq.pid
     WHERE q.open = 0
     GROUP BY q.id
     ORDER BY report_count DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "Error" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

router.get('/get-review-hidden', (_req: Request, res: Response) => {
  conn.query(
    `SELECT r.pid, r.uid, r.descriptions, r.showpost, u.name, u.profile, r.date, COUNT(rr.uid) AS report_count
     FROM review r
     JOIN users u ON r.uid = u.uid
     LEFT JOIN report_review rr ON r.pid = rr.pid
     WHERE r.showpost = 0
     GROUP BY r.pid
     ORDER BY report_count DESC`,
    (err: any, result: any[]) => {
      if (err) {
        res.status(500).json({ status: false, message: "Error" });
        return;
      }
      res.json({ status: true, data: result });
    }
  );
});

router.put('/open-question/:id', (req, res) => {
  const id = req.params.id;
  conn.query(`UPDATE question SET open = 1 WHERE id = ?`, [id], (err: any) => {
    if (err) return res.status(500).json({ status: false, message: "Error" });
    conn.query(`DELETE FROM report_question WHERE pid = ?`, [id], () => {
      res.json({ status: true, message: "เปิดการมองเห็นสำเร็จ" });
    });
  });
});

router.put('/open-review/:id', (req, res) => {
  const id = req.params.id;
  conn.query(`UPDATE review SET showpost = 1 WHERE pid = ?`, [id], (err: any) => {
    if (err) return res.status(500).json({ status: false, message: "Error" });
    conn.query(`DELETE FROM report_review WHERE pid = ?`, [id], () => {
      res.json({ status: true, message: "เปิดการมองเห็นสำเร็จ" });
    });
  });
});
