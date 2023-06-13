const { exit } = require("process");
const BinVector = require("./BinVector");
const { DES3, CRC32 } = require("./crypto-tools/lib");
const colors = require("colors");

function launchInterp(chat, reader) {
    colors.enable();

    chat.addCmd("exit", function () {
        chat.destructor();
        reader.close();
        exit(0);
    });

    chat.addCmd("close", function () {
        reader.transmit(Buffer.from([0x90, 0x00, 0x00, 0x00, 0x00]), 16);
    });

    chat.addCmd("vars", function () {
        Object.keys(chat.vars).map(function (k) {
            console.log(
                `${(typeof chat.vars[k]).blue} ${k.cyan} = ${
                    chat.vars[k].toString(16).red
                }`
            );
        });
    });

    chat.addCmd("set", function (data) {
        const [n, name, value] = data.split(/^([^\s]+)\s/);
        chat.vars[name.trim()] = value.trim();
    });

    chat.addCmd("key", function (data) {
        const key = new BinVector(data, 16);
        chat.setVar("key", key);
        return key;
    });

    chat.addCmd("iv", function (data) {
        const iv = new BinVector(data, 16);
        chat.setVar("iv", iv);
        return iv;
    });

    chat.addCmd("dec", function (data) {
        const key = chat.vars.hasOwnProperty("key")
            ? chat.vars["key"]
            : BinVector.zero(64);
        const iv = chat.vars.hasOwnProperty("iv")
            ? chat.vars["iv"]
            : BinVector.zero(64);
        const message = new BinVector(data, 16);
        const out = DES3.dec_cbc(message, key, iv).toHString;
        console.log(out);
        return out;
    });

    chat.addCmd("enc", function (data) {
        const key = chat.vars.hasOwnProperty("key")
            ? chat.vars["key"]
            : BinVector.zero(64);
        const iv = chat.vars.hasOwnProperty("iv")
            ? chat.vars["iv"]
            : BinVector.zero(64);
        const message = new BinVector(data, 16);
        const out = DES3.enc_cbc(message, key, iv);
        if (chat.vars["auto-iv"]) {
            chat.vars["iv"] = out.slice(-64);
        }
        console.log(out.toHString);
        return out.toHString;
    });

    chat.addCmd("mac", function (data) {
        const key = chat.vars.hasOwnProperty("key")
            ? chat.vars["key"]
            : BinVector.zero(64);
        const iv = chat.vars.hasOwnProperty("iv")
            ? chat.vars["iv"]
            : BinVector.zero(64);
        const out = DES3.CMAC(key, new BinVector(data, 16), 64, iv);
        if (chat.vars["auto-iv"]) {
            chat.vars["iv"] = out.slice(-64);
        }
        console.log(out.toHString);
        return out.toHString;
    });

    chat.addCmd("crc32", function (data) {
        console.log(CRC32(new BinVector(data, 16)).toHString);
    });

    chat.addCmd("random", function (data) {
        const length = parseInt(data, 10);
        const v = (function rec(i, o) {
            return i === length
                ? o
                : rec(i + 1, o.concat(Math.round(Math.random())));
        })(1, []);
        const out = new BinVector(v).toHString;
        console.log(out);
        return out;
    });

    chat.addCmd("format", function () {
        console.log("|  1   |  1  |  1   |   1  | 1-3 |    a    |  1   |");
        console.log(
            "| " +
                "CLA".yellow +
                "  | " +
                "INS".yellow +
                " |  " +
                "P1".yellow +
                "  |  " +
                "P2".yellow +
                "  | " +
                "Lc".yellow +
                "  | " +
                "CmdData".blue +
                " |  " +
                "Le".yellow +
                "  |"
        );
        console.log("| 0x90 | Cmd | 0x00 | 0x00 |     |         | 0x00 |");
    });

    chat.launch(function (input) {
        try {
            const hex = new BinVector(input, 16).toHString
                .split(/\s/)
                .map((o) => parseInt(o, 16));
            const cmd = Buffer.from(hex);
            return new Promise(function (resolve, reject) {
                reader.transmit(cmd, 256 * 2).then(function (response) {
                    const output = new BinVector(response.toString("hex"), 16);
                    resolve(output.toHString.blue);
                });
            });
        } catch (err) {
            return new Promise(function (resolve, reject) {
                reject("not an hex number: " + input);
            });
        }
    });
}

module.exports = launchInterp;
