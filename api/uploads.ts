import express from 'express';
import multer from 'multer';
import path from 'path';
import { conn } from '../db';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

export const router = express.Router();

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const bucketName = process.env.SUPABASE_BUCKET || 'profiles';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// API route for profile image upload
router.post('/profile/:uid', upload.single('profileImage'), async (req: any, res: any) => {
  const uid = req.params.uid;

  if (!req.file) {
    return res.status(400).json({ status: false, message: 'ไม่มีไฟล์ถูกอัปโหลด' });
  }

  try {
    const file = req.file;
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;

    // Upload image to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error("Supabase Upload Error:", uploadError);
      return res.status(500).json({ status: false, message: 'เกิดข้อผิดพลาดในการอัปโหลดภาพ' });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // Update the DB. I will just update the profile column with fileName. Or the full URL.
    // Given the column type might be limited, it's safer to save the full URL if possible, or just the URL. 
    // We will save the public URL to profile so the frontend can display it directly.
    const sql = "UPDATE users SET profile = ? WHERE uid = ?";
    conn.query(sql, [publicUrl, uid], (err, result) => {
      if (err) {
        console.error("SQL Error:", err);
        return res.status(500).json({ status: false, message: 'เกิดข้อผิดพลาดที่ฐานข้อมูล' });
      }

      res.json({ status: true, message: 'อัปโหลดสำเร็จ', fileName: publicUrl });
    });

  } catch (error) {
    console.error("Upload process error:", error);
    res.status(500).json({ status: false, message: 'เกิดข้อผิดพลาดในการดำเนินงาน' });
  }
});
