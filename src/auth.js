import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import crypto from "node:crypto";
import { promisify } from "node:util";
import ssh2 from "ssh2";
import chalk from "chalk";

const { utils } = ssh2;

import { ask } from "./ui.js";

const scrypt = promisify(crypto.scrypt);

const DB_FILE = "./data/accounts.json";

mkdirSync("./data", { recursive: true });

const db = existsSync(DB_FILE)
    ? JSON.parse(readFileSync(DB_FILE, "utf8"))
    : { accounts: {}, keys: {} };
const saveDb = () => writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

const RESERVED = new Set(["admin", "root", "system", "ssh.town", "server", "town"]);
const validName = (n) => /^[A-Za-z0-9_-]{2,16}$/.test(n) && !RESERVED.has(n.toLowerCase());

async function hashPw(password, salt) {
    return (await scrypt(password, salt, 64)).toString("hex");
}

async function checkPw(acct, password) {
    const got = Buffer.from(await hashPw(password, acct.salt), "hex");
    const want = Buffer.from(acct.hash, "hex");
    return got.length === want.length && crypto.timingSafeEqual(got, want);
}

function linkKey(fp, lowerName) {
    if (!fp) return;
    const acct = db.accounts[lowerName];
    if (!acct.keys.includes(fp)) acct.keys.push(fp);
    db.keys[fp] = lowerName;
    saveDb();
}

const fingerprint = (blob) =>
    "SHA256:" + crypto.createHash("sha256").update(blob).digest("base64").replace(/=+$/, "");

function verifyKey(ctx) {
    try {
        const len = ctx.key.data.readUInt32BE(0);
        const type = ctx.key.data.toString("ascii", 4, 4 + len);
        const parsed = utils.parseKey(`${type} ${ctx.key.data.toString("base64")}`);
        return !(parsed instanceof Error) && parsed.verify(ctx.blob, ctx.signature, ctx.hashAlgo) === true;
    } catch (e) {
    console.error("verifyKey threw:", e);
    return false;
    }
}

const banner = chalk.green`           _        _                         
 ___  ___ | |__    | |_  ___ __      __ _ __  
/ __|/ __|| '_ \\   | __|/ _ \\\\ \\ /\\ / /| '_ \\ 
\\__ \\\\__ \\| | | | _| |_| (_) |\\ V  V / | | | |
|___/|___/|_| |_|(_)\\__|\\___/  \\_/\\_/  |_| |_|`;

const saySteam = (stream, text) => stream.write(text.replace(/\r?\n/g, "\r\n"));

async function resolveUser(stream, fp) {
    var say = (...args) => saySteam(stream, ...args);
    const known = fp && db.keys[fp];
    if (known && db.accounts[known]) return db.accounts[known].name;

    say(banner + "\n");

    stream.write(fp
        ? "\r\nWelcome to ssh.town! This key isn't linked to an account yet.\r\n"
        : "\r\nWelcome to ssh.town! (No SSH key detected, so you'll log in each time.)\r\n");
    stream.write("Enter a username to log in, or pick a new one to sign up.\r\n\r\n");

    for (let attempt = 0; attempt < 3; attempt++) {
        const name = (await ask(stream, "Username: ")).trim();
        if (!validName(name)) {
            stream.write("2-16 chars: letters, numbers, _ or - (some names are reserved).\r\n");
            continue;
        }
        const lower = name.toLowerCase();
        const acct = db.accounts[lower];

        if (acct) {
            const pw = await ask(stream, "Password: ", { mask: true });
            if (await checkPw(acct, pw)) {
                linkKey(fp, lower);
                stream.write(`Key linked. Welcome back, ${acct.name}!\r\n`);
                return acct.name;
            }
            stream.write("Wrong password.\r\n");
        } else {
            stream.write("New account.\r\n");
            const pw = await ask(stream, "Choose a password: ", { mask: true });
            if (pw.length < 6) {
                stream.write("Password must be at least 6 characters.\r\n");
                continue;
            }
            const pw2 = await ask(stream, "Confirm password: ", { mask: true });
            if (pw !== pw2) {
                stream.write("Passwords didn't match.\r\n");
                continue;
            }
            const salt = crypto.randomBytes(16).toString("hex");
            db.accounts[lower] = { name, salt, hash: await hashPw(pw, salt), keys: [] };
            linkKey(fp, lower);
            stream.write(`Account created. Welcome, ${name}!\r\n`);
            return name;
        }
    }
    return null;
}

export {
    hashPw,
    checkPw,
    linkKey,
    fingerprint,
    verifyKey,
    resolveUser
}