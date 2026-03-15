import express from "express";
import bodyParser from "body-parser";
import dotenv from 'dotenv';
dotenv.config();
const cors = require("cors");

export const app = express();

app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get('/', (req, res) => {
    res.status(200).send("Server is awake!");
});


import { router as user } from "./api/user";
import { router as subject } from "./api/subject";
import { router as review } from "./api/review";
import { router as report } from "./api/reports";
import { router as update } from "./api/update";
import { router as google } from "./api/google";
import { router as admin } from "./api/admin";
import { router as favorite } from "./api/favorite";
import { router as images } from "./api/images";
import { router as create } from "./api/create";
import { router as detail } from "./api/detail";
import { router as close } from "./api/close";
import { router as deleteApi } from "./api/delete";
import { router as comment } from "./api/comment";
import { router as category } from "./api/category";
import { router as message } from "./api/message";
import { router as upload } from "./api/uploads";

app.use("/subject", subject);
app.use("/category", category);
app.use("/admin", admin);
app.use("/delete", deleteApi);
app.use("/create", create);
app.use("/review", review);
app.use("/update", update);
app.use("/favorite", favorite);
app.use("/user", user);
app.use("/google", google);
app.use("/message", message);
app.use("/images", images);
app.use("/report", report);
app.use("/detail", detail);
app.use("/comment", comment);
app.use("/close", close);
app.use("/upload", upload);