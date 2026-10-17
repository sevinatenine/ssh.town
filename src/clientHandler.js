import { Screen, Box, Textarea } from "@unblessed/node";

import { resolveUser } from "./auth.js"
import { makeTTY } from "./ui.js";
import chalk from "chalk";
import { getDateTimeString } from "./utils.js";

import db from "./dataManager.js";

var messageBoxHeight = 5;
const placeholderText = 'Press `t` to chat.';

function startUI(stream, pty, username, events) {
    let screen, topbar, topbarRight, sidebar, main, right, info, messageBox;

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
        inputOnFocus: true,
        style: {
            fg: 'gray', // Start with gray text for the placeholder
        },
        value: placeholderText
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

    function updateTime() {
        const t = getDateTimeString();
        topbarRight.setContent(t);
        topbarRight.width = t.length;
        screen.render();
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
            return;
        } else if (key && key.name === "escape") {
            main.focus();
        }
    });

    const INFO_H = 5;

    const RIGHT_W = 24; 
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

    screen.key(["q", "C-c"], () => {
        if (screen.focused === messageBox) return;

        screen.destroy();
        stream.end();
    });

    screen.key(["t"], () => {
        messageBox.focus();
    })

    main.focus();

    screen.render();
    return { screen, tty, loadChat, updateTime };
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

    const timer = setInterval(ui.updateTime, 500);
    stream.on("close", () => {
        clearInterval(timer);
        events.off("chat", onChat);
    });

    ui.loadChat();
    return ui;
}

export { clientHandler };