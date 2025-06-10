const express = require("express");
const bcrypt = require("bcryptjs");
const { connectDB, sql } = require("../db/sql");

const router = express.Router();

router.get("/", (req, res) => {
  res.render("register"); // Render the register.ejs view
});

// Handle POST request for registering a new user
router.post("/", async (req, res) => {
  const {
    userFullName,
    userName,
    userPassword,
    userDivision,
    userPermission = 1,
  } = req.body;

  try {
    const pool = await connectDB();

    // Check if user already exists
    const existingUser = await pool
      .request()
      .input("userName", sql.VarChar(255), userName)
      .query(
        "SELECT COUNT(*) AS count FROM userLogin WHERE userName = @userName"
      );

    if (existingUser.recordset[0].count > 0) {
      return res.render("register", {
        errorMessage: "Email already registered!",
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(userPassword, 10);

    // Insert into userLogin
    const insertLoginResult = await pool
      .request()
      .input("userName", sql.VarChar(255), userName)
      .input("userPassword", sql.VarChar(255), hashedPassword)
      .query(
        "INSERT INTO userLogin (userName, userPassword) OUTPUT INSERTED.userID VALUES (@userName, @userPassword)"
      );

    const userID = insertLoginResult.recordset[0].userID;

    // Insert into userDetail
    await pool
      .request()
      .input("userID", sql.Int, userID)
      .input("userFullName", sql.VarChar(255), userFullName)
      .input("userPermission", sql.Int, userPermission)
      .query(
        "INSERT INTO userDetail (userID, Name, Permission) VALUES (@userID, @userFullName, @userPermission)"
      );

    // Insert into userDivision
    await pool
      .request()
      .input("userID", sql.Int, userID)
      .input("divisionID", sql.Int, parseInt(userDivision))
      .query(
        "INSERT INTO userDivision (userID, divisionID) VALUES (@userID, @divisionID)"
      );

    // Success
    res.render("register", {
      successMessage: "Registration successful! Please log in.",
    });
  } catch (err) {
    console.error("Registration failed:", err);
    res.render("register", {
      errorMessage: "Registration error. Please try again later.",
    });
  }
});

module.exports = router;
