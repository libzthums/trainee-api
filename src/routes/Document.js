const { default: axios } = require("axios");
const db = require("../db/sql");
const express = require("express");
const router = express.Router();

router.get('/open',async(req,res)=>{
    try {
      const fileName = req.query.fileName; // รับชื่อไฟล์จาก query string
     
     
        const fileUrl = `http://localhost/uploads/ServiceDocument/${fileName}`; // สร้าง URL ของไฟล์บนเซิร์ฟเวอร์อื่น
     
      // console.log("file url "+fileUrl);
      
      //   //ดึงไฟล์จากเซิร์ฟเวอร์อื่น
       
        const response = await axios.get(fileUrl, {
            responseType: 'arraybuffer', // รับข้อมูลเป็น binary
        });

        // กำหนด headers ให้ตรงกับประเภทของไฟล์
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        
        // ส่งไฟล์กลับไปยังผู้ใช้
      // console.log("status ",response.status);
        
        res.status(200).send(response.data);
       // console.log("response ",response.data);
        

      
       
  }catch (err) {
    console.error(err);
    res.status(500).send("Error importing data.");
  }
  
})

module.exports = router;