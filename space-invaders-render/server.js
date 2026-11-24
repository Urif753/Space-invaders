const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const port = Number(process.env.PORT || 10000);
const jwtSecret = process.env.JWT_SECRET;
const databaseUrl = process.env.DATABASE_URL;
const adminUsername = "URIF753";

if (!jwtSecret || !databaseUrl) {
  throw new Error("Cal configurar JWT_SECRET i DATABASE_URL abans d'iniciar el servidor.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
});

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
const queues = { aliens: [], pong: [] };
const rooms = new Map();
const chatHistory = [];
const shipPrices = [0, 50, 120, 200, 350, 500, 750, 1200];
const pongColorPrices = new Map([
  ["#ffffff", 0], ["#ffd700", 25], ["#c0c0c0", 20],
  ["#0080ff", 30], ["#ff00ff", 30], ["#ff0000", 25]
]);
const quickReactions = new Set(["GG", "200 IQ", "😂", "👽"]);
const waveReward = 7;
const duelReward = 18;

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

function publicProfile(row) {
  const nausComprades = Array.isArray(row.naus_comprades) ? row.naus_comprades.slice(0, 8) : [true];
  while (nausComprades.length < 8) nausComprades.push(false);
  nausComprades[0] = true;
  return {
    username: row.username,
    record: row.record,
    monedes: row.monedes,
    nauEquipada: row.nau_equipada,
    nausComprades,
    pongDuelWins: row.pong_duel_wins,
    pongColoresComprados: row.pong_colores_comprados,
    pongColorEquipado: row.pong_color_equipado
  };
}

function publishChatMessage(message) {
  const entry = { ...message, at: Date.now() };
  chatHistory.push(entry);
  if (chatHistory.length > 100) chatHistory.shift();
  io.emit("chat_message", entry);
}

function livePongRooms() {
  return [...rooms.values()]
    .filter((room) => room.game === "pong" && !room.finished)
    .map((room) => ({
      roomId: room.id,
      players: room.names,
      started: room.started,
      spectators: room.spectators.size
    }));
}

function publishLivePongRooms() {
  io.emit("live_pong_rooms", livePongRooms());
}

function pongState(room) {
  return {
    bola: { ...room.ball, width: 8, height: 8 },
    puntos: { ...room.points },
    pala1: { y: room.paddles[1] },
    pala2: { y: room.paddles[2] }
  };
}

async function getProfile(username) {
  const result = await pool.query(
    `SELECT username, record, monedes, nau_equipada, naus_comprades,
            pong_duel_wins, pong_colores_comprados, pong_color_equipado
       FROM players WHERE username = $1`,
    [username]
  );
  return result.rows[0] || null;
}

function createToken(username) {
  return jwt.sign({ username }, jwtSecret, { expiresIn: "30d" });
}

function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    req.player = jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "La sessio ha caducat. Torna a iniciar sessio." });
  }
}

function requireAdmin(req, res, next) {
  if (req.player.username !== adminUsername) {
    return res.status(403).json({ error: "No tens permis per fer aquesta accio." });
  }
  return next();
}

function validateUsername(value) {
  return typeof value === "string" && /^[A-Z0-9_]{1,12}$/.test(value);
}

function validatePassword(value) {
  return typeof value === "string" && value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72;
}

function boundedInteger(value, fallback, max = 10000000) {
  return Number.isInteger(value) && value >= 0 && value <= max ? value : fallback;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/register", async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Les dades del compte no son valides." });
  }
  const username = typeof body.username === "string" ? body.username.trim().toUpperCase() : "";
  const { password } = body;
  if (!validateUsername(username) || !validatePassword(password)) {
    return res.status(400).json({ error: "El nom ha de tenir fins a 12 caracters i la contrasenya entre 8 i 72 bytes." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO players (username, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (username) DO NOTHING
       RETURNING username`,
      [username, passwordHash]
    );
    if (!result.rowCount) return res.status(409).json({ error: "Aquest nom d'usuari ja existeix." });
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("No s'ha pogut crear el compte:", error);
    return res.status(500).json({ error: "No s'ha pogut crear el compte." });
  }
});

app.post("/api/login", async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Les dades d'inici de sessio no son valides." });
  }
  const username = typeof body.username === "string" ? body.username.trim().toUpperCase() : "";
  const { password } = body;
  if (!validateUsername(username) || !validatePassword(password)) {
    return res.status(400).json({ error: "Nom d'usuari o contrasenya no valids." });
  }

  try {
    const result = await pool.query(
      `SELECT username, password_hash, record, monedes, nau_equipada, naus_comprades,
              pong_duel_wins, pong_colores_comprados, pong_color_equipado
         FROM players WHERE username = $1`,
      [username]
    );
    const player = result.rows[0];
    if (!player || !(await bcrypt.compare(password, player.password_hash))) {
      return res.status(401).json({ error: "Usuari o contrasenya incorrectes." });
    }
    return res.json({ token: createToken(username), ...publicProfile(player) });
  } catch (error) {
    console.error("No s'ha pogut iniciar sessio:", error);
    return res.status(500).json({ error: "No s'ha pogut iniciar sessio." });
  }
});

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const player = await getProfile(req.player.username);
    if (!player) return res.status(401).json({ error: "El compte ja no existeix." });
    return res.json({ user: publicProfile(player) });
  } catch (error) {
    console.error("No s'ha pogut carregar el perfil:", error);
    return res.status(500).json({ error: "No s'ha pogut carregar el perfil." });
  }
});

app.get("/api/admin/players", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query("SELECT username, monedes FROM players ORDER BY username ASC");
    const onlineUsers = new Set(
      [...io.sockets.sockets.values()].map((socket) => socket.data.username)
    );
    return res.json(result.rows.map((player) => ({
      username: player.username,
      monedes: player.monedes,
      online: onlineUsers.has(player.username)
    })));
  } catch (error) {
    console.error("No s'han pogut carregar els jugadors per a l'administracio:", error);
    return res.status(500).json({ error: "No s'han pogut carregar els jugadors." });
  }
});

app.post("/api/admin/reset-coins", requireAuth, requireAdmin, async (req, res) => {
  const username = typeof req.body?.username === "string"
    ? req.body.username.trim().toUpperCase()
    : "";
  if (!validateUsername(username)) {
    return res.status(400).json({ error: "El nom del jugador no es valid." });
  }

  try {
    const result = await pool.query(
      "UPDATE players SET monedes = 0 WHERE username = $1 RETURNING username",
      [username]
    );
    if (!result.rowCount) return res.status(404).json({ error: "No s'ha trobat aquest jugador." });

    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.username === username) {
        socket.emit("admin_coins_reset", { username, monedes: 0 });
      }
    }

    return res.json({ ok: true, username, monedes: 0 });
  } catch (error) {
    console.error("No s'han pogut reiniciar les monedes del jugador:", error);
    return res.status(500).json({ error: "No s'han pogut reiniciar les monedes." });
  }
});

app.post("/api/admin/reset-ships", requireAuth, requireAdmin, async (req, res) => {
  const username = typeof req.body?.username === "string"
    ? req.body.username.trim().toUpperCase()
    : "";
  if (!validateUsername(username)) {
    return res.status(400).json({ error: "El nom del jugador no es valid." });
  }

  const nausComprades = [true, false, false, false, false, false, false, false];
  try {
    const result = await pool.query(
      `UPDATE players
          SET nau_equipada = 0,
              naus_comprades = '[true, false, false, false, false, false, false, false]'::jsonb
        WHERE username = $1
        RETURNING username`,
      [username]
    );
    if (!result.rowCount) return res.status(404).json({ error: "No s'ha trobat aquest jugador." });

    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.username === username) {
        socket.emit("admin_ships_reset", { username, nauEquipada: 0, nausComprades });
      }
    }

    return res.json({ ok: true, username, nauEquipada: 0, nausComprades });
  } catch (error) {
    console.error("No s'han pogut reiniciar les naus del jugador:", error);
    return res.status(500).json({ error: "No s'han pogut reiniciar les naus." });
  }
});

app.post("/api/save-user", requireAuth, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Les dades del perfil no son valides." });
  }
  const record = boundedInteger(body.record, -1);
  const colorEquipat = body.pongColorEquipado;
  if (record < 0 || typeof colorEquipat !== "string" || !pongColorPrices.has(colorEquipat)) {
    return res.status(400).json({ error: "Les dades del perfil no son valides." });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const previous = await client.query(
      "SELECT record FROM players WHERE username = $1 FOR UPDATE",
      [req.player.username]
    );
    if (!previous.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No s'ha trobat el compte." });
    }

    await client.query(
      `UPDATE players
          SET record = GREATEST(record, $2),
              pong_color_equipado = CASE
                WHEN pong_colores_comprados ? $3 THEN $3 ELSE pong_color_equipado
              END
        WHERE username = $1`,
      [req.player.username, record, colorEquipat]
    );
    await client.query("COMMIT");
    if (record > previous.rows[0].record) {
      publishChatMessage({
        type: "system",
        text: `${req.player.username} ha superat el seu rècord: ${record} punts.`
      });
    }
    return res.json({ ok: true });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("No s'ha pogut desfer el desat del perfil:", rollbackError);
    }
    console.error("No s'han pogut desar les dades:", error);
    return res.status(500).json({ error: "No s'han pogut desar les dades." });
  } finally {
    if (client) client.release();
  }
});

app.post("/api/shop/ship", requireAuth, async (req, res) => {
  const shipId = boundedInteger(req.body?.shipId, -1, shipPrices.length - 1);
  if (shipId < 0) return res.status(400).json({ error: "La nau seleccionada no es valida." });

  const price = shipPrices[shipId];
  try {
    const result = await pool.query(
      `UPDATE players
          SET monedes = CASE WHEN naus_comprades ->> ($2::integer) = 'true' THEN monedes ELSE monedes - $3 END,
              naus_comprades = jsonb_set(naus_comprades, ARRAY[($2::integer)::text], 'true'::jsonb, true),
              nau_equipada = $2
        WHERE username = $1
          AND (naus_comprades ->> ($2::integer) = 'true' OR monedes >= $3)
        RETURNING username, record, monedes, nau_equipada, naus_comprades,
                  pong_duel_wins, pong_colores_comprados, pong_color_equipado`,
      [req.player.username, shipId, price]
    );
    if (result.rowCount) return res.json(publicProfile(result.rows[0]));

    const player = await pool.query(
      "SELECT username FROM players WHERE username = $1",
      [req.player.username]
    );
    if (!player.rowCount) return res.status(404).json({ error: "No s'ha trobat el compte." });
    return res.status(409).json({ error: "No tens prou monedes per comprar aquesta nau." });
  } catch (error) {
    console.error("No s'ha pogut comprar o equipar la nau:", error);
    return res.status(500).json({ error: "No s'ha pogut comprar o equipar la nau." });
  }
});

app.post("/api/shop/pong-color", requireAuth, async (req, res) => {
  const color = req.body?.color;
  if (typeof color !== "string" || !pongColorPrices.has(color)) {
    return res.status(400).json({ error: "El color seleccionat no es valid." });
  }
  const price = pongColorPrices.get(color);

  try {
    const result = await pool.query(
      `UPDATE players
          SET monedes = CASE WHEN pong_colores_comprados ? $2 THEN monedes ELSE monedes - $3 END,
              pong_colores_comprados = CASE
                WHEN pong_colores_comprados ? $2 THEN pong_colores_comprados
                ELSE pong_colores_comprados || to_jsonb($2::text)
              END,
              pong_color_equipado = $2
        WHERE username = $1
          AND (pong_colores_comprados ? $2 OR monedes >= $3)
        RETURNING username, record, monedes, nau_equipada, naus_comprades,
                  pong_duel_wins, pong_colores_comprados, pong_color_equipado`,
      [req.player.username, color, price]
    );
    if (result.rowCount) return res.json(publicProfile(result.rows[0]));

    const player = await pool.query("SELECT username FROM players WHERE username = $1", [req.player.username]);
    if (!player.rowCount) return res.status(404).json({ error: "No s'ha trobat el compte." });
    return res.status(409).json({ error: "No tens prou monedes per comprar aquest color." });
  } catch (error) {
    console.error("No s'ha pogut comprar o equipar el color de Pong:", error);
    return res.status(500).json({ error: "No s'ha pogut comprar o equipar el color." });
  }
});

app.get("/api/ranking", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT username, record FROM players ORDER BY record DESC, username ASC LIMIT 20"
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("No s'ha pogut carregar el ranking:", error);
    return res.status(500).json({ error: "No s'ha pogut carregar el ranking." });
  }
});

app.get("/api/ranking-pong", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT username, pong_duel_wins AS \"duelsWins\" FROM players ORDER BY pong_duel_wins DESC, username ASC LIMIT 20"
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("No s'ha pogut carregar el ranking de Pong:", error);
    return res.status(500).json({ error: "No s'ha pogut carregar el ranking." });
  }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

function removeFromQueue(socket) {
  for (const queue of Object.values(queues)) {
    const index = queue.indexOf(socket.id);
    if (index !== -1) queue.splice(index, 1);
  }
}

function queuePlayer(socket, game) {
  removeFromQueue(socket);
  if ([...rooms.values()].some((room) => room.players.includes(socket.id))) return;
  let stoppedWatching = false;
  for (const room of rooms.values()) {
    if (room.spectators.delete(socket.id)) {
      socket.leave(room.id);
      stoppedWatching = true;
    }
  }
  if (stoppedWatching) publishLivePongRooms();
  const queue = queues[game];
  const opponentIndex = queue.findIndex((id) => {
    const candidate = io.sockets.sockets.get(id);
    return candidate && candidate.data.username !== socket.data.username;
  });
  if (opponentIndex === -1) {
    queue.push(socket.id);
    return;
  }

  const opponentId = queue.splice(opponentIndex, 1)[0];
  const opponent = io.sockets.sockets.get(opponentId);
  if (!opponent) return queuePlayer(socket, game);

  const roomId = crypto.randomUUID();
  const startAt = Date.now() + 5000;
  const room = {
    id: roomId,
    game,
    players: [opponent.id, socket.id],
    names: [opponent.data.username, socket.data.username],
    spectators: new Set(),
    paddles: { 1: 160, 2: 160 },
    ball: { x: 300, y: 200, vx: 0, vy: 0 },
    startAt,
    started: false,
    points: { 1: 0, 2: 0 },
    timer: null,
    finished: false
  };
  rooms.set(roomId, room);
  opponent.join(roomId);
  socket.join(roomId);

  if (game === "aliens") {
    io.to(roomId).emit("duel_iniciat", {
      roomId,
      jugador1: room.names[0],
      jugador2: room.names[1],
      startAt
    });
  } else {
    opponent.emit("pong_encontrado", { roomId, jugador: 1, oponente: room.names[1], startAt });
    socket.emit("pong_encontrado", { roomId, jugador: 2, oponente: room.names[0], startAt });
    room.timer = setInterval(() => updatePong(room), 30);
    publishLivePongRooms();
  }
  publishChatMessage({
    type: "system",
    text: `Nova partida ${game === "pong" ? "de Pong" : "d'Invaders"}: ${room.names.join(" vs ")}.`
  });
}

function finishRoom(room, event, payload) {
  if (room.finished) return;
  room.finished = true;
  if (room.timer) clearInterval(room.timer);
  io.to(room.id).emit(event, payload);
  rooms.delete(room.id);
  const winner = payload?.guanyador || payload?.ganador;
  if (typeof winner === "string" && room.names.includes(winner)) {
    pool.query(
      `UPDATE players
          SET monedes = monedes + $2,
              pong_duel_wins = pong_duel_wins + CASE WHEN $3 THEN 1 ELSE 0 END
        WHERE username = $1
        RETURNING monedes`,
      [winner, duelReward, room.game === "pong"]
    ).then((result) => {
      if (!result.rowCount) return;
      for (const playerSocket of io.sockets.sockets.values()) {
        if (playerSocket.data.username === winner) {
          playerSocket.emit("duel_reward", { monedes: result.rows[0].monedes, reward: duelReward });
        }
      }
    }).catch((error) => console.error("No s'ha pogut lliurar la recompensa del duel:", error));
    publishChatMessage({ type: "system", text: `${winner} ha guanyat el duel i rep ${duelReward} monedes.` });
  } else {
    publishChatMessage({ type: "system", text: "La partida ha acabat sense guanyador." });
  }
  for (const id of room.players) {
    const playerSocket = io.sockets.sockets.get(id);
    if (playerSocket) playerSocket.leave(room.id);
  }
  for (const id of room.spectators) {
    const spectatorSocket = io.sockets.sockets.get(id);
    if (spectatorSocket) spectatorSocket.leave(room.id);
  }
  publishLivePongRooms();
}

function updatePong(room) {
  if (room.finished) return;
  const ball = room.ball;
  if (Date.now() < room.startAt) return;
  if (!room.started) {
    room.started = true;
    ball.vx = Math.random() < 0.5 ? -5 : 5;
    ball.vy = 3;
    publishLivePongRooms();
  }
  ball.x += ball.vx;
  ball.y += ball.vy;
  if (ball.y <= 4 || ball.y >= 396) ball.vy *= -1;

  for (const [side, paddleX] of [[1, 18], [2, 582]]) {
    const paddleY = room.paddles[side];
    if ((side === 1 && ball.vx < 0 && ball.x <= paddleX + 4) ||
        (side === 2 && ball.vx > 0 && ball.x >= paddleX - 4)) {
      if (ball.y >= paddleY && ball.y <= paddleY + 80) {
        ball.vx = -Math.sign(ball.vx) * Math.min(Math.abs(ball.vx) * 1.03, 9);
        ball.vy = Math.max(-7, Math.min(7, (ball.y - (paddleY + 40)) / 7));
      }
    }
  }

  let scorer = null;
  if (ball.x < 0) scorer = 2;
  if (ball.x > 600) scorer = 1;
  if (scorer) {
    room.points[scorer] += 1;
    ball.x = 300;
    ball.y = 200;
    ball.vx = scorer === 1 ? 5 : -5;
    ball.vy = Math.random() * 4 - 2;
    if (room.points[scorer] >= 5) {
      const winner = room.names[scorer - 1];
      finishRoom(room, "pong_fin", { ganador: winner });
      return;
    }
  }

  io.to(room.id).emit("pong_estado", pongState(room));
}

io.use((socket, next) => {
  try {
    const claims = jwt.verify(socket.handshake.auth?.token || "", jwtSecret);
    if (typeof claims.username !== "string") return next(new Error("Cal iniciar sessio."));
    socket.data.username = claims.username;
    return next();
  } catch {
    return next(new Error("Sessio no valida. Torna a iniciar sessio."));
  }
});

io.on("connection", (socket) => {
  socket.emit("chat_history", chatHistory);
  socket.emit("live_pong_rooms", livePongRooms());

  socket.on("chat_message", (data = {}) => {
    if (!data || typeof data.text !== "string") return;
    const text = data.text.trim();
    const now = Date.now();
    if (!text || text.length > 240) return socket.emit("chat_error", "El missatge ha de tenir entre 1 i 240 caracters.");
    if (now - (socket.data.lastChatAt || 0) < 900) {
      return socket.emit("chat_error", "Espera un moment abans d'enviar un altre missatge.");
    }
    socket.data.lastChatAt = now;
    publishChatMessage({ type: "player", username: socket.data.username, text });
  });

  socket.on("chat_reaction", (data = {}) => {
    if (!data || !quickReactions.has(data.reaction)) return;
    const now = Date.now();
    if (now - (socket.data.lastChatAt || 0) < 900) return;
    socket.data.lastChatAt = now;
    publishChatMessage({
      type: "reaction",
      username: socket.data.username,
      text: data.reaction
    });
  });

  socket.on("list_live_pong", () => socket.emit("live_pong_rooms", livePongRooms()));

  socket.on("watch_pong", (data = {}) => {
    if (!data || typeof data.roomId !== "string") return;
    if ([...rooms.values()].some((room) => room.players.includes(socket.id))) {
      return socket.emit("watch_error", "No pots visionar una partida mentre estàs jugant.");
    }
    const room = rooms.get(data.roomId);
    if (!room || room.game !== "pong" || room.finished || room.players.includes(socket.id)) {
      return socket.emit("watch_error", "Aquesta partida ja no es pot visionar.");
    }
    for (const currentRoom of rooms.values()) {
      if (currentRoom.spectators.delete(socket.id)) socket.leave(currentRoom.id);
    }
    room.spectators.add(socket.id);
    socket.join(room.id);
    socket.emit("pong_spectating", {
      roomId: room.id,
      players: room.names,
      state: pongState(room)
    });
    publishLivePongRooms();
  });

  socket.on("stop_watching", () => {
    for (const room of rooms.values()) {
      if (!room.spectators.delete(socket.id)) continue;
      socket.leave(room.id);
    }
    publishLivePongRooms();
  });

  socket.on("claim_wave_reward", async () => {
    const now = Date.now();
    if (now - (socket.data.lastWaveClaimAt || 0) < 10000) return;
    socket.data.lastWaveClaimAt = now;
    try {
      const result = await pool.query(
        `UPDATE players
            SET monedes = monedes + $2, last_wave_reward_at = NOW()
          WHERE username = $1
            AND (last_wave_reward_at IS NULL OR last_wave_reward_at < NOW() - INTERVAL '15 seconds')
          RETURNING monedes`,
        [socket.data.username, waveReward]
      );
      if (!result.rowCount) {
        return socket.emit("wave_reward_denied", { error: "Espera uns segons abans de reclamar una altra recompensa." });
      }
      socket.emit("wallet_updated", { monedes: result.rows[0].monedes, reward: waveReward });
    } catch (error) {
      console.error("No s'ha pogut lliurar la recompensa de l'onada:", error);
      socket.emit("wave_reward_denied", { error: "No s'ha pogut lliurar la recompensa." });
    }
  });

  socket.on("buscar_duel", () => queuePlayer(socket, "aliens"));
  socket.on("buscar_pong", () => queuePlayer(socket, "pong"));
  socket.on("cancelar_cerca", () => removeFromQueue(socket));
  socket.on("cancelar_pong_search", () => removeFromQueue(socket));

  socket.on("moviment_jugador", (data = {}) => {
    if (!data || typeof data !== "object") return;
    const room = rooms.get(data.roomId);
    if (room?.game === "aliens" && room.players.includes(socket.id) &&
        Number.isFinite(data.x) && data.x >= 0 && data.x <= 570) {
      socket.to(room.id).emit("moviment_oponent", {
        x: data.x,
        color: typeof data.color === "string" && /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : "#00ff00"
      });
    }
  });

  socket.on("onada_completada", (data = {}) => {
    if (!data || typeof data !== "object") return;
    const room = rooms.get(data.roomId);
    if (room?.game === "aliens" && room.players.includes(socket.id)) {
      const winner = data.username === socket.data.username
        ? socket.data.username
        : room.names.find((name) => name !== socket.data.username);
      finishRoom(room, "fi_del_duel", { guanyador: winner });
    }
  });

  socket.on("pong_movimiento", (data = {}) => {
    if (!data || typeof data !== "object") return;
    const room = rooms.get(data.roomId);
    if (!room || room.game !== "pong") return;
    const playerIndex = room.players.indexOf(socket.id);
    if (playerIndex === -1 || !Number.isFinite(data.pala_y)) return;
    room.paddles[playerIndex + 1] = Math.max(0, Math.min(320, data.pala_y));
  });

  socket.on("disconnect", () => {
    removeFromQueue(socket);
    for (const room of rooms.values()) {
      if (room.spectators.delete(socket.id)) publishLivePongRooms();
    }
    for (const room of rooms.values()) {
      const playerIndex = room.players.indexOf(socket.id);
      if (playerIndex === -1) continue;
      const winner = room.names[1 - playerIndex];
      finishRoom(room, room.game === "pong" ? "pong_fin" : "fi_del_duel", {
        ganador: winner,
        guanyador: winner
      });
    }
  });
});

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      username VARCHAR(12) PRIMARY KEY,
      password_hash TEXT NOT NULL,
      record INTEGER NOT NULL DEFAULT 0,
      monedes INTEGER NOT NULL DEFAULT 0,
      nau_equipada INTEGER NOT NULL DEFAULT 0,
      naus_comprades JSONB NOT NULL DEFAULT '[true, false, false, false, false, false, false, false]'::jsonb,
      pong_duel_wins INTEGER NOT NULL DEFAULT 0,
      pong_colores_comprados JSONB NOT NULL DEFAULT '["#ffffff"]'::jsonb,
      pong_color_equipado TEXT NOT NULL DEFAULT '#ffffff',
      last_wave_reward_at TIMESTAMPTZ
    )
  `);
  await pool.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS last_wave_reward_at TIMESTAMPTZ");
  await pool.query(
    `ALTER TABLE players
       ALTER COLUMN naus_comprades
       SET DEFAULT '[true, false, false, false, false, false, false, false]'::jsonb`
  );
  await pool.query(
    `UPDATE players
        SET naus_comprades = jsonb_build_array(
              COALESCE(naus_comprades -> 0, 'true'::jsonb),
              COALESCE(naus_comprades -> 1, 'false'::jsonb),
              'false'::jsonb,
              COALESCE(naus_comprades -> 2, 'false'::jsonb),
              'false'::jsonb,
              'false'::jsonb,
              COALESCE(naus_comprades -> 3, 'false'::jsonb),
              'false'::jsonb
            ),
            nau_equipada = CASE nau_equipada WHEN 2 THEN 3 WHEN 3 THEN 6 ELSE nau_equipada END
      WHERE jsonb_typeof(naus_comprades) = 'array'
        AND jsonb_array_length(naus_comprades) = 4`
  );
  await pool.query(
    `UPDATE players AS player
        SET naus_comprades = (
          SELECT jsonb_agg(COALESCE(player.naus_comprades -> ship_index, 'false'::jsonb) ORDER BY ship_index)
            FROM generate_series(0, 7) AS indices(ship_index)
        )
      WHERE jsonb_typeof(naus_comprades) = 'array'
        AND jsonb_array_length(naus_comprades) < 8`
  );
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Servidor actiu al port ${port}`);
  });
}

start().catch((error) => {
  console.error("No s'ha pogut iniciar el servidor:", error);
  process.exitCode = 1;
});
