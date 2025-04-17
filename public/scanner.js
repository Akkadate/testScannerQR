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

    
   // แก้ไขฟังก์ชัน startScanner ใน scanner.js
function startScanner() {
    // ตรวจสอบว่าเบราว์เซอร์รองรับการเข้าถึงกล้องหรือไม่
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        resultContainer.innerHTML = `<div class="alert alert-danger">
            เบราว์เซอร์ของคุณไม่รองรับการเข้าถึงกล้อง<br>
            ลองใช้ Chrome, Firefox, Safari รุ่นใหม่ หรือตรวจสอบว่าเปิดใช้งานบน HTTPS หรือ localhost
        </div>`;
        return;
    }

    // ทางเลือกอื่นสำหรับการสแกน QR
    const html5QrCode = new Html5Qrcode("video-container");
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
    };

    // ทดลองใช้กล้องหลัง (ถ้ามี)
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).then(() => {
        scanner = html5QrCode;
        startButton.disabled = true;
        stopButton.disabled = false;
    }).catch(err => {
        console.error("กล้องหลังไม่สามารถใช้งานได้, ลองใช้กล้องหน้าแทน:", err);
        
        // ลองใช้กล้องหน้าถ้ากล้องหลังไม่ทำงาน
        html5QrCode.start(
            { facingMode: "user" },
            config,
            onScanSuccess,
            onScanFailure
        ).then(() => {
            scanner = html5QrCode;
            startButton.disabled = true;
            stopButton.disabled = false;
        }).catch(frontErr => {
            resultContainer.innerHTML = `<div class="alert alert-danger">
                ไม่สามารถเข้าถึงกล้องได้:<br>${frontErr.message}<br><br>
                <strong>ทางแก้ไข:</strong><br>
                1. ตรวจสอบว่าคุณได้ให้สิทธิ์การเข้าถึงกล้องกับเว็บไซต์นี้<br>
                2. ใช้เบราว์เซอร์รุ่นใหม่ (Chrome, Firefox, Safari)<br>
                3. ตรวจสอบว่ากล้องทำงานปกติในแอปอื่นๆ<br>
                4. ลองใช้ช่องทางอื่นในการสแกน QR code
            </div>`;
            
            // ให้ตัวเลือกในการอัปโหลดรูปภาพ QR Code แทน
            addFileUploadOption();
        });
    });
}

// เพิ่มฟังก์ชันอัปโหลดรูปภาพ QR code
function addFileUploadOption() {
    const uploadDiv = document.createElement('div');
    uploadDiv.className = 'mt-3';
    uploadDiv.innerHTML = `
        <div class="card">
            <div class="card-header bg-info text-white">
                <h5 class="mb-0">อัปโหลดรูปภาพ QR Code</h5>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <label for="qr-file" class="form-label">เลือกไฟล์รูปภาพที่มี QR Code:</label>
                    <input class="form-control" type="file" id="qr-file" accept="image/*">
                </div>
                <button id="process-file" class="btn btn-primary">ประมวลผล QR Code</button>
            </div>
        </div>
    `;
    
    document.getElementById('scanner-container').appendChild(uploadDiv);
    
    // เพิ่ม event listener สำหรับปุ่มอัปโหลด
    document.getElementById('process-file').addEventListener('click', processQRFromFile);
}

    // เพิ่มต่อท้ายฟังก์ชัน addFileUploadOption()
const manualInputDiv = document.createElement('div');
manualInputDiv.className = 'mt-3';
manualInputDiv.innerHTML = `
    <div class="card">
        <div class="card-header bg-warning text-white">
            <h5 class="mb-0">ป้อนข้อมูล QR Code โดยตรง</h5>
        </div>
        <div class="card-body">
            <div class="mb-3">
                <label for="qr-text" class="form-label">ป้อนข้อมูลจาก QR Code โดยตรง:</label>
                <textarea class="form-control" id="qr-text" rows="4" placeholder="ป้อนข้อมูลที่ได้จาก QR Code ที่นี่"></textarea>
            </div>
            <button id="process-text" class="btn btn-primary">ประมวลผล</button>
        </div>
    </div>
`;

document.getElementById('scanner-container').appendChild(manualInputDiv);

// เพิ่ม event listener สำหรับปุ่มประมวลผลข้อความ
document.getElementById('process-text').addEventListener('click', function() {
    const qrText = document.getElementById('qr-text').value.trim();
    
    if (!qrText) {
        resultContainer.innerHTML = '<div class="alert alert-warning">กรุณาป้อนข้อมูล QR Code</div>';
        return;
    }
    
    // ใช้ฟังก์ชัน onScanSuccess ที่มีอยู่แล้ว
    onScanSuccess(qrText);
});

// ฟังก์ชันประมวลผล QR code จากไฟล์รูปภาพ
function processQRFromFile() {
    const fileInput = document.getElementById('qr-file');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        resultContainer.innerHTML = '<div class="alert alert-warning">กรุณาเลือกไฟล์รูปภาพ</div>';
        return;
    }
    
    const file = fileInput.files[0];
    const fileReader = new FileReader();
    
    fileReader.onload = function(e) {
        const html5QrCode = new Html5Qrcode("video-container");
        
        html5QrCode.scanFile(file, true)
            .then(decodedText => {
                // ใช้ฟังก์ชัน onScanSuccess ที่มีอยู่แล้ว
                onScanSuccess(decodedText);
            })
            .catch(err => {
                resultContainer.innerHTML = `<div class="alert alert-danger">
                    ไม่พบ QR code ในรูปภาพ หรือไม่สามารถอ่านได้: ${err}
                </div>`;
            });
    };
    
    fileReader.onerror = function() {
        resultContainer.innerHTML = '<div class="alert alert-danger">เกิดข้อผิดพลาดในการอ่านไฟล์</div>';
    };
    
    fileReader.readAsDataURL(file);
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
