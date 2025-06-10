const express = require('express');
const router = express.Router();
const db = require('../db/sql');

router.get('/division', async (req, res) => {
    try {
      const query = `SELECT * FROM Division`;
      const data = await db.connectAndQuery(query);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Server Error');
    }
  });

  router.get('/user', async (req, res) => {
    const userID = req.query.userID
    
    
    try {
      const query = `SELECT UserDivision.userDivisionID,
                            UserDivision.userID,
                            UserDivision.divisionID,
                            Division.divisionName,
                            Division.III_division,
                            Division.costCenter
                    FROM UserDivision 
                    INNER JOIN Division ON Division.divisionID = UserDivision.divisionID
                    WHERE Userdivision.userID = '${userID}'
       `;
      const data = await db.connectAndQuery(query);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Server Error');
    }
  });

  router.get('/license', async (req, res) => {
    const productID = req.query.productID
    try {
      const query = `SELECT LicenseCertificate.licenseID,
                            LicenseCertificate.licenseNo,
                            LicenseCertificate.dateIssue AS licenseDateIssue,
                            LicenseCertificate.dateExpire AS licenseDateExpire,
                            LicenseCertificate.licenseCertificateStatusID ,
                            LicenseCertificateStatus.licenseCertificateStatusName
                    from LicenseCertificate
                    INNER JOIN LicenseCertificateStatus ON LicenseCertificateStatus.licenseCertificateStatusID = LicenseCertificate.licenseCertificateStatusID  
                     WHERE productID = '${productID}'
       `;
      const data = await db.connectAndQuery(query);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Server Error');
    }
  });

  router.get('/productname', async (req, res) => {
    const productID = req.query.productID
    try {
      const query = `SELECT Product.productID,
                            Product.productName,
                            Product.productValue
                     from Product
                     WHERE productID = '${productID}'
       `;
      const data = await db.connectAndQuery(query);
      res.status(200).json(data);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Server Error');
    }
  });

  module.exports = router;