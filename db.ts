import mysql from "mysql";

export const conn = mysql.createPool({
  connectionLimit: 10,
  connectTimeout: 10000,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});


