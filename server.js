// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// ให้บริการไฟล์ static จากโฟลเดอร์ public
app.use(express.static('public'));
app.use(express.json());

// API ส่งค่า config ที่ปลอดภัย
app.get('/api/scanner-config', (req, res) => {
  res.json({
    encryptionSecret: process.env.ENCRYPTION_SECRET,
    qrExpiryMinutes: process.env.QR_EXPIRY_MINUTES || 5
  });
});

// API ถอดรหัส QR code
app.post('/api/decode', (req, res) => {
  try {
    const { qrData } = req.body;
    const secretKey = process.env.ENCRYPTION_SECRET;
    
    // ถอดรหัส QR data
    const decodedData = decodeQrData(qrData, secretKey);
    
    res.json({
      success: true,
      data: decodedData
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ฟังก์ชันถอดรหัส QR data
function decodeQrData(data, secretKey) {
  try {
    // ถอดรหัส Base64
    const decodedBase64 = Buffer.from(data, 'base64').toString();
    
    // ถ้าเป็น JSON ตรงๆ (ไม่ได้เข้ารหัส)
    if (decodedBase64.startsWith('{') && decodedBase64.endsWith('}')) {
      return JSON.parse(decodedBase64);
    }
    
    // ถอดรหัส XOR
    let result = '';
    for (let i = 0; i < decodedBase64.length; i++) {
      const charCode = decodedBase64.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length);
      result += String.fromCharCode(charCode);
    }
    
    // แปลงเป็น Object
    return JSON.parse(result);
  } catch (error) {
    // ลองถอดรหัสแบบเดิม (AES)
    try {
      // ... (ใส่โค้ดถอดรหัส AES ที่นี่ถ้าต้องการ)
      throw new Error('Unsupported encryption method');
    } catch (innerError) {
      throw new Error('Failed to decode QR data: ' + error.message);
    }
  }
}

// เส้นทางหลัก
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// เพิ่มต่อท้ายไฟล์ server.js
app.listen(port, () => {
  console.log(`QR Scanner test server running at http://localhost:${port}`);
  console.log('\nคำแนะนำ:');
  console.log('- การเข้าถึงกล้องเว็บแคมต้องใช้ HTTPS หรือ localhost');
  console.log('- ใช้ Chrome, Firefox หรือ Safari รุ่นใหม่');
  console.log('- ตรวจสอบว่าได้ให้สิทธิ์การเข้าถึงกล้องกับเว็บไซต์นี้');
  console.log('- หากไม่สามารถใช้กล้องได้ ระบบจะเสนอตัวเลือกการอัปโหลดรูปภาพแทน');
});
