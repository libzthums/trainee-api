const express = require("express");
const router = express.Router();
const { connectAndQuery, connectDB } = require("../db/sql");

router.get("/", async (req, res) => {
  try {
    // Query to fetch user details and their divisions
    const userQuery = `
      SELECT 
        ud.userID,
        ud.FullName, 
        ud.Permission, 
        udv.divisionID,
        ud.defaultDivision
      FROM 
        userDetail ud
      INNER JOIN 
        userDivision udv
      ON 
        ud.userID = udv.userID
    `;

    // Query to fetch all divisions
    const divisionQuery = `
      SELECT 
        divisionID, 
        divisionName 
      FROM 
        Division
    `;

    // Execute both queries
    const userResult = await connectAndQuery(userQuery);
    const divisionResult = await connectAndQuery(divisionQuery);

    // Map division names to division IDs
    const divisionsMap = divisionResult.reduce((map, division) => {
      map[division.divisionID] = division.divisionName;
      return map;
    }, {});

    // Group divisions for each user
    const usersMap = {};
    userResult.forEach((user) => {
      if (!usersMap[user.userID]) {
        usersMap[user.userID] = {
          userID: user.userID,
          Name: user.FullName,
          Permission: user.Permission,
          defaultDivision: user.defaultDivision,
          divisions: [],
        };
      }
      usersMap[user.userID].divisions.push({
        divisionID: user.divisionID,
        divisionName: divisionsMap[user.divisionID] || null,
      });
    });

    // Convert the users map to an array
    const users = Object.values(usersMap);

    // Send the users and all divisions as a response
    res.json({ users, divisions: divisionResult });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Error fetching data");
  }
});

router.post("/addDivision", async (req, res) => {
  const { userID, divisionID, FullName } = req.body;

  if (!userID || !divisionID) {
    return res.status(400).send("Missing userID or divisionID");
  }

  try {
    const pool = await connectDB();

    const checkUserQuery = `
      SELECT COUNT(*) as count FROM userDetail WHERE userID = @userID
    `;
    const checkResult = await pool
      .request()
      .input("userID", userID)
      .query(checkUserQuery);

    if (checkResult.recordset[0].count === 0) {
      const insertUserQuery = `
        INSERT INTO userDetail (userID, FullName, Permission, defaultDivision)
        VALUES (@userID, @FullName, 1, @divisionID)
      `;
      await pool
        .request()
        .input("userID", userID)
        .input("FullName", FullName)
        .input("divisionID", divisionID)
        .query(insertUserQuery);
    }

    // Check if user already has this division
    const checkDivisionQuery = `
      SELECT COUNT(*) as count FROM userDivision WHERE userID = @userID AND divisionID = @divisionID
    `;
    const checkDivisionResult = await pool
      .request()
      .input("userID", userID)
      .input("divisionID", divisionID)
      .query(checkDivisionQuery);

    if (checkDivisionResult.recordset[0].count > 0) {
      return res.status(400).send("User already has this division");
    }

    const query = `
      INSERT INTO userDivision (userID, divisionID)
      VALUES (@userID, @divisionID)
    `;

    await pool
      .request()
      .input("userID", userID)
      .input("divisionID", divisionID)
      .query(query);

    res.status(200).send("Division added to user successfully");
  } catch (error) {
    console.error("Error adding division to user:", error);
    res.status(500).send("Error adding division to user");
  }
});

router.post("/removeDivision", async (req, res) => {
  const { userID, divisionID } = req.body;

  if (!userID || !divisionID) {
    return res.status(400).send("Missing userID or divisionID");
  }

  try {
    const query = `
      DELETE FROM userDivision
      WHERE userID = @userID AND divisionID = @divisionID
    `;

    const pool = await connectDB();
    await pool
      .request()
      .input("userID", userID)
      .input("divisionID", divisionID)
      .query(query);

    res.status(200).send("User removed from division successfully");
  } catch (error) {
    console.error("Error removing user from division:", error);
    res.status(500).send("Error removing user from division");
  }
});

router.post("/setDefaultDivision", async (req, res) => {
  const { userID, divisionID } = req.body;

  if (!userID || !divisionID) {
    return res.status(400).send("Missing userID or divisionID");
  }

  try {
    const query = `
      UPDATE userDetail
      SET defaultDivision = @divisionID
      WHERE userID = @userID
    `;

    const pool = await connectDB();
    await pool
      .request()
      .input("userID", userID)
      .input("divisionID", divisionID)
      .query(query);

    res.status(200).send("Default division set successfully");
  } catch (error) {
    console.error("Error setting default division:", error);
    res.status(500).send("Error setting default division");
  }
});

router.get("/Permission", async (req, res) => {
  try {
    const query = `SELECT PermissionID, PermissionName FROM userPermission`;
    const result = await connectAndQuery(query);

    res.json({ permissionList: result });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).send("Error fetching user permissions");
  }
});

router.post("/updatePermission", async (req, res) => {
  const { userID, permission } = req.body;

  if (!userID || !permission) {
    return res.status(400).send("Missing userID or permission");
  }

  try {
    const query = `
      UPDATE userDetail
      SET Permission = @permission
      WHERE userID = @userID
    `;

    const pool = await connectDB();
    await pool
      .request()
      .input("userID", userID)
      .input("permission", permission)
      .query(query);

    res.status(200).send("Permission updated successfully");
  } catch (error) {
    console.error("Error updating permission:", error);
    res.status(500).send("Error updating permission");
  }
});

module.exports = router;
