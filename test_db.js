const mysql = require("mysql");

const db = mysql.createConnection({
  host: "mysqladmin.comsciproject.net",
  user: "u528477660_revrealm",
  password: "1Jp2Kf^r",
  database: "u528477660_revrealm"
});

db.connect();

db.query("DESCRIBE users", (err, result) => {
  if (err) console.error(err);
  else console.log(result);
  db.end();
});
