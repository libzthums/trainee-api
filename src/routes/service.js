const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db/sql");
const XLSX = require("xlsx");
const moment = require("moment");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dirPath = path.join("uploads", "ServiceDocument");
    console.log("dirPath ", dirPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    cb(null, dirPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only PDF and DOCX files are allowed."), false);
    }

    cb(null, true);
  },
});

// Function to generate charge dates for each month
const generateChargeDates = (startDate, endDate) => {
  const dates = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);
  console.log("start date ", currentDate.getDate());

  // if (currentDate.getDate() > 15) {
  //   // Skip start month, include end month
  //   //currentDate.setMonth(currentDate.getMonth() + 1);
  //   while (currentDate <= end) {
  //     dates.push(new Date(currentDate));
  //     currentDate.setMonth(currentDate.getMonth() + 1);
  //   }
  // } else {
  //   if (end.getDate() > 15) {
  //     while (
  //       moment(currentDate).format("YYYY-MM") < moment(end).format("YYYY-MM")
  //     ) {
  //       dates.push(new Date(currentDate));
  //       currentDate.setMonth(currentDate.getMonth() + 1);
  //     }
  //   } else {
  //     while (
  //       moment(currentDate).format("YYYY-MM") <= moment(end).format("YYYY-MM")
  //     ) {
  //       dates.push(new Date(currentDate));
  //       currentDate.setMonth(currentDate.getMonth() + 1);
  //     }
  //   }
  //   // Include start month, skip end month
  // }
  let count = end.getMonth() - currentDate.getMonth();
  let month = moment(startDate).format("YYYY-MM");
  const monthformath = new Date(month);
  // console.log("monthformath ",monthformath);
  // console.log("currentDate ",currentDate);

  //console.log("count ",count);

  if (currentDate.getMonth() == end.getMonth()) {
    if (currentDate.getDate() > 15) {
      // console.log("1");
      monthformath.setMonth(monthformath.getMonth() + 1);
      while (
        moment(monthformath).format("YYYY-MM") <= moment(end).format("YYYY-MM")
      ) {
        dates.push(new Date(monthformath));
        monthformath.setMonth(monthformath.getMonth() + 1);
      }
    } else {
      // console.log("2");
      while (
        moment(monthformath).format("YYYY-MM") < moment(end).format("YYYY-MM")
      ) {
        dates.push(new Date(monthformath));
        monthformath.setMonth(monthformath.getMonth() + 1);
      }
    }
    // while ( moment(monthformath).format("YYYY-MM") < moment(end).format("YYYY-MM")) {
    //       dates.push(new Date(monthformath));
    //       monthformath.setMonth(monthformath.getMonth() + 1);
    //     }
  } else {
    if (count > 1) {
      while (
        moment(monthformath).format("YYYY-MM") < moment(end).format("YYYY-MM")
      ) {
        dates.push(new Date(monthformath));
        monthformath.setMonth(monthformath.getMonth() + 1);
      }
    } else {
      while (
        moment(monthformath).format("YYYY-MM") <= moment(end).format("YYYY-MM")
      ) {
        dates.push(new Date(monthformath));
        monthformath.setMonth(monthformath.getMonth() + 1);
      }
    }
  }

  return dates;
};

// Function to calculate expireStatus based on the endDate
const calculateExpireStatus = (endDate) => {
  const currentDate = new Date();
  const end = new Date(endDate);

  if (end > currentDate) {
    // If the end date is in the future
    const diffInDays = Math.floor((end - currentDate) / (1000 * 3600 * 24));

    if (diffInDays <= 90) {
      return 2; // expire in 3 months
    } else {
      return 1; // issued
    }
  } else {
    // If the end date is in the past
    const diffInDays = Math.floor((currentDate - end) / (1000 * 3600 * 24));

    if (diffInDays <= 30) {
      return 3; // just expired
    } else {
      return 4; // expired
    }
  }
};

// Function to calculate warranty status for each month
const calculateWarrantyStatus = (startDate, endDate, warrantyCount) => {
  const warrantyMonths = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let i = 0; i < warrantyCount; i++) {
    const warrantyMonth = new Date(start);
    warrantyMonth.setMonth(start.getMonth() + i);
    if (warrantyMonth <= end) {
      warrantyMonths.push(warrantyMonth.getMonth()); // Store the month index
    }
  }

  return warrantyMonths;
};

router.get("/countmonth", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = generateChargeDates(startDate, endDate);
    //console.log("result ", result);

    const totalMonth = result.length;
    //console.log("totalMonth ", totalMonth);

    res.status(200).json(totalMonth);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});
// GET Route for fetching services
router.get("/", async (req, res) => {
  try {
    const query = `
    SELECT 
      service.serviceID, 
      service.DeviceName,
      service.serialNumber,
      service.contractNo,
      service.Brand,
      service.Model,
      service.Type,
      service.Location,
      service.price,
      service.startDate, 
      service.endDate, 
      service.vendorName, 
      service.warrantyCount,
      service.statusID,
      division.divisionID,
      division.divisionName,
      ServiceExpireCheck.statusName AS expireStatusName,
      MAX(sd.monthly_charge) AS monthly_charge
    FROM Service AS service
    INNER JOIN Division AS division ON service.divisionID = division.divisionID
    LEFT JOIN ServiceDetail AS sd ON service.serviceID = sd.serviceID
    INNER JOIN ServiceExpireCheck ON ServiceExpireCheck.statusID = Service.statusID
    GROUP BY 
      service.serviceID, service.DeviceName, service.serialNumber, 
      service.contractNo, service.Brand,
      service.Model, service.Type, service.Location, service.price, service.startDate, 
      service.endDate, service.vendorName, service.warrantyCount, service.statusID,
      division.divisionID, division.divisionName,
      ServiceExpireCheck.statusName
    `;

    const data = await db.connectAndQuery(query);

    // // Fetch status names from ServiceExpireCheck table
    // const statusQuery = `SELECT statusID, statusName FROM ServiceExpireCheck`;
    // const statusData = await db.connectAndQuery(statusQuery);

    // // Convert status data to a dictionary for easy lookup
    // const statusMap = statusData.reduce((acc, row) => {
    //   acc[row.statusID] = row.statusName;
    //   return acc;
    // }, {});

    // // Fetch all oldServiceIDs that have been reissued
    // const reissueRows = await db.connectAndQuery(
    //   "SELECT oldServiceID FROM ServiceReIssue"
    // );
    // const reissuedSet = new Set(reissueRows.map((r) => r.oldServiceID));

    // Add expireStatus and warrantyMonths, and update DB if needed
    // const updatedData = await Promise.all(
    //   data.map(async (row) => {
    //     const expireStatus = calculateExpireStatus(row.endDate);
    //     const warrantyMonths = calculateWarrantyStatus(
    //       row.startDate,
    //       row.endDate,
    //       row.warrantyCount
    //     );

    //     // Check if this service has been reissued
    //     let reIssueStatus = 0;
    //     if (reissuedSet.has(row.serviceID)) {
    //       reIssueStatus = 1;
    //       // Set statusID to 4 if not already
    //       if (row.statusID !== 4) {
    //         await db.connectAndQuery(`
    //           UPDATE Service
    //           SET statusID = 4
    //           WHERE serviceID = '${row.serviceID}'
    //         `);
    //       }
    //     }

    //     // Only update if the calculated status is different from stored statusID
    //     if (expireStatus !== row.statusID && reIssueStatus === 0) {
    //       await db.connectAndQuery(`
    //         UPDATE Service
    //         SET statusID = ${expireStatus}
    //         WHERE serviceID = '${row.serviceID}'
    //       `);
    //     }

    //     return {
    //       ...row,
    //       expireStatus,
    //       expireStatusName: statusMap[expireStatus] || "Unknown",
    //       warrantyMonths,
    //       reIssueStatus,
    //     };
    //   })
    // );

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).send("Server Error");
  }
});

router.get("/detail/:serviceID", async (req, res) => {
  try {
    const { serviceID } = req.params;
    const query = `
      SELECT charge_date, monthly_charge
      FROM ServiceDetail
      WHERE serviceID = @serviceID
      ORDER BY charge_date
    `;
    const pool = await db.connectDB();
    const request = pool.request();
    request.input("serviceID", db.sql.Int, serviceID);
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch service details" });
  }
});

// INSERT new service
router.post("/insertdata", async (req, res) => {
  try {
    const getDataArray = (body) => {
      if (Array.isArray(body)) return body;
      if (Array.isArray(body.data)) return body.data;
      return [body.data || body];
    };

    const dataArray = getDataArray(req.body);

    if (!dataArray || dataArray.length === 0) {
      return res.status(400).json({ error: "No data provided" });
    }

    const insertedServiceIDs = [];

    for (const data of dataArray) {
      const {
        DeviceName,
        divisionID,
        price,
        startDate,
        endDate,
        vendorName,
        serialNumber,
        contractNo,
        Brand,
        Model,
        Type,
        Location,
        WarrantyCount,
        statusID,
        prFileName,
        poFileName,
        contractFileName,
      } = data;

      if (!DeviceName || !divisionID) {
        return res.status(400).json({ error: "Missing required fields!!!" });
      }

      const chargeDates = generateChargeDates(startDate, endDate);
      const months = chargeDates.length;
      const monthlyCharge = (price / months).toFixed(2);
      const statusNew = calculateExpireStatus(endDate);

      const pool = await db.connectDB();
      const request = pool.request();
      request.input("DeviceName", db.sql.VarChar, DeviceName);
      request.input("divisionID", db.sql.Int, divisionID);
      request.input("price", db.sql.Float, price);
      request.input("startDate", db.sql.Date, startDate);
      request.input("endDate", db.sql.Date, endDate);
      request.input("vendorName", db.sql.VarChar, vendorName);
      request.input("serialNumber", db.sql.VarChar, serialNumber);
      request.input("contractNo", db.sql.VarChar, contractNo);
      request.input("totalMonth", db.sql.Int, months);
      request.input("Brand", db.sql.VarChar, Brand);
      request.input("Model", db.sql.VarChar, Model);
      request.input("Type", db.sql.VarChar, Type);
      request.input("Location", db.sql.VarChar, Location);
      request.input("WarrantyCount", db.sql.Int, WarrantyCount || 0);
      request.input("statusID", db.sql.Int, statusNew);

      try {
        const result = await request.query(`
          INSERT INTO Service (DeviceName, divisionID, price, startDate, endDate, vendorName, serialNumber, contractNo, totalMonth, Brand, Model, Type, Location, WarrantyCount, statusID)
          OUTPUT INSERTED.serviceID
          VALUES (@DeviceName, @divisionID, @price, @startDate, @endDate, @vendorName, @serialNumber, @contractNo, @totalMonth, @Brand, @Model, @Type, @Location, @WarrantyCount, @statusID);
        `);

        const serviceID = result.recordset[0]?.serviceID;

        if (!serviceID) {
          return res.status(500).json({ error: "Failed to insert service." });
        }

        // Insert service details for each month
        for (const chargeDate of chargeDates) {
          const serviceDetailRequest = pool.request();
          serviceDetailRequest.input("serviceID", db.sql.Int, serviceID);
          serviceDetailRequest.input("chargeDate", db.sql.Date, chargeDate);
          serviceDetailRequest.input(
            "monthlyCharge",
            db.sql.Float,
            monthlyCharge
          );

          await serviceDetailRequest.query(`
            INSERT INTO ServiceDetail (serviceID, charge_date, monthly_charge)
            VALUES (@serviceID, @chargeDate, @monthlyCharge);
          `);
        }

        // Insert into ServiceDocument if prFileName, poFileName, contractFileName are present
        if (prFileName) {
          const docReq = pool.request();
          docReq.input("serviceID", db.sql.Int, serviceID);
          docReq.input("DocName", db.sql.NVarChar, prFileName);
          docReq.input("DocType", db.sql.NVarChar, "pr");
          docReq.input("DocPath", db.sql.NVarChar, null);
          await docReq.query(`
            INSERT INTO ServiceDocument (serviceID, DocName, DocType, DocPath)
            VALUES (@serviceID, @DocName, @DocType, @DocPath)
          `);
        }
        if (poFileName) {
          const docReq = pool.request();
          docReq.input("serviceID", db.sql.Int, serviceID);
          docReq.input("DocName", db.sql.NVarChar, poFileName);
          docReq.input("DocType", db.sql.NVarChar, "po");
          docReq.input("DocPath", db.sql.NVarChar, null);
          await docReq.query(`
            INSERT INTO ServiceDocument (serviceID, DocName, DocType, DocPath)
            VALUES (@serviceID, @DocName, @DocType, @DocPath)
          `);
        }
        if (contractFileName) {
          const docReq = pool.request();
          docReq.input("serviceID", db.sql.Int, serviceID);
          docReq.input("DocName", db.sql.NVarChar, contractFileName);
          docReq.input("DocType", db.sql.NVarChar, "contract");
          docReq.input("DocPath", db.sql.NVarChar, null);
          await docReq.query(`
            INSERT INTO ServiceDocument (serviceID, DocName, DocType, DocPath)
            VALUES (@serviceID, @DocName, @DocType, @DocPath)
          `);
        }

        insertedServiceIDs.push(serviceID);
      } catch (queryError) {
        console.error("SQL Query Error:", queryError);
        return res.status(500).json({ error: "Database query failed" });
      }
    }

    res.status(201).json({
      message: "Service and service details added successfully",
      serviceID: insertedServiceIDs[0],
    });
  } catch (error) {
    console.error("Error inserting service:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// POST route for file upload and linking to service
router.post("/insertdoc", upload.array("files"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send("No files uploaded.");
    }

    const pool = await db.connectDB();

    if (req.body.serviceID && req.body.fileTypes) {
      const serviceID = parseInt(req.body.serviceID);
      const fileTypes = JSON.parse(req.body.fileTypes);

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const fileType = fileTypes[i] || "Unknown";

        const insertQuery = `
          INSERT INTO ServiceDocument (DocName, DocPath, DocType, serviceID)
          VALUES (@DocName, @DocPath, @DocType, @ServiceID)
        `;
        const insertRequest = pool.request();
        insertRequest.input("DocName", db.sql.NVarChar, file.originalname);
        insertRequest.input("DocPath", db.sql.NVarChar, file.path);
        insertRequest.input("DocType", db.sql.NVarChar, fileType);
        insertRequest.input("ServiceID", db.sql.Int, serviceID);
        await insertRequest.query(insertQuery);
      }

      return res
        .status(200)
        .send("Files uploaded and inserted with serviceID.");
    }

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const docName = file.originalname;

      const checkQuery = `SELECT * FROM ServiceDocument WHERE DocName = @DocName`;
      const checkRequest = pool.request();
      checkRequest.input("DocName", db.sql.NVarChar, docName);
      const checkResult = await checkRequest.query(checkQuery);

      if (checkResult.recordset.length > 0) {
        const updateQuery = `
          UPDATE ServiceDocument
          SET DocPath = @DocPath
          WHERE DocName = @DocName
        `;
        const updateRequest = pool.request();
        updateRequest.input("DocPath", db.sql.NVarChar, file.path);
        updateRequest.input("DocName", db.sql.NVarChar, docName);
        await updateRequest.query(updateQuery);
      } else {
        console.warn(`DocName ${docName} not found. Skipping.`);
      }
    }

    res.status(200).send("Files processed successfully.");
  } catch (error) {
    console.error("Error uploading files:", error);
    res.status(500).send("Failed to upload files. Please try again.");
  }
});

// Get Division
router.get("/division", async (req, res) => {
  try {
    const query = `SELECT divisionID, divisionName FROM Division`;
    const data = await db.connectAndQuery(query);
    res.json(data);
  } catch (error) {
    console.error("Error fetching divisions:", error);
    res.status(500).send("Server Error");
  }
});

router.put("/updatedata/:serviceID", async (req, res) => {
  try {
    const { serviceID } = req.params; // Get the serviceID from the request parameter
    const {
      DeviceName,
      divisionID,
      price,
      startDate,
      endDate,
      vendorName,
      serialNumber,
      contractNo,
      Brand,
      Model,
      Type,
      Location,
    } = req.body; // Get the updated data from the request body

    // Ensure required fields are provided
    if (!serviceID || !divisionID) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pool = await db.connectDB();
    const request = pool.request();

    // Input parameters for the update query
    request.input("DeviceName", db.sql.VarChar, DeviceName);
    request.input("divisionID", db.sql.Int, divisionID);
    request.input("price", db.sql.Float, price);
    request.input("startDate", db.sql.Date, startDate);
    request.input("endDate", db.sql.Date, endDate);
    request.input("vendorName", db.sql.VarChar, vendorName);
    request.input("serialNumber", db.sql.VarChar, serialNumber);
    request.input("contractNo", db.sql.VarChar, contractNo);
    request.input("Brand", db.sql.VarChar, Brand || null); // Optional
    request.input("Model", db.sql.VarChar, Model || null); // Optional
    request.input("Type", db.sql.VarChar, Type);
    request.input("Location", db.sql.VarChar, Location || null); // Optional
    request.input("serviceID", db.sql.Int, serviceID); // Pass the serviceID for identifying the record

    // Construct the UPDATE query
    const query = `
      UPDATE Service
      SET 
        DeviceName = @DeviceName,
        divisionID = @divisionID,
        price = @price,
        startDate = @startDate,
        endDate = @endDate,
        vendorName = @vendorName,
        serialNumber = @serialNumber,
        contractNo = @contractNo,
        Brand = @Brand,
        Model = @Model,
        Type = @Type,
        Location = @Location
      WHERE serviceID = @serviceID;
    `;

    // Execute the update query
    const result = await request.query(query);

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.status(200).json({ message: "Service updated successfully" });
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/expirechecklist", async (req, res) => {
  try {
    const query = `SELECT StatusID, statusName FROM ServiceExpireCheck ORDER BY StatusID ASC`;
    const data = await db.connectAndQuery(query);
    res.json(data);
  } catch (error) {
    console.error("Error fetching expire checklist:", error);
    res.status(500).send("Server Error");
  }
});

router.get("/typelist", async (req, res) => {
  try {
    const query = `SELECT TypeId, TypeName FROM ServiceType ORDER BY TypeId ASC`;
    const data = await db.connectAndQuery(query);
    res.json(data);
  } catch (error) {
    console.error("Error fetching type list:", error);
    res.status(500).send("Server Error");
  }
});

router.post("/addtype", async (req, res) => {
  try {
    const { typeName } = req.body;

    if (!typeName || !typeName.trim()) {
      return res.status(400).json({ error: "Type Name cannot be empty." });
    }

    const query = `INSERT INTO ServiceType (TypeName) VALUES (@typeName)`;
    const pool = await db.connectDB();
    const request = pool.request();
    request.input("typeName", db.sql.VarChar, typeName.trim());

    await request.query(query);

    res.status(201).json({ message: "Type added successfully." });
  } catch (error) {
    console.error("Error adding type:", error);
    res.status(500).send("Server Error");
  }
});

router.put("/updatetype/:typeID", async (req, res) => {
  try {
    const { typeID } = req.params;
    const { typeName } = req.body;
    if (!typeName || !typeName.trim()) {
      return res.status(400).json({ error: "Type Name cannot be empty." });
    }

    const pool = await db.connectDB();
    const request = pool.request();
    request.input("typeName", db.sql.VarChar, typeName.trim());
    request.input("typeID", db.sql.Int, parseInt(typeID, 10));
    await request.query(
      `UPDATE ServiceType SET TypeName = @typeName WHERE TypeId = @typeID`
    );

    res.status(200).json({ message: "Type updated successfully." });
  } catch (error) {
    console.error("Error updating type:", error);
    res.status(500).send("Server Error");
  }
});

router.delete("/deletetype/:typeId", async (req, res) => {
  try {
    const { typeId } = req.params;
    const pool = await db.connectDB();
    const request = pool.request();

    request.input("typeId", db.sql.Int, typeId);
    await request.query("DELETE FROM ServiceType WHERE TypeId = @typeId");

    res.status(200).json({ message: "Type deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
    console.error("Error deleting type:", error);
  }
});

router.delete("/deletedata/:serviceID", async (req, res) => {
  try {
    const { serviceID } = req.params;
    const pool = await db.connectDB();
    const request = pool.request();
    request.input("serviceID", db.sql.Int, serviceID);

    // Delete related ServiceDocument and ServiceDetail records first if needed
    await request.query(
      "DELETE FROM ServiceDocument WHERE serviceID = @serviceID"
    );
    await request.query(
      "DELETE FROM ServiceDetail WHERE serviceID = @serviceID"
    );

    // Then delete the Service record
    const result = await request.query(
      "DELETE FROM Service WHERE serviceID = @serviceID"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.status(200).json({ message: "Service deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
    console.error("Error deleting service:", error);
  }
});

module.exports = router;
