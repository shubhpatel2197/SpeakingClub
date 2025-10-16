// backend/test-server.ts

import express from 'express';
import cors from 'cors';
import os from 'os';

const app = express();
const PORT = 4000;

app.use(cors({ origin: '*' })); // Allow all for testing

app.get('/test', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  const addresses: string[] = [];
  
  for (const name of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  
  res.json({
    message: 'Server is reachable!',
    yourIPs: addresses,
    requestFrom: req.ip,
    headers: req.headers,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const networkInterfaces = os.networkInterfaces();
  console.log('\n🚀 Test server running on:');
  console.log(`   http://localhost:${PORT}/test`);
  
  for (const name of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`   http://${iface.address}:${PORT}/test`);
      }
    }
  }
  console.log('\n📱 Try opening these URLs on your mobile device\n');
});