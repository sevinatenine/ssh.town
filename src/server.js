import ssh2 from "ssh2";
import { setRuntime, NodeRuntime } from "@unblessed/node";
import { readFileSync } from "node:fs";

import { fingerprint, verifyKey } from "./auth.js";
import { clientHandler } from "./clientHandler.js";
import chalk from "chalk";

import db from "./dataManager.js";

import EventEmitter from 'node:events';
const serverEvents = new EventEmitter();


const { Server } = ssh2;

setRuntime(new NodeRuntime());

const PORT = 2222;
const hostKey = readFileSync("./keys/host_key");

process.on("uncaughtException", (err) => console.error("uncaught:", err));
process.on("unhandledRejection", (err) => console.error("unhandled:", err));

new Server({ hostKeys: [hostKey] }, (client) => {
    let fp = null;
    let pty = { cols: 80, rows: 24, term: "xterm-256color" };
    let ui;

    client.on("authentication", (ctx) => {
        if (ctx.method === "publickey") {
            if (!ctx.signature) return ctx.accept();
            if (!verifyKey(ctx)) return ctx.reject(["publickey", "keyboard-interactive"]);
            fp = fingerprint(ctx.key.data);
            return ctx.accept();
        }
        if (ctx.method === "keyboard-interactive") {
            return ctx.accept();
        }
        ctx.reject(["publickey", "keyboard-interactive"]);
    });

    client.on("ready", () => {
        client.on("session", (accept) => {
            const session = accept();

            session.on("pty", (acceptPty, _rej, ptyInfo) => {
                pty = { cols: ptyInfo.cols, rows: ptyInfo.rows, term: ptyInfo.term || pty.term };
                acceptPty();
            });

            session.on("window-change", (acceptWc, _rej, size) => {
                acceptWc?.();
                if (!ui) return;
                ui.tty.columns = size.cols;
                ui.tty.rows = size.rows;
                ui.tty.emit("resize");
                ui.resize();
            });

            session.on("shell", async (acceptShell) => {
                const stream = acceptShell();
                let closed = false;
                stream.on("close", () => { closed = true; ui?.screen?.destroy(); });

                try {
                    ui = (await clientHandler(stream, pty, fp, serverEvents));
                } catch (err) {
                    if (closed || err.message === "cancelled") return stream.end();
                    console.error("session failed:", err);
                    stream.write(`server error: ${err.message}\r\n`);
                    stream.end();
                }
            });
        });
    });

    client.on("error", (err) => console.error("client error:", err, err.message));
    client.on("close", () => ui?.screen?.destroy());
}).listen(PORT, "0.0.0.0", () => {
    console.log(`ssh.town listening on :${PORT} ${chalk.cyan("Command:")} ${chalk.blue("ssh -p 2222 localhost")}`);
});