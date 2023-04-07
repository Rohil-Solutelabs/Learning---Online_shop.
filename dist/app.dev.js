"use strict";

var path = require("path");

var fs = require("fs");

var https = require("https");

var express = require("express");

var bodyParser = require("body-parser");

var mongoose = require("mongoose");

var session = require("express-session");

var MongoDBStore = require("connect-mongodb-session")(session);

var csrf = require("csurf");

var flash = require("connect-flash");

var multer = require("multer");

var helmet = require("helmet");

var compression = require("compression"); // const morgan = require("morgan");


var errorController = require("./controllers/error");

var User = require("./models/user");

require("dotenv").config();

console.log(process.env.NODE_ENV);
var MONGODB_URI = "mongodb+srv://".concat(process.env.MONGO_USER, ":").concat(process.env.MONGO_PASSWORD, "@cluster0.wyqyer0.mongodb.net/").concat(process.env.MONGO_DEFAULT_DATABASE);
var app = express(); // used to store and retrieve session data in the specified MongoDB database.

var store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions"
});
var csrfProtection = csrf(); // const privateKey = fs.readFileSync("server.key");
// const certificate = fs.readFileSync("server.cert");

var fileStorage = multer.diskStorage({
  destination: function destination(req, file, cb) {
    cb(null, "images");
  },
  filename: function filename(req, file, cb) {
    var currentDate = new Date().toISOString().slice(0, 10);
    var ext = path.extname(file.originalname);
    cb(null, currentDate + "-" + file.originalname);
  }
});

var fileFilter = function fileFilter(req, file, cb) {
  if (file.mimetype === "image/png" || file.mimetype === "image/jpg" || file.mimetype === "image/jpeg") {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.set("view engine", "ejs");
app.set("views", "views");

var adminRoutes = require("./routes/admin");

var shopRoutes = require("./routes/shop");

var authRoutes = require("./routes/auth"); // We want write log data using morgan into file not in console
// const accessLogStream = fs.createWriteStream(
//   path.join(__dirname, "logs/access.log"),
//   { flags: "a" }
// );
// Add secure headers in responses and requests for attacks


app.use(helmet()); // compress all responses

app.use(compression()); // Simplifies the process of logging requests and find some logging data
// app.use(morgan("combined", { stream: accessLogStream }));
// accessLogStream.on("error", (err) => {
//   console.error(`Error writing to access log: ${err}`);
// });

app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(multer({
  storage: fileStorage,
  fileFilter: fileFilter
}).single("image"));
app.use(express["static"](path.join(__dirname, "public")));
app.use("/images", express["static"](path.join(__dirname, "images"))); // set up session handling in an Express.js application with MongoDB session storage

app.use(session({
  secret: "my secret",
  resave: false,
  saveUninitialized: false,
  store: store
})); // middleware for csrf protection

app.use(csrfProtection);
app.use(flash()); // middleware for checking every routes for generate csrftoken and logging in or not?

app.use(function (req, res, next) {
  // it allows us to set local veriable that are passed into the views and generate csrfToken
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
}); // this middleware is used to ensure that user data is available to subsequent middleware functions and
// route handlers in the request-response cycle for authenticated requests.

app.use(function (req, res, next) {
  // throw new Error("Dummy");
  if (!req.session.user) {
    return next();
  }

  User.findById(req.session.user._id).then(function (user) {
    // if there is not user then call next directly
    if (!user) {
      return next();
    }

    req.user = user;
    next();
  })["catch"](function (err) {
    next(new Error(err));
  });
});
app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);
app.get("/500", errorController.get500);
app.use(errorController.get404);
app.use(function (error, req, res, next) {
  // res.status(error.httpStatusCode).render(...);
  // res.redirect("/500");
  res.status(500).render("500", {
    pageTitle: "Error!",
    path: "/500",
    isAuthenticated: req.session.isLoggedIn
  });
});
mongoose.connect(MONGODB_URI).then(function (result) {
  console.log("Connected Successfully!"); // if you want to use manually SSL certificate then use this otherwise Hosting provider can do with its own
  // const server = https
  //   .createServer({ key: privateKey, cert: certificate }, app)
  //   .listen(process.env.PORT || 3000);

  var server = app.listen(process.env.PORT || 3000);
  server.on("error", function (error) {
    if (error.code === "EADDRINUSE") {
      console.error("Port ".concat(port, " is already in use"));
    } else {
      console.error("An error occurred: ".concat(error));
    }
  });
})["catch"](function (err) {
  console.log(err);
});