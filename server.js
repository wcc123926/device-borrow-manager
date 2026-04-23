const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'devices.json');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { devices: [], nextId: 1 };
  }
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

function writeData(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/devices', (req, res) => {
  const data = readData();
  let devices = data.devices;

  const status = req.query.status;
  const borrower = req.query.borrower;
  const keyword = req.query.keyword;

  if (status && status !== 'all') {
    devices = devices.filter(d => d.status === status);
  }

  if (borrower && borrower !== 'all') {
    devices = devices.filter(d => d.borrower === borrower);
  }

  if (keyword) {
    const lowerKeyword = keyword.toLowerCase();
    devices = devices.filter(d =>
      d.name.toLowerCase().includes(lowerKeyword) ||
      d.code.toLowerCase().includes(lowerKeyword) ||
      (d.remark && d.remark.toLowerCase().includes(lowerKeyword))
    );
  }

  res.json(devices);
});

app.get('/api/devices/stats', (req, res) => {
  const data = readData();
  const devices = data.devices;

  const total = devices.length;
  const available = devices.filter(d => d.status === '可用').length;
  const borrowed = devices.filter(d => d.status === '已借出').length;
  const overdue = devices.filter(d => {
    if (d.status !== '已借出' || !d.dueTime) return false;
    const dueDate = new Date(d.dueTime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }).length;

  const borrowers = [...new Set(devices.filter(d => d.borrower).map(d => d.borrower))];

  res.json({ total, available, borrowed, overdue, borrowers });
});

app.get('/api/devices/borrowers', (req, res) => {
  const data = readData();
  const borrowers = [...new Set(data.devices.filter(d => d.borrower).map(d => d.borrower))];
  res.json(borrowers);
});

app.get('/api/devices/:id', (req, res) => {
  const data = readData();
  const device = data.devices.find(d => d.id === parseInt(req.params.id));
  
  if (!device) {
    return res.status(404).json({ error: '设备不存在' });
  }
  
  res.json(device);
});

app.post('/api/devices', (req, res) => {
  const data = readData();
  const now = new Date().toISOString();
  
  const newDevice = {
    id: data.nextId,
    name: req.body.name,
    code: req.body.code,
    status: '可用',
    borrower: null,
    borrowTime: null,
    dueTime: null,
    remark: req.body.remark || null,
    createdAt: now,
    updatedAt: now
  };

  data.devices.push(newDevice);
  data.nextId++;
  writeData(data);
  
  res.status(201).json(newDevice);
});

app.put('/api/devices/:id', (req, res) => {
  const data = readData();
  const index = data.devices.findIndex(d => d.id === parseInt(req.params.id));
  
  if (index === -1) {
    return res.status(404).json({ error: '设备不存在' });
  }

  const device = data.devices[index];
  const now = new Date().toISOString();

  if (req.body.name !== undefined) device.name = req.body.name;
  if (req.body.code !== undefined) device.code = req.body.code;
  if (req.body.remark !== undefined) device.remark = req.body.remark;

  if (req.body.action === 'borrow') {
    device.status = '已借出';
    device.borrower = req.body.borrower;
    device.borrowTime = now;
    device.dueTime = req.body.dueTime;
  } else if (req.body.action === 'return') {
    device.status = '可用';
    device.borrower = null;
    device.borrowTime = null;
    device.dueTime = null;
  }

  device.updatedAt = now;
  writeData(data);
  
  res.json(device);
});

app.delete('/api/devices/:id', (req, res) => {
  const data = readData();
  const index = data.devices.findIndex(d => d.id === parseInt(req.params.id));
  
  if (index === -1) {
    return res.status(404).json({ error: '设备不存在' });
  }

  data.devices.splice(index, 1);
  writeData(data);
  
  res.json({ message: '删除成功' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
