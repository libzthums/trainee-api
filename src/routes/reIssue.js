const express = require("express");
const db = require("../db/sql");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { oldServiceID, newServiceID } = req.body;

    if (!oldServiceID || !newServiceID) {
      return res.status(400).send("Missing service IDs.");
    }

    const pool = await db.connectDB();

    // Check statusID of oldServiceID
    const checkResult = await pool
      .request()
      .input("OldID", db.sql.Int, oldServiceID)
      .query(
        "SELECT oldServiceID FROM ServiceReIssue WHERE oldServiceID = @OldID"
      );

    if (checkResult.recordset.length > 0) {
      return res
        .status(444)
        .json({ error: "Cannot reissue: Service is already reissued." });
    }

    // Set statusID to 4 (expired) for oldServiceID
    await pool
      .request()
      .input("OldID", db.sql.Int, oldServiceID)
      .query("UPDATE Service SET statusID = 5 WHERE serviceID = @OldID");

    // Insert reissue relation
    await pool
      .request()
      .input("OldID", db.sql.Int, oldServiceID)
      .input("NewID", db.sql.Int, newServiceID)
      .input("ReissueDate", db.sql.DateTime, new Date()).query(`
        INSERT INTO ServiceReIssue (oldServiceID, newServiceID, Date)
        VALUES (@OldID, @NewID, @ReissueDate)
      `);

    res.status(200).send("Reissue relation saved successfully.");
  } catch (error) {
    console.error("Error in /reIssue:", error);
    res.status(500).send("Failed to log reissue relation.");
  }
});

module.exports = router;
