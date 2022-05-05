import { User } from "./src/services/user/user";
import express, { Application, Request, Response } from "express";
import * as io from "socket.io";
import { Server } from "http";

import { RoomsService } from "./src/services/rooms/rooms-service";

const path = require("path");

const port = 3000;
const app: Application = express();
const http = new Server(app);
const socketio = new io.Server(http);

const roomsService = new RoomsService();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// TODO: Implement start returning the spotify
// TODO: Create event that return when users join the room
// TODO: return the points after the stop

socketio.on("connection", (socket) => {
  console.log("User connected root");

  socket.on("create-room", (roomName, userName, steps, cb) => {
    console.log("roomName", roomName);
    console.log("userName", userName);
    console.log("steps", steps);
    console.log("cb", cb);
    try {
      const user = new User(userName, socket.id);
      const room = roomsService.getRoom(roomName);
      if (room) {
        cb("room already exists");
      } else {
        const newRoom = roomsService.createRoom(steps, user, roomName);
        newRoom.then((roomElement) => {
          socket.join(roomName);
          cb(roomName);
          console.log(userName, "created", roomName);
        });
      }
    } catch (error) {
      cb(error);
    }
  });

  socket.on("join-room", (roomName, userName, cb) => {
    console.log("roomName", roomName);
    console.log("userName", userName);
    console.log("cb", cb);
    try {
      const user = new User(userName, socket.id);
      const room = roomsService.getRoom(roomName);
      if (room) {
        room.addPlayer(user);
        socket.join(roomName);
        cb(roomName);
        console.log(userName, "entered room", roomName);
      } else {
        cb("room dos not exist");
      }
    } catch (error) {
      cb(error);
    }
  });

  socket.on("stop", (cb) => {
    console.log(cb);
    try {
      const room = roomsService.getRoomsByUserId(socket.id);
      const user = room.findPlayerById(socket.id);
      socket
        .to(room.name)
        .emit("propagate-stop", user.name + " stopped the room");
      cb("stopped");
    } catch (error) {
      cb(error);
    }
  });

  socket.on("start", (callback) => {
    console.log(callback);
    try {
      const room = roomsService.getRoomsByUserId(socket.id);

      socket.to(room.name).emit("propagate-start", room.trackList);
      callback("started");
    } catch (error) {
      callback(error);
    }
  });

  // socket.on("start");
});

// GET: / - return an HTML for intern tests
app.get("/", async (req: Request, res: Response) => {
  // Includes the user on socketio server
  // socketio.emit("user", "User connected test");

  res.sendFile(path.join(__dirname, "index.html"));
});

// POST: /api/exit-room - remove an user from a room
// Idea: not only the user can leave
// but also the room owner can remove the user
app.post("/api/exit-room", async (req: Request, res: Response) => {
  let body = req.body;

  let room = roomsService.getRoom(body.roomId);

  if (room) {
    try {
      room.removePlayer(body.user);
      res.status(200);
    } catch (error) {
      res.send("Player not found");
      res.status(404);
    }
  } else {
    res.send("Room not found");
    res.status(404);
  }
});

// POST: /api/restart-room - Reset the room state and create a new Tracklist
app.post("/api/restart-room", async (req: Request, res: Response) => {
  let body = req.body;

  let room = await roomsService.restartRoom(body.roomId);

  if (room) {
    res.send(room.toJSON());
    res.status(200);
  } else {
    res.send("Room not found");
    res.status(404);
  }
});

// GET: /callback - Callback from the payment
app.get("/callback", async (req: Request, res: Response) => {
  console.log(req, res);
});

// POST: /api/test-websocket - Throw a message to all clients
app.post("/api/test-websocket", (req: Request, res: Response) => {
  const body = req.body;

  socketio.sockets.emit("message", body.message);

  res.send("Message sent");
});

http.listen(port, (): void => {
  console.log(
    `Server started, listening on port ${port}.\nAwait some seconds to start the Spotify instance...`
  );
});
