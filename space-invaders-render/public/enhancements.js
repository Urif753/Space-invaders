(() => {
    "use strict";

    const shipCatalog = [
        { name: "CLÀSSICA", price: 0, speed: 4, lives: 3, fireRate: 1, color: "#00ff00", weapon: "Tret estàndard" },
        { name: "VELOX", price: 50, speed: 5.4, lives: 3, fireRate: 1, color: "#00ffcc", weapon: "Moviment +35%" },
        { name: "METRALLADORA", price: 120, speed: 4, lives: 2, fireRate: 2, color: "#ffcc33", weapon: "Cadència x2, 2 vides" },
        { name: "TITAN", price: 200, speed: 3.4, lives: 5, fireRate: 1, color: "#ff3333", weapon: "5 vides, velocitat -15%" },
        { name: "DOBLE CANÓ", price: 350, speed: 4, lives: 3, fireRate: 1, color: "#33ccff", weapon: "Dos làsers paral·lels" },
        { name: "ESCOPETA", price: 500, speed: 4, lives: 3, fireRate: 0.8, color: "#ff9900", weapon: "Tres trets en ventall" },
        { name: "TELEDIRIGIDA", price: 750, speed: 4, lives: 3, fireRate: 1, color: "#ff69b4", weapon: "Projectils que busquen aliens" },
        { name: "DESTRUCTORA", price: 1200, speed: 4, lives: 3, fireRate: 0.75, color: "#a855f7", weapon: "Raig làser perforant" }
    ];
    const colorCatalog = [
        { name: "BLANC", color: "#ffffff", price: 0 },
        { name: "OR", color: "#ffd700", price: 25 },
        { name: "PLATEJAT", color: "#c0c0c0", price: 20 },
        { name: "BLAU NEÓ", color: "#0080ff", price: 30 },
        { name: "PÚRPURA", color: "#ff00ff", price: 30 },
        { name: "VERMELL FLUO", color: "#ff0000", price: 25 }
    ];
    if (!Array.isArray(nausComprades)) nausComprades = [true];
    if (nausComprades.length === 4) {
        const previousShips = nausComprades;
        nausComprades = [
            previousShips[0], previousShips[1], false, previousShips[2],
            false, false, previousShips[3], false
        ];
        if (nauEquipada === 2) nauEquipada = 3;
        else if (nauEquipada === 3) nauEquipada = 6;
    } else {
        nausComprades = nausComprades.slice(0, 8);
    }
    while (nausComprades.length < 8) nausComprades.push(false);
    nausComprades[0] = true;
    if (!nausComprades[nauEquipada]) nauEquipada = 0;
    const html = (tag, className, text) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    };

    const middleColumn = document.querySelectorAll("#menu-principal .columna-menu")[1];
    const middleContent = middleColumn.querySelector(".scrollable-shop");
    const chatPanel = html("section", "retro-chat");
    chatPanel.innerHTML = `
        <header class="retro-chat-header">
            <span>COMUNICACIONS</span>
            <span id="chat-connection">DESCONECTAT</span>
        </header>
        <div id="chat-feed" class="retro-chat-feed" role="log" aria-live="polite"></div>
        <div class="retro-reactions" aria-label="Reaccions ràpides"></div>
        <form id="chat-form" class="retro-chat-form">
            <input id="chat-input" maxlength="240" autocomplete="off" placeholder="Escriu un missatge..." aria-label="Missatge">
            <button type="submit" aria-label="Enviar">➤</button>
        </form>
        <h3 class="retro-section-title">PARTIDES DE PONG EN DIRECTE</h3>
        <div id="spectator-list" class="spectator-list"><span class="retro-muted">Cap partida en directe.</span></div>
        <div id="social-status" class="social-status" role="status" aria-live="polite"></div>
    `;
    middleContent.style.display = "none";
    middleColumn.appendChild(chatPanel);

    const shopButton = html("button", "btn-accio shop-open", "OBRIR BOTIGA");
    shopButton.type = "button";
    shopButton.style.display = "none";
    document.getElementById("zona-usuari-actiu").insertBefore(
        shopButton,
        document.getElementById("zona-selector-joc")
    );

    const shopDialog = html("dialog", "retro-dialog retro-shop");
    shopDialog.setAttribute("aria-labelledby", "shop-title");
    shopDialog.innerHTML = `
        <div class="retro-window">
            <header class="retro-window-header">
                <div><p class="retro-kicker">SPACE INVADERS / ARMAMENT</p><h2 id="shop-title">BOTIGA DE NAUS</h2></div>
                <button type="button" class="retro-close" aria-label="Tancar botiga">X</button>
            </header>
            <div class="shop-tabs" role="tablist">
                <button type="button" class="shop-tab active" data-tab="ships">NAUS (8)</button>
                <button type="button" class="shop-tab" data-tab="pong">COLORS PONG</button>
            </div>
            <div id="shop-ships" class="ship-grid"></div>
            <div id="shop-pong-colors" class="pong-color-grid" hidden></div>
            <div class="retro-shop-footer">
                <span>MONEDES: <b id="shop-wallet">0</b></span>
                <button type="button" class="retro-close-button">TANCAR</button>
            </div>
            <div id="shop-status" class="social-status" role="status" aria-live="polite"></div>
        </div>
    `;
    document.body.appendChild(shopDialog);

    const spectatorBar = html("div", "spectator-bar");
    spectatorBar.innerHTML = `<span>👁 MODE ESPECTADOR · NOMÉS LECTURA</span><button type="button">SORTIR</button>`;
    document.getElementById("pantalla-retro").appendChild(spectatorBar);
    spectatorBar.hidden = true;
    let spectating = false;

    function renderShipCatalog() {
        const grid = document.getElementById("shop-ships");
        grid.replaceChildren();
        shipCatalog.forEach((ship, id) => {
            const card = html("article", "ship-card");
            const sprite = html("div", "ship-sprite", "▲");
            sprite.style.color = ship.color;
            sprite.setAttribute("aria-hidden", "true");
            const title = html("h3", "", ship.name);
            const price = html("p", "ship-price", id === 0 ? "GRATUÏTA" : `${ship.price.toLocaleString("ca")} MONEDES`);
            const weapon = html("p", "ship-weapon", ship.weapon);
            const stats = html("div", "ship-stats");
            [
                ["VELOCITAT", ship.speed, 6],
                ["CADÈNCIA", ship.fireRate, 2],
                ["VIDES", ship.lives, 5]
            ].forEach(([name, value, max]) => {
                const row = html("div", "ship-stat");
                const label = html("span", "", name);
                const meter = html("span", "ship-meter");
                const fill = html("span", "ship-meter-fill");
                fill.style.width = `${Math.max(8, Math.min(100, Number(value) / Number(max) * 100))}%`;
                fill.style.backgroundColor = ship.color;
                meter.appendChild(fill);
                row.append(label, meter);
                stats.appendChild(row);
            });
            const action = html("button", "ship-action");
            action.type = "button";
            action.addEventListener("click", () => comprarNau(id));
            card.append(sprite, title, price, weapon, stats, action);
            grid.appendChild(card);
        });
        updateShopCatalog();
    }

    function renderPongColors() {
        const grid = document.getElementById("shop-pong-colors");
        colorCatalog.forEach((item) => {
            const card = html("div", "pong-color-card");
            const chip = html("span", "pong-color-chip");
            chip.style.backgroundColor = item.color;
            const name = html("strong", "", item.name);
            const price = html("span", "retro-muted", item.price ? `${item.price} monedes` : "Gratis");
            const action = html("button", "ship-action");
            action.type = "button";
            action.addEventListener("click", () => gestionarColorPong(item));
            card.append(chip, name, price, action);
            grid.appendChild(card);
        });
        updateShopCatalog();
    }

    async function gestionarColorPong(item) {
        const status = document.getElementById("shop-status");
        if (!pongColoresComprados.includes(item.color) && monedes < item.price) {
            status.textContent = "No tens prou monedes.";
            return;
        }
        status.textContent = "Actualitzant color...";
        try {
            if (usuariSessio && !modoOffline) {
                const response = await fetch("/api/shop/pong-color", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("space_invaders_token")}`
                    },
                    body: JSON.stringify({ color: item.color })
                });
                const profile = await response.json();
                if (!response.ok) throw new Error(profile.error || "No s'ha pogut actualitzar el color.");
                monedes = profile.monedes;
                pongColoresComprados = profile.pongColoresComprados;
                pongColorEquipado = profile.pongColorEquipado;
            } else if (pongColoresComprados.includes(item.color)) {
                equiparColorPong(item.color);
            } else {
                comprarColorPong(item.color, item.price);
            }
            desarDadesUsuariAlServidor();
            status.textContent = `${item.name} equipat.`;
            updateShopCatalog();
        } catch (error) {
            status.textContent = error.message;
        }
    }

    function updateShopCatalog() {
        if (!document.getElementById("shop-ships")) return;
        document.getElementById("shop-wallet").textContent = String(monedes);
        document.querySelectorAll(".ship-card").forEach((card, id) => {
            const action = card.querySelector("button");
            const owned = Boolean(nausComprades[id]);
            action.textContent = id === nauEquipada ? "EQUIPADA" : owned ? "EQUIPAR" : "COMPRAR";
            action.disabled = id === nauEquipada || (!owned && monedes < shipCatalog[id].price);
            action.classList.toggle("owned", owned);
        });
        document.querySelectorAll(".pong-color-card").forEach((card, id) => {
            const item = colorCatalog[id];
            const action = card.querySelector("button");
            const owned = pongColoresComprados.includes(item.color);
            action.textContent = pongColorEquipado === item.color ? "EQUIPAT" : owned ? "EQUIPAR" : "COMPRAR";
            action.disabled = pongColorEquipado === item.color || (!owned && monedes < item.price);
            action.classList.toggle("owned", owned);
        });
    }

    async function comprarNau(shipId) {
        const status = document.getElementById("shop-status");
        const owned = Boolean(nausComprades[shipId]);
        if (!owned && monedes < shipCatalog[shipId].price) {
            status.textContent = "No tens prou monedes.";
            return;
        }
        status.textContent = "Actualitzant hangar...";
        try {
            if (usuariSessio && !modoOffline) {
                const response = await fetch("/api/shop/ship", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("space_invaders_token")}`
                    },
                    body: JSON.stringify({ shipId })
                });
                const profile = await response.json();
                if (!response.ok) throw new Error(profile.error || "No s'ha pogut actualitzar la nau.");
                monedes = profile.monedes;
                nauEquipada = profile.nauEquipada;
                nausComprades = profile.nausComprades;
            } else {
                if (!owned) monedes -= shipCatalog[shipId].price;
                nausComprades[shipId] = true;
                nauEquipada = shipId;
            }
            desarDadesUsuariAlServidor();
            status.textContent = owned ? `${shipCatalog[shipId].name} equipada.` : `${shipCatalog[shipId].name} comprada i equipada.`;
            renderShipCatalog();
        } catch (error) {
            status.textContent = error.message;
        }
    }

    function updateAuthControls() {
        const loggedIn = Boolean(usuariSessio);
        shopButton.style.display = loggedIn ? "block" : "none";
        const canChat = loggedIn && socket.connected && !modoOffline;
        document.getElementById("chat-connection").textContent = canChat ? "EN LÍNIA" : "DESCONECTAT";
        document.getElementById("chat-input").disabled = !canChat;
        document.querySelector("#chat-form button").disabled = !canChat;
        document.querySelectorAll(".retro-reactions button").forEach((button) => {
            button.disabled = !canChat;
        });
    }

    function addChatMessage(message) {
        const feed = document.getElementById("chat-feed");
        const row = html("div", `chat-line chat-${message.type || "player"}`);
        const name = html("strong", "chat-name", message.type === "system" ? "SISTEMA" : message.username || "JUGADOR");
        const text = html("span", "chat-text", message.text || "");
        row.append(name, text);
        feed.appendChild(row);
        while (feed.children.length > 60) feed.firstElementChild.remove();
        feed.scrollTop = feed.scrollHeight;
    }

    function renderLivePongRooms(rooms) {
        const list = document.getElementById("spectator-list");
        list.replaceChildren();
        if (!rooms.length) {
            list.appendChild(html("span", "retro-muted", "Cap partida en directe."));
            return;
        }
        rooms.forEach((room) => {
            const row = html("div", "spectator-row");
            const title = html("span", "spectator-players", `${room.players.join(" vs ")}${room.started ? " · EN JOC" : " · PREPARANT"}`);
            const watch = html("button", "spectator-watch", `👁 ${room.spectators}`);
            watch.type = "button";
            watch.title = "Visionar partida en directe";
            watch.disabled = !socket.connected || !usuariSessio;
            watch.addEventListener("click", () => {
                document.getElementById("social-status").textContent = "Connectant amb la partida...";
                socket.emit("watch_pong", { roomId: room.roomId });
            });
            row.append(title, watch);
            list.appendChild(row);
        });
    }

    function setSpectatorMode(data) {
        spectating = true;
        enPong = true;
        enDuel = false;
        pongRoomId = data.roomId;
        pongJugadorLocal = 1;
        pongKeys.up = false;
        pongKeys.down = false;
        pongPuntosLocal = data.state.puntos[1];
        pongPuntosOponent = data.state.puntos[2];
        pongPalJugador.y = data.state.pala1.y;
        pongPalOponent.y = data.state.pala2.y;
        pongBola = data.state.bola;
        document.getElementById("menu-principal").style.display = "none";
        document.getElementById("pantalla-retro").style.display = "block";
        document.getElementById("invadersCanvas").style.display = "none";
        document.getElementById("pongCanvas").style.display = "block";
        document.getElementById("marcador-duel").style.display = "none";
        document.getElementById("marcador-pong").style.display = "block";
        spectatorBar.hidden = false;
        cancelAnimationFrame(pongAnimId);
        pongLoop();
        document.getElementById("social-status").textContent = "";
    }

    function leaveSpectatorMode() {
        socket.emit("stop_watching");
        spectating = false;
        enPong = false;
        spectatorBar.hidden = true;
        cancelAnimationFrame(pongAnimId);
        document.getElementById("pantalla-retro").style.display = "none";
        document.getElementById("menu-principal").style.display = "flex";
        carregarRanquingGlobal();
    }

    document.querySelectorAll(".shop-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".shop-tab").forEach((item) => item.classList.toggle("active", item === tab));
            const ships = tab.dataset.tab === "ships";
            document.getElementById("shop-ships").hidden = !ships;
            document.getElementById("shop-pong-colors").hidden = ships;
        });
    });
    shopButton.addEventListener("click", () => shopDialog.showModal());
    shopDialog.querySelectorAll(".retro-close, .retro-close-button").forEach((button) => {
        button.addEventListener("click", () => shopDialog.close());
    });
    shopDialog.addEventListener("click", (event) => {
        if (event.target === shopDialog) shopDialog.close();
    });
    spectatorBar.querySelector("button").addEventListener("click", leaveSpectatorMode);
    document.querySelector(".retro-reactions").replaceChildren(
        ...["GG", "200 IQ", "😂", "👽"].map((reaction) => {
            const button = html("button", "", reaction);
            button.type = "button";
            button.addEventListener("click", () => socket.emit("chat_reaction", { reaction }));
            return button;
        })
    );
    document.getElementById("chat-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.getElementById("chat-input");
        const text = input.value.trim();
        if (!text || text.length > 240) return;
        socket.emit("chat_message", { text });
        input.value = "";
    });
    socket.on("chat_history", (messages) => {
        document.getElementById("chat-feed").replaceChildren();
        messages.slice(-60).forEach(addChatMessage);
    });
    socket.on("chat_message", addChatMessage);
    socket.on("chat_error", (message) => {
        document.getElementById("social-status").textContent = message;
    });
    socket.on("live_pong_rooms", renderLivePongRooms);
    socket.on("watch_error", (message) => {
        document.getElementById("social-status").textContent = message;
    });
    socket.on("pong_spectating", setSpectatorMode);
    socket.on("pong_estado", (data) => {
        if (!spectating) return;
        pongPalJugador.y = data.pala1.y;
        pongPalOponent.y = data.pala2.y;
        pongPuntosLocal = data.puntos[1];
        pongPuntosOponent = data.puntos[2];
    });
    socket.on("connect", () => {
        updateAuthControls();
        socket.emit("list_live_pong");
    });
    socket.on("disconnect", updateAuthControls);
    socket.on("duel_reward", (data) => {
        monedes = data.monedes;
        guardarDatosLocal();
        document.getElementById("menu-monedes").textContent = monedes;
        document.getElementById("joc-monedes").textContent = monedes;
        updateShopCatalog();
        document.getElementById("social-status").textContent = `+${data.reward} monedes per guanyar el duel!`;
    });
    socket.on("wallet_updated", (data) => {
        monedes = data.monedes;
        guardarDatosLocal();
        document.getElementById("menu-monedes").textContent = monedes;
        document.getElementById("joc-monedes").textContent = monedes;
        updateShopCatalog();
        document.getElementById("social-status").textContent = `+${data.reward} monedes per l'onada!`;
    });
    socket.on("wave_reward_denied", (data) => {
        document.getElementById("social-status").textContent = data.error;
    });
    socket.on("admin_ships_reset", (data) => {
        if (data.username !== usuariSessio) return;
        nauEquipada = data.nauEquipada;
        nausComprades = data.nausComprades;
        guardarDatosLocal();
        updateShopCatalog();
        const status = document.getElementById("shop-status");
        if (status) status.textContent = "Hangar reiniciat per l'administració.";
    });
    document.getElementById("admin-reset-ships").addEventListener("click", async () => {
        const username = document.getElementById("admin-player-select").value;
        if (!username || !confirm(`Vols reiniciar les naus de ${username}? Només conservarà la nau clàssica.`)) return;

        const button = document.getElementById("admin-reset-ships");
        const status = document.getElementById("admin-status");
        button.disabled = true;
        status.textContent = "Reiniciant naus...";
        try {
            const response = await fetch("/api/admin/reset-ships", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("space_invaders_token")}`
                },
                body: JSON.stringify({ username })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "No s'han pogut reiniciar les naus.");
            status.textContent = `Hangar de ${result.username} reiniciat correctament.`;
        } catch (error) {
            status.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });

    const previousMenuUpdate = actualitzarInterficieMenu;
    actualitzarInterficieMenu = function () {
        previousMenuUpdate();
        updateAuthControls();
        updateShopCatalog();
    };

    const previousPongUpdate = pongUpdate;
    pongUpdate = function () {
        if (spectating) return;
        previousPongUpdate();
    };

    let activeShip = 0;
    let nextShotAt = 0;
    let piercingHits = new Set();
    const previousCollision = checkCollision;
    checkCollision = function (first, second) {
        const hit = previousCollision(first, second);
        if (hit && first && first.piercing && aliens.includes(second)) piercingHits.add(first);
        return hit;
    };

    const previousGameUpdate = update;
    update = function () {
        const shooting = keys.space;
        keys.space = false;
        const coinsBefore = monedes;
        const aliensBefore = aliens.length;
        const duelBefore = enDuel;
        const boltsBefore = [...balesJugador];
        piercingHits = new Set();
        previousGameUpdate();

        if (monedes !== coinsBefore) {
            monedes = coinsBefore;
            document.getElementById("menu-monedes").textContent = monedes;
            document.getElementById("joc-monedes").textContent = monedes;
        }
        if (puntuacio > record) record = puntuacio;

        for (const bolt of boltsBefore) {
            if (!bolt.piercing || !piercingHits.has(bolt) || balesJugador.includes(bolt)) continue;
            bolt.piercedCount = (bolt.piercedCount || 0) + 1;
            if (bolt.piercedCount < 5 && bolt.y > 0) balesJugador.push(bolt);
        }

        for (const bolt of balesJugador) {
            if (bolt.sideSpeed) bolt.x += bolt.sideSpeed;
            if (bolt.target && activeShip === 6 && aliens.includes(bolt.target)) {
                const dx = bolt.target.x + bolt.target.width / 2 - bolt.x;
                bolt.x += Math.max(-2.2, Math.min(2.2, dx * 0.06));
            }
            if (bolt.maxRange && bolt.startY - bolt.y > bolt.maxRange) {
                const index = balesJugador.indexOf(bolt);
                if (index !== -1) balesJugador.splice(index, 1);
            }
        }

        const waveCleared = !duelBefore && aliensBefore > 0 && aliens.length === 55;
        if (waveCleared) {
            if (socket.connected && !modoOffline) {
                socket.emit("claim_wave_reward");
            } else {
                monedes += 7;
                guardarDatosLocal();
                document.getElementById("menu-monedes").textContent = monedes;
                document.getElementById("joc-monedes").textContent = monedes;
                document.getElementById("social-status").textContent = "+7 monedes per l'onada!";
                updateShopCatalog();
            }
        }

        const now = performance.now();
        const maxBolts = activeShip === 4 ? 4 : activeShip === 5 ? 6 : 5;
        if (shooting && now >= nextShotAt && balesJugador.length < maxBolts) {
            const centerX = player.x + player.width / 2 - 1.5;
            const bolt = (offset, options = {}) => ({
                x: centerX + offset,
                y: player.y,
                width: options.width || 3,
                height: 10,
                target: options.target || null,
                sideSpeed: options.sideSpeed || 0,
                piercing: Boolean(options.piercing),
                piercedCount: 0,
                startY: player.y,
                maxRange: options.maxRange || 0
            });
            if (activeShip === 4) {
                balesJugador.push(bolt(-6), bolt(3));
            } else if (activeShip === 5) {
                balesJugador.push(bolt(-7, { sideSpeed: -1.35, maxRange: 185 }));
                balesJugador.push(bolt(-1, { maxRange: 210 }));
                balesJugador.push(bolt(5, { sideSpeed: 1.35, maxRange: 185 }));
            } else if (activeShip === 6) {
                const target = aliens.reduce((nearest, alien) => {
                    if (!nearest) return alien;
                    const currentDistance = Math.abs(nearest.x - player.x);
                    return Math.abs(alien.x - player.x) < currentDistance ? alien : nearest;
                }, null);
                balesJugador.push(bolt(0, { target }));
            } else if (activeShip === 7) {
                balesJugador.push(bolt(0, { width: 7, piercing: true, maxRange: 380 }));
            } else {
                balesJugador.push(bolt(0));
            }
            ferSo(800, "square", 0.15, 0.05);
            nextShotAt = now + (activeShip === 2 ? 180 : activeShip === 5 ? 620 : activeShip === 7 ? 850 : 400);
        }
    };

    const previousStartGame = comencarPartida;
    comencarPartida = function (isDuel, ...args) {
        const equippedShip = nauEquipada;
        activeShip = isDuel ? 0 : equippedShip;
        nauEquipada = activeShip;
        nextShotAt = 0;
        const result = previousStartGame(isDuel, ...args);
        nauEquipada = equippedShip;
        const ship = shipCatalog[activeShip];
        player.speed = ship.speed;
        player.vides = ship.lives;
        player.color = ship.color;
        document.getElementById("joc-vides").textContent = player.vides;
        renderShipCatalog();
        return result;
    };

    socket.on("pong_fin", () => {
        if (spectating) {
            spectating = false;
            spectatorBar.hidden = true;
        }
    });
    const originalAlert = window.alert;
    window.alert = (message) => {
        if (spectating) {
            mostrarMissatgePantalla("PARTIDA FINALITZADA", String(message), 5);
            return;
        }
        originalAlert(message);
    };

    renderShipCatalog();
    renderPongColors();
    updateAuthControls();
    actualitzarInterficieMenu();
    setInterval(() => {
        updateAuthControls();
        if (usuariSessio && socket.connected && document.getElementById("menu-principal").style.display !== "none") {
            socket.emit("list_live_pong");
        }
    }, 8000);
})();
