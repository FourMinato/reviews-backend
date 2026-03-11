import express from "express";
import { conn } from "../db";
import path, { dirname } from "path";
import fs from "fs";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
export const router = express.Router();


class FileMiddleWare {
  filename = "";
  constructor() {
    const uploadsDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }
  public readonly diskLoader = multer({
    storage: multer.diskStorage({
      destination: (_req, __file, cb) => {
        cb(null, path.join(__dirname, "../uploads"));
      },

      filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4();
        this.filename = uniqueSuffix + "." +
          file.originalname.split(".").pop();
        cb(null, this.filename);
      },
    }),
    limits: {
      fileSize: 67108864,
    },
  });
}

const fileUpload = new FileMiddleWare();

router.post("/", fileUpload.diskLoader.single("file"), (req, res) => {
  res.json({ filename: fileUpload.filename })
})

router.get("/:filename", (req, res) => {
  const filename = req.params.filename;
  res.sendFile(path.join(__dirname, "../uploads", filename));
});