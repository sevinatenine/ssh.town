import { Screen, Box, Textarea, Text } from "@unblessed/node";

import { resolveUser } from "./auth.js"
import { makeTTY } from "./ui.js";
import chalk from "chalk";
import { getDateTimeString } from "./utils.js";

import db from "./dataManager.js";

import { getRoom, getArea, getSpawn } from "./rooms.js";

var messageBoxHeight = 5;
const placeholderText = 'Press `t` to chat.';

function startUI(stream, pty, username, events) {
    let screen, topbar, topbarRight, sidebar, main, right, info, messageBox, bottomText;
    db.users[username] ??= {};
    const user = db.users[username];

    const tty = makeTTY(stream, pty);

    screen = new Screen({
        input: tty,
        output: tty,
        terminal: pty.term || "xterm-256color",
        smartCSR: true,
        dockBorders: true,
        title: "ssh.town",
    });

    const TOPBAR_H = 3;

    topbar = new Box({
        parent: screen,
        top: 0,
        left: 0,
        width: "100%-1",
        height: TOPBAR_H,
        border: { type: "line" },
        content: chalk.blue("ssh.town"),
        tags: true,
    });

    var time = getDateTimeString();

    topbarRight = new Box({
        parent: topbar,
        top: 0,
        right: 0,
        width: time.length,
        height: 1,
        content: time,
    });

    sidebar = new Box({
        parent: screen,
        top: TOPBAR_H - 1,
        left: 0,
        width: "20%",
        height: `100%-${TOPBAR_H - 2 + messageBoxHeight}`,
        border: { type: "line" },
        content: `Welcome to ssh.town, ${username}!\n\nPress q to leave.`,
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        keys: true,
        mouse: true,
        scrollbar: { ch: ' ', style: { bg: 'blue' } },
    });

    messageBox = new Textarea({
        parent: screen,
        left: 0,
        width: "20%",
        height: messageBoxHeight,
        bottom: 0,
        border: { type: "line" },
        style: { fg: 'gray' },
        value: placeholderText
    });

    const INFO_H = 5;

    const RIGHT_W = 30; 
    const BODY_TOP = TOPBAR_H - 1;
    const BODY_H = `100%-${BODY_TOP + (INFO_H - 1)}`;

    main = new Box({
        parent: screen,
        top: BODY_TOP,
        left: "20%-1",
        width: `80%-${RIGHT_W - 2}`,
        height: BODY_H,
        border: { type: "line" },
        content: "Other stuff goes here",
        tags: true,
        wrap: false
    });

    right = new Box({
        parent: screen,
        top: BODY_TOP,
        right: 1,
        width: RIGHT_W,
        height: BODY_H,
        border: { type: "line" },
        content: "Right panel",
        tags: true,
    });

    bottomText = new Text({
        parent: right,
        bottom: 0, 
        left: 0,
        content: ''
    });

    info = new Box({
        parent: screen,
        bottom: 0,
        left: "20%-1",
        width: "80%+1",
        height: INFO_H,
        border: { type: "line" },
        content: "Hi",
        tags: true,
    });

    screen.key(["q"], () => {
        if (typing) return;
        screen.destroy();
        stream.end();
    });

    screen.key(["C-c"], () => {
        screen.destroy();
        stream.end();
    });

    let typing = false;

    function enterInput() {
        if (typing) return;
        typing = true;
        messageBox.focus();
        messageBox.readInput();
    }

    function leaveInput() {
        if (!typing) { main.focus(); return; }
        messageBox.cancel();
    }

    messageBox.on('cancel', () => {
        typing = false;
        main.focus();
        screen.render();
    });

    messageBox.on('click', enterInput);
    main.on('click', leaveInput);
    sidebar.on('click', () => { leaveInput(); sidebar.focus(); });

    screen.key(["t"], () => {
        if (typing) return;
        setImmediate(enterInput);
    });

    function portalTo(areaName) {
        user.portalPrevLocations.push([user.area, user.x, user.y]);
        user.area = areaName;
        user.x = getArea(areaName).spawn.x;
        user.y = getArea(areaName).spawn.y;

        roomChange();
    }

    function portalBack() {
        var [area, x, y] = user.portalPrevLocations.pop();

        user.area = area || "town";
        user.x = x || 1;
        user.y = y || 1;

        roomChange();
    }

    screen.key(["enter"], () => {
        if (typing) return;
        if (getRoomInfo().portalTo) {
            portalTo(getRoomInfo().portalTo);
        } else if (getRoomInfo().portalBack) {
            portalBack();
        }
    });

    function sendMessage(text) {
        const msg = { u: username, m: text };
        db.chatMessages.messages ??= [];
        db.chatMessages.messages.push(msg);
        events.emit("chat", msg);
    }

    function loadChat() {
        db.chatMessages.messages ??= [];
        const content = db.chatMessages.messages
            .map((m) => `${m.u}: ${m.m}`)
            .join("\n");
        sidebar.setContent(content);
        sidebar.setScrollPerc(100);
        screen.render();
    }

    function init() {
        user.level ??= 1;
        user.race ??= "Human";
        user.className ??= "Newbie";
        user.playTime ??= 1;
        user.xp ??= 0;
        user.hp ??= 10;
        user.maxHp ??= 10;
        user.mana ??= 20;
        user.money ??= 100;
        user.streak ??= 0;
        user.maxMana ??= 20;
        user.inventory ??= [];
        user.progressionStatus ??= "tutorial";
        user.area ??= "town";
        user.x ??= getSpawn(user.area).x;
        user.y ??= getSpawn(user.area).y;
        user.portalPrevLocations ??= [];
        user.stats ??= {
            "STR": 10,
            "AGI": 10,
            "VIT": 10,
            "INT": 10,
            "WIS": 10,
            "CHA": 10
        };
        user.lastActiveDay ??= null;
        updateStreak();
    }

    function getRoomInfo() {
        return getRoom(user.area, user.x, user.y);
    }

    function getAround() {
        var boxWidth = main.width - 2;
        var boxHeight = main.height - 2;

        var centerX = Math.floor(boxWidth / 2);
        var centerY = Math.floor(boxHeight / 2);

        var positions = [];

        for (var y = 0; y < boxHeight; y++) {
            for (var x = 0; x < boxWidth; x++) {
                positions.push({
                    x: user.x + (x - centerX),
                    y: user.y + (y - centerY),
                    row: y,
                    col: x,
                });
            }
        }

        return positions;
    }

    function nextLevelXp(level) {
        return Math.floor(100 * Math.pow(level, 1.5));
    }

    function textBar(current, max, width = 20, fillColor = chalk.greenBright, emptyColor = chalk.gray) {
        const ratio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
        const filled = Math.round(ratio * width);
        return fillColor('█'.repeat(filled)) + emptyColor('░'.repeat(width - filled)) + ` ${current}/${max}`;
    }

    const statColors = {
        "STR": chalk.red,
        "AGI": chalk.cyan,
        "INT": chalk.blue,
        "VIT": chalk.green,
        "WIS": chalk.magenta,
        "CHA": chalk.yellow,
    };

    function formatSeconds(seconds) {
        if (seconds < 60) return "< 1 minute";
        
        const minutes = seconds / 60;
        const hours = minutes / 60;
        const days = hours / 24;

        const round = (num) => Math.round(num * 10) / 10;

        if (days >= 1) {
            return `${round(days)} day${round(days) === 1 ? '' : 's'}`;
        } else if (hours >= 1) {
            return `${round(hours)} hour${round(hours) === 1 ? '' : 's'}`;
        } else if (minutes >= 1) {
            return `${Math.floor(minutes)} minute${Math.floor(minutes) === 1 ? '' : 's'}`;
        }
    }

    function renderStats(stats, perRow = 3) {
        const entries = Object.entries(stats).map(([k, v]) => `${(statColors[k] || chalk.white)(k)} ${String(v).padEnd(3)}`);
        const rows = [];
        for (let i = 0; i < entries.length; i += perRow) {
            rows.push(entries.slice(i, i + perRow).join('  '));
        }
        return rows.join('\n');
    }

    function renderMap() {
        var map = Array.from({ length: main.height - 2 }, () =>
            new Array(main.width - 2).fill(" ")
        );

        for (var p of getAround()) {
            var room = getRoom(user.area, p.x, p.y);
            if (room) map[p.row][p.col] = room.char ?? "#";
        }

        map[Math.floor(map.length / 2)][Math.floor(map[0].length / 2)] = chalk.redBright("@");

        main.setContent(map.map(row => row.join("")).join("\n"));
    }

    function roomChange() {
        var room = getRoomInfo();

        renderMap();

        if (room) {
            info.setContent(
                `${room.name}\n\n` +
                `${room.description}`
            );
        } else {
            info.setContent("Invalid room");
        }

        updateSidebar();
    }

    function updateSidebar() {
        const { level, xp, stats, hp, maxHp, mana, maxMana, inventory, money, streak, race, className, playTime } = user;
        const nextXp = nextLevelXp(level);

        right.setContent(
            `${chalk.red(username)}\n` +
            `Level ${level} - ${race} ${className}\n\n` +
            `XP   ${textBar(xp, nextXp, 15)}\n` +
            `HP   ${textBar(hp, maxHp, 15, chalk.redBright, chalk.red)}\n` +
            `Mana ${textBar(mana, maxMana, 15, chalk.cyanBright, chalk.cyan)}\n\n` +
            `Money: ${chalk.yellow("$" + money)}\n` +
            `Streak: ${chalk.blue(streak)} days\n` +
            `Play time: ${chalk.greenBright(formatSeconds(playTime))}\n\n` +
            `Stats:\n${renderStats(stats)}`
        );
        bottomText.setContent(`${getArea(user.area).name} (${user.x}, ${user.y}) ${getRoomInfo()?.name} (${getRoomInfo()?.type})`)
        screen.render();
    }

    function updateTime() {
        const t = getDateTimeString();
        topbarRight.setContent(t);
        topbarRight.width = t.length;
        screen.render();
    }

    function dayNumber(date = new Date()) {
        return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
    }

    function updateStreak() {
        const today = dayNumber();

        if (user.lastActiveDay === today) return;

        if (user.lastActiveDay === today - 1) {
            user.streak += 1;
        } else {
            user.streak = 1;
        }

        user.lastActiveDay = today;
        user.bestStreak = Math.max(user.bestStreak ?? 0, user.streak);
    }

    messageBox.on('focus', () => {
        if (messageBox.value === placeholderText) {
            messageBox.setValue('');
            messageBox.style.fg = 'white';
            screen.render();
        }
    });

    messageBox.on('blur', () => {
        if (messageBox.value.trim() === '') {
            messageBox.setValue(placeholderText); 
            messageBox.style.fg = 'gray';
            screen.render();
        }
    });

    messageBox.on("keypress", (ch, key) => {
        if (key && key.name === "enter") {
            process.nextTick(() => {
                const text = messageBox.getValue().replace(/\n$/, "");
                messageBox.clearValue();
                if (text.trim()) sendMessage(text);
                screen.render();
            });
        }
    });

    function resize() {
        roomChange();
    }

    right.on('click', leaveInput);
    info.on('click', leaveInput);
    topbar.on('click', leaveInput);

    screen.key(["w", "up"], () => {
        if (typing) return;
        user.y--;
        roomChange();
    });

    screen.key(["a", "left"], () => {
        if (typing) return;
        user.x--;
        roomChange();
    });

    screen.key(["d", "right"], () => {
        if (typing) return;
        user.x++;
        roomChange();
    });

    screen.key(["s", "down"], () => {
        if (typing) return;
        user.y++;
        roomChange();
    })

    main.focus();

    init();
    roomChange();
    updateSidebar();

    screen.render();
    return { screen, tty, loadChat, updateTime, updateSidebar, updateStreak, resize };
}

async function clientHandler(stream, pty, fp, events) {
    const name = await resolveUser(stream, fp);
    if (!name) {
        stream.write("Too many failed attempts. Bye!\r\n");
        return stream.end();
    }

    const ui = startUI(stream, pty, name, events);

    const onChat = () => ui.loadChat();
    events.on("chat", onChat);

    // const timer = setInterval(, 500);

    let lastTick = Date.now();
    const playTimer = setInterval(() => {
        const now = Date.now();
        const user = db.users[name];
        if (user) user.playTime = (user.playTime ?? 0) + (now - lastTick) / 1000;
        lastTick = now;
        ui.updateStreak();
        ui.updateSidebar();
        ui.updateTime();
    }, 1000);

    stream.on("close", () => {
        clearInterval(playTimer);
        events.off("chat", onChat);
    });

    ui.loadChat();
    return ui;
}

export { clientHandler };