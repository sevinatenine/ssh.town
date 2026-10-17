import fs from "fs";
import path from "path";

const dataFolder = path.join(import.meta.dirname, "../data");

const chatMessagesPath = path.join(dataFolder, "/chat.json");
const accountsPath = path.join(dataFolder, "/accounts.json");
const usersPath = path.join(dataFolder, "/users.json");

function get(path) {
    try {
        return JSON.parse(fs.readFileSync(path));
    } catch (e) {
        return {};
    }
}

function save(file, data) {
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
}

function getAccounts() {
    return get(accountsPath);
}

var chatMessages = get(chatMessagesPath);
var users = get(usersPath);
var accounts = getAccounts();

function sync() {
    save(chatMessagesPath, chatMessages);
    save(usersPath, users);
}

setInterval(sync, 1000);

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { sync(); process.exit(); });

export default {
    get chatMessages() { return chatMessages; },
    set chatMessages(v) { chatMessages = v; },
    get users() { return users; },
    set users(v) { users = v; },
};