// decoder.js
// ฟังก์ชันสำหรับการถอดรหัส QR code ฝั่ง client

// โมดูลสำหรับการถอดรหัส QR
const QRDecoder = (function() {
    
    // เก็บค่า config
    let config = {
        encryptionSecret: null,
        qrExpiryMinutes: 5
    };
    
    // อัปเดต config
    function setConfig(newConfig) {
        config = { ...config, ...newConfig };
    }
    
    // ฟังก์ชันถอดรหัสแบบง่าย (ใช้เมื่อเราทราบค่า encryption secret)
    function decodeSimple(encodedData, key) {
        try {
            // ถอดรหัส Base64
            const decodedBase64 = atob(encodedData);
            
            // ถ้าเป็น JSON ตรงๆ (ไม่ได้เข้ารหัส)
            if (decodedBase64.startsWith('{') && decodedBase64.endsWith('}')) {
                return JSON.parse(decodedBase64);
            }
            
            // ถอดรหัส XOR
            let result = '';
            for (let i = 0; i < decodedBase64.length; i++) {
                const charCode = decodedBase64.charCodeAt(i) ^ key.charCodeAt(i % key.length);
                result += String.fromCharCode(charCode);
            }
            
            // แปลงเป็น Object
            return JSON.parse(result);
        } catch (error) {
            console.error('Simple decode error:', error);
            throw new Error('การถอดรหัสแบบง่ายล้มเหลว');
        }
    }
    
    // ถอดรหัสแบบ AES เดิม (ใช้สำหรับระบบเก่า)
    function decodeAES(encryptedData, secretKey) {
        try {
            // ถอดรหัส Base64 และแปลงเป็น JSON
            const data = JSON.parse(atob(encryptedData));
            
            // ตรวจสอบว่ามีฟิลด์ e, iv และ s
            if (!data.e || !data.iv || !data.s) {
                throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
            }
            
            // ในที่นี้เราต้องใช้ CryptoJS สำหรับถอดรหัส AES
            // หากยังไม่มี lib ให้โหลดจาก CDN
            if (typeof CryptoJS === 'undefined') {
                throw new Error('ไม่พบ CryptoJS library');
            }
            
            // ตรวจสอบ HMAC signature
            const computedHmac = CryptoJS.HmacSHA256(data.e + data.iv, secretKey).toString();
            if (computedHmac !== data.s) {
                throw new Error('ลายเซ็นไม่ถูกต้อง - ข้อมูลอาจถูกแก้ไข');
            }
            
            // ถอดรหัส AES
            const decrypted = CryptoJS.AES.decrypt(
                data.e,
                secretKey,
                { 
                    iv: CryptoJS.enc.Utf8.parse(data.iv) 
                }
            );
            
            // แปลงเป็น string และ parse เป็น JSON
            return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
        } catch (error) {
            console.error('AES decode error:', error);
            throw new Error('การถอดรหัส AES ล้มเหลว');
        }
    }
    
    // ถอดรหัสแบบให้มันทำเอง (ฝั่ง client จะส่งไปที่ API ของ server)
    async function decodeWithAPI(encodedData) {
        try {
            const response = await fetch('/api/decode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ qrData: encodedData })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'เกิดข้อผิดพลาดในการถอดรหัส');
            }
            
            return result.data;
        } catch (error) {
            console.error('API decode error:', error);
            throw new Error('การถอดรหัสผ่าน API ล้มเหลว');
        }
    }
    
    // ฟังก์ชันที่จะพยายามถอดรหัสด้วยวิธีต่างๆ
    async function decodeQRData(qrData) {
        const errors = [];
        
        // วิธีแรก: ลองถอดรหัสผ่าน API
        try {
            return await decodeWithAPI(qrData);
        } catch (error) {
            errors.push(`API decode: ${error.message}`);
        }
        
        // วิธีที่สอง: ถ้ามี config.encryptionSecret ลองถอดรหัสเอง
        if (config.encryptionSecret) {
            try {
                return decodeSimple(qrData, config.encryptionSecret);
            } catch (error) {
                errors.push(`Simple decode: ${error.message}`);
                
                // ลองถอดรหัสแบบ AES ถ้า CryptoJS มีอยู่
                if (typeof CryptoJS !== 'undefined') {
                    try {
                        return decodeAES(qrData, config.encryptionSecret);
                    } catch (aesError) {
                        errors.push(`AES decode: ${aesError.message}`);
                    }
                }
            }
        }
        
        // วิธีสุดท้าย: ลองตรวจสอบว่าเป็นข้อความธรรมดาหรือไม่
        try {
            // ตรวจสอบว่าเป็นรูปแบบข้อความง่ายๆ เช่น STUDENT:123,TIME:456,EXP:789
            if (qrData.includes(',') && qrData.includes(':')) {
                const pairs = qrData.split(',');
                const result = {};
                
                pairs.forEach(pair => {
                    const [key, value] = pair.split(':');
                    result[key.trim()] = value.trim();
                });
                
                // มีอย่างน้อย STUDENT และ EXP
                if (result.STUDENT || result.S) {
                    return {
                        s: result.STUDENT || result.S,
                        t: parseInt(result.TIME || result.T || Date.now()),
                        e: parseInt(result.EXP || result.E || 0)
                    };
                }
            }
        } catch (plainTextError) {
            errors.push(`Plain text decode: ${plainTextError.message}`);
        }
        
        // ถ้าทุกวิธีล้มเหลว
        throw new Error(`ไม่สามารถถอดรหัส QR ได้: ${errors.join(', ')}`);
    }
    
    // ตรวจสอบว่า QR Code หมดอายุหรือไม่
    function isExpired(decodedData) {
        const now = Date.now();
        const expiryTime = decodedData.e || decodedData.exp || decodedData.expiryTime;
        
        return expiryTime && now > expiryTime;
    }
    
    // จัดรูปแบบข้อมูลสำหรับแสดงผล
    function formatDecodedData(decodedData) {
        const formattedData = {};
        
        // แปลงชื่อฟิลด์ให้เป็นภาษาไทย
        const fieldMap = {
            's': 'รหัสนักศึกษา',
            'sid': 'รหัสนักศึกษา',
            'studentId': 'รหัสนักศึกษา',
            't': 'เวลาสร้าง',
            'ts': 'เวลาสร้าง',
            'timestamp': 'เวลาสร้าง',
            'e': 'เวลาหมดอายุ',
            'exp': 'เวลาหมดอายุ',
            'expiryTime': 'เวลาหมดอายุ',
            'v': 'เวอร์ชัน',
            'ver': 'เวอร์ชัน',
            'version': 'เวอร์ชัน',
            'name': 'ชื่อ-นามสกุล',
            'fac': 'คณะ',
            'faculty': 'คณะ',
            'dep': 'สาขา',
            'department': 'สาขา'
        };
        
        // จัดรูปแบบแต่ละฟิลด์
        for (const [key, value] of Object.entries(decodedData)) {
            const displayName = fieldMap[key] || key;
            
            // จัดรูปแบบค่าตามประเภท
            let displayValue = value;
            
            // หากเป็นเวลา
            if (['t', 'ts', 'timestamp', 'e', 'exp', 'expiryTime'].includes(key) && !isNaN(value)) {
                const date = new Date(parseInt(value));
                displayValue = date.toLocaleString('th-TH');
            }
            
            formattedData[displayName] = displayValue;
        }
        
        return formattedData;
    }
    
    // เปิดเผย API สาธารณะของโมดูล
    return {
        setConfig,
        decodeQRData,
        isExpired,
        formatDecodedData
    };
})();

// ส่งออกโมดูล (ถ้าอยู่ใน Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRDecoder;
}
