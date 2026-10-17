function makeTTY(stream, pty) {
    stream.isTTY = true;
    stream.columns = pty.cols || 80;
    stream.rows = pty.rows || 24;
    stream.setRawMode = () => stream;
    stream.setEncoding?.("utf8");
    return stream;
}

function ask(stream, label, { mask = false } = {}) {
    return new Promise((resolve, reject) => {
        let buf = "";
        const cleanup = () => {
            stream.off("data", onData);
            stream.off("close", onClose);
        };
        const onClose = () => { cleanup(); reject(new Error("closed")); };
        const onData = (d) => {
            const s = d.toString("utf8");
            if (s.startsWith("\x1b")) return;
            for (const ch of s) {
                if (ch === "\r" || ch === "\n") {
                    cleanup();
                    stream.write("\r\n");
                    return resolve(buf);
                }
                if (ch === "\x03" || ch === "\x04") {
                    cleanup();
                    return reject(new Error("cancelled"));
                }
                if (ch === "\x7f" || ch === "\b") {
                    if (buf.length) { buf = buf.slice(0, -1); stream.write("\b \b"); }
                    continue;
                }
                if (ch < " " || buf.length >= 64) continue;
                buf += ch;
                stream.write(mask ? "*" : ch);
            }
        };
        stream.on("data", onData);
        stream.once("close", onClose);
        stream.write(label);
    });
}

export { ask, makeTTY };