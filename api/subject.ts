import express from "express";
import { conn } from "../db"; 
import mysql from "mysql2";
import { Router, Request, Response } from 'express';

export const router = express.Router();

// router.get("/allsubject", (req, res) => {

//     conn.query('select * from subject', (err, result, fields)=>{
//             res.json(result);
//           });
//   });


//   router.get("/sub/:subcode", (req, res) => {
//   const subcode = req.params.subcode; // ดึงค่าจาก URL

//   const sql = "SELECT * FROM subject WHERE subcode = ?";
//   conn.query(sql, [subcode], (err, result) => {
//     if (err) {
//       console.error("Database error:", err);
//       return res.status(500).json({ error: "Database query error" });
//     }
//     res.json(result);
//   });
// });
//   router.get("/sub/:subid", (req, res) => {
//     let id = +req.params.subid;
//     conn.query("select name, subcode from subject where subid = ?" , [id], (err, result, fields) => {
//     if (err) throw err;
//       res.json(result);
//     });
//   });


//   router.get("/categorysubject", (req, res) => {
//     conn.query('select * from subject where', (err, result, fields)=>{
//             res.json(result);
//           });
//   });

// router.post("/selectbycate", (req: Request, res: Response): void => {
//   const { cateids, orderby } = req.body;

//   if (!Array.isArray(cateids) || cateids.length === 0) {
//     res.status(400).json({ message: "cateids ต้องเป็น array" });
//     return;
//   }

//   // whitelist field
//   const orderByMap: Record<string, string> = {
//     subcode: 'subcode',
//     rev_amount: 'rev_amount',
//     rate: 'rate'
//   };

//   const orderByField = orderByMap[orderby as keyof typeof orderByMap] || 'subcode';

//   // ✅ กำหนด direction ตาม field
//   let direction = 'ASC'; 
//   if (orderby === 'rev_amount' || orderby === 'rate') {
//     direction = 'DESC';
//   }

//   const sql = `SELECT * FROM subject WHERE cateid IN (?) ORDER BY ${orderByField} ${direction}`;
//   console.log("Final SQL:", sql);

//   conn.query(sql, [cateids], (err, result) => {
//     if (err) {
//       console.error(err);
//       res.status(500).json({ message: "Database error" });
//       return;
//     }
//     res.json(result);
//   });
// });





// router.get("/allcategory", (req, res) => {
//         conn.query('SELECT * FROM category ORDER BY all_review DESC', (err, result, fields)=>{
//                 res.json(result);
//               });
//       });

// router.get("/popularsub", (req, res) => {
//                 conn.query('SELECT * FROM subject ORDER BY review_amount DESC', (err, result, fields)=>{
//                         res.json(result);
//                 });
//         });
        
// router.get("/searchorder", (req, res) => {
//                 conn.query('SELECT * FROM `subject` WHERE search_amount > 0 ORDER by search_amount DESC', (err, result, fields)=>{
//                         res.json(result);
//                 });
// });
        




//     router.get("/revp/:subid", (req, res) => {
//       let subid = +req.params.subid;
//       conn.query("SELECT users.profile, users.name, reviewPost.date, reviewPost.description, reviewPost.rate, reviewPost.like_amount FROM reviewPost, users, subject WHERE reviewPost.user_id = users.uid and subject.subid = ?" , [subid], (err, result, fields) => {
//       if (err) throw err;
//         res.json(result);
//       });
//     });

//     router.get("/detailsub/:subid", (req, res) => {
//         let subid = +req.params.subid;
//         conn.query("select subjectid, name from subject where subid = ?" , [subid], (err, result, fields) => {
//         if (err) throw err;
//           res.json(result);
//         });
//       });

// Insert Subjects.

//
router.post("/create/subject", (req: Request, res: Response): void => {
  const { cateID, subcode, name } = req.body;

  if (!cateID || !subcode || !name) {
    res.status(400).json({ status: false, message: "กรุณาใส่ข้อมูลรายวิชาให้ครบถ้วน" });
    return;
  }
  if (subcode.length > 7) {
    res.status(400).json({ status: false, message: "รหัสวิชาต้องไม่เกิน 7 ตัวอักษร" });
    return;
  }
  const checkReported = "SELECT * FROM subject WHERE subcode = ?";
  conn.query(checkReported, [subcode], (err, result) => {
    if (err) {
      res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
      return;
    }
    if (result.length > 0) {
      res.status(200).json({ status: false, message: "มีรายวิชานี้ในระบบแล้ว!" });
      return;
    }

    const insertSubject = "INSERT INTO subject (cateid, subcode, name, open) VALUES (?, ?, ?, 1)";
    conn.query(insertSubject, [cateID, subcode, name], (err, result) => {
      if (err) {
        res.status(500).json({ status: false, message: "เกิดข้อผิดพลาด!" });
        return;
      }
      res.status(201).json({
        status: true,
        message: "เพิ่มรายวิชาสำเร็จ!",
        subject: result.insertId,
      });
    });
  });
});

router.get('/data/:subcode', (req, res) => {
    const { subcode } = req.params;
    if (!subcode) {
        res.status(400).json({ status: false, message: "กรุณากรอกรหัสรายวิชา!" });
        return;
    }

    conn.query(`SELECT subid, subcode, name
                FROM subject
                WHERE subid=?
              `, [subcode], (err, result: any[]) => {
        if (err) {
            res.status(500).json({ status: false, message: "เกิดข้อผิดพลาดในระบบ" });
            return;
        }
        if (!result.length) {
            res.status(404).json({ status: false, message: "ไม่พบรายวิชา" });
            return;
        }
        res.json({ status: true, result });
    });
});


router.put("/update/subject/:subid", (req: Request, res: Response): void => {
  const { subid } = req.params;
  const { category, subcode, subname, open } = req.body;

 
  // ดึงข้อมูลเดิมก่อน
  const selectSql = `SELECT * FROM subject WHERE subid = ?`;

  conn.query(selectSql, [subid], (err, result: any[]) => {
    if (err) {
      res.status(500).json({ status: false, message: "Database error" });
      return;
    }

    if (result.length === 0) {
      res.status(404).json({ status: false, message: "ไม่พบข้อมูล" });
      return;
    }

    const existing = result[0];

const toString = (val: any) => (val !== undefined && val !== null ? String(val).trim() : "");

const updatedCategory = toString(category) || existing.cateid;
const updatedSubcode  = toString(subcode)  || existing.subcode;
const updatedSubname  = toString(subname)  || existing.name;
const updatedOpen = (open !== undefined && open !== null) ? open : existing.open;

    const updateSql = `UPDATE subject 
                       SET cateid = ?, subcode = ?, name = ?, open = ?
                       WHERE subid = ?`;

    conn.query(updateSql, [updatedCategory, updatedSubcode, updatedSubname, updatedOpen, subid], (err) => {
      if (err) {
        console.error("Update error:", err);
        res.status(500).json({ status: false, message: "Database error" });
        return;
      }
      res.json({ status: true, message: "อัปเดตสำเร็จ" });
    });
  });
});