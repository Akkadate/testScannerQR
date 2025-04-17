// scanner.js
document.addEventListener('DOMContentLoaded', function() {
    let config = {
        encryptionSecret: null,
        qrExpiryMinutes: 5
    };
    
    const resultContainer = document.getElementById('qr-result');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    
    let scanner = null;
    
    // โหลดค่า config จาก server

// ในส่วนของ loadConfig ในไฟล์ scanner.js
async function loadConfig() {
    try {
        const response = await fetch('/api/scanner-config');
        const data = await response.json();
        config = data;
        // ตั้งค่า config ให้กับ QRDecoder
        QRDecoder.setConfig(data);
        console.log('Config loaded', { qrExpiryMinutes: config.qrExpiryMinutes });
    } catch (error) {
        console.error('Failed to load config:', error);
        resultContainer.innerHTML = '<div class="alert alert-danger">ไม่สามารถโหลดการตั้งค่าได้</div>';
    }
}

// ในส่วนของ onScanSuccess ในไฟล์ scanner.js
async function onScanSuccess(decodedText) {
    try {
        // แสดงข้อมูลดิบที่สแกนได้
        resultContainer.innerHTML = '<div class="alert alert-info">กำลังถอดรหัส...</div>';
        
        // ใช้ QRDecoder เพื่อถอดรหัส
        const data = await QRDecoder.decodeQRData(decodedText);
        
        // ตรวจสอบว่า QR Code หมดอายุหรือไม่
        const isExpired = QRDecoder.isExpired(data);
        
        // จัดรูปแบบข้อมูลสำหรับแสดงผล
        const formattedData = QRDecoder.formatDecodedData(data);
        
        let html = '<div class="card">';
        html += '<div class="card-header bg-primary text-white">ข้อมูล QR Code</div>';
        html += '<div class="card-body">';
        
        if (isExpired) {
            html += '<div class="alert alert-danger mb-3">QR Code นี้หมดอายุแล้ว</div>';
        } else {
            html += '<div class="alert alert-success mb-3">QR Code ยังใช้งานได้</div>';
        }
        
        // แสดงข้อมูลในรูปแบบตาราง
        html += '<table class="table table-striped">';
        for (const [key, value] of Object.entries(formattedData)) {
            html += `<tr>
                <td><strong>${key}</strong></td>
                <td>${value}</td>
            </tr>`;
        }
        html += '</table>';
        html += '</div></div>';
        
        resultContainer.innerHTML = html;
    } catch (error) {
        resultContainer.innerHTML = `<div class="alert alert-danger">เกิดข้อผิดพลาด: ${error.message}</div>`;
    }
}

    
    // เริ่มสแกน QR Code
    function startScanner() {
        const html5QrCode = new Html5Qrcode("video-container");
        
        html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: 250
            },
            onScanSuccess,
            onScanFailure
        ).then(() => {
            scanner = html5QrCode;
            startButton.disabled = true;
            stopButton.disabled = false;
        }).catch(err => {
            resultContainer.innerHTML = `<div class="alert alert-danger">ไม่สามารถเริ่มกล้องได้: ${err}</div>`;
        });
    }
    
    // หยุดสแกน
    function stopScanner() {
        if (scanner) {
            scanner.stop().then(() => {
                startButton.disabled = false;
                stopButton.disabled = true;
            }).catch(err => {
                console.error('Failed to stop scanner:', err);
            });
        }
    }
    
    // เมื่อสแกน QR Code สำเร็จ
    async function onScanSuccess(decodedText) {
        try {
            // แสดงข้อมูลดิบที่สแกนได้
            resultContainer.innerHTML = '<div class="alert alert-info">กำลังถอดรหัส...</div>';
            
            // ส่งข้อมูลไปถอดรหัสที่ server
            const response = await fetch('/api/decode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ qrData: decodedText })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // ตรวจสอบว่า QR Code หมดอายุหรือไม่
                const data = result.data;
                const now = Date.now();
                const expiryTime = data.e || data.exp || data.expiryTime;
                
                let html = '<div class="card">';
                html += '<div class="card-header bg-primary text-white">ข้อมูล QR Code</div>';
                html += '<div class="card-body">';
                
                if (expiryTime && now > expiryTime) {
                    html += '<div class="alert alert-danger mb-3">QR Code นี้หมดอายุแล้ว</div>';
                } else {
                    html += '<div class="alert alert-success mb-3">QR Code ยังใช้งานได้</div>';
                }
                
                // แสดงข้อมูลในรูปแบบตาราง
                html += '<table class="table table-striped">';
                for (const [key, value] of Object.entries(data)) {
                    html += `<tr>
                        <td><strong>${getFieldName(key)}</strong></td>
                        <td>${formatValue(key, value)}</td>
                    </tr>`;
                }
                html += '</table>';
                html += '</div></div>';
                
                resultContainer.innerHTML = html;
            } else {
                resultContainer.innerHTML = `<div class="alert alert-danger">ไม่สามารถถอดรหัสได้: ${result.error}</div>`;
            }
        } catch (error) {
            resultContainer.innerHTML = `<div class="alert alert-danger">เกิดข้อผิดพลาด: ${error.message}</div>`;
        }
    }
    
    // เมื่อสแกนไม่สำเร็จ
    function onScanFailure(error) {
        // ไม่ต้องทำอะไร - ไม่ต้องแสดง error ทุกครั้งที่สแกนไม่เจอ QR
        console.warn(`Scan error: ${error}`);
    }
    
    // แปลงชื่อฟิลด์ให้อ่านง่าย
    function getFieldName(key) {
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
        
        return fieldMap[key] || key;
    }
    
    // จัดรูปแบบค่าให้อ่านง่าย
    function formatValue(key, value) {
        // หากเป็นเวลา (timestamp)
        if (['t', 'ts', 'timestamp', 'e', 'exp', 'expiryTime'].includes(key) && !isNaN(value)) {
            const date = new Date(parseInt(value));
            return date.toLocaleString('th-TH');
        }
        
        return value;
    }
    
    // เหตุการณ์คลิกปุ่ม
    startButton.addEventListener('click', startScanner);
    stopButton.addEventListener('click', stopScanner);
    
    // โหลดค่า config เมื่อโหลดหน้าเว็บ
    loadConfig();
});
