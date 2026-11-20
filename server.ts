import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { setIo, memberChannel, roomChannel } from "./src/engine/broadcaster";
import { boot } from "./src/engine/runtime";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

async function main() {
  await boot();
  const app = next({ dev });
  const handle = app.getRequestHandler();
  await app.prepare();

  const http = createServer((req, res) => handle(req, res));
  const io = new Server(http, { cors: { origin: false } });
  setIo(io);
  io.on("connection", (socket) => {
    socket.on("join", ({ roomId, memberId }: { roomId?: string; memberId?: string }) => {
      if (typeof roomId === "string") socket.join(roomChannel(roomId));
      if (typeof memberId === "string") socket.join(memberChannel(memberId));
    });
  });

  http.listen(port, () => console.log(`> ready on http://localhost:${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
