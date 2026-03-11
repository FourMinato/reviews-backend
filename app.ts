import express from "express";
import bodyParser from "body-parser";
import dotenv from 'dotenv';
dotenv.config();
const cors = require("cors");

export const app = express();


app.use(cors());


app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

import { router as user } from "./api/user";
import { router as subject } from "./api/subject";
import { router as review } from "./api/review";
import { router as report } from "./api/reports";
import { router as update } from "./api/update";
import { router as previus } from "./api/previus";
import { router as google } from "./api/google";
import { router as route } from "./api/routers";
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


app.use("/user", user);
app.use("/subject", subject);
app.use("/review", review);
app.use("/previus", previus);
app.use("/google", google);
app.use("/routes", route);
app.use("/admin", admin);


app.use("/images", images);
app.use("/create", create);
app.use("/detail", detail);
app.use("/favorite", favorite);
app.use("/update", update);
app.use("/report", report);
app.use("/close", close);
app.use("/delete", deleteApi);
app.use("/comment", comment);

app.use("/upload", upload);

app.use("/category", category);
app.use("/message", message);