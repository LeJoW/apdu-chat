const { exit } = require("process");
const BinVector = require("./BinVector");
const { DES3, CRC32 } = require("./crypto-tools/lib");
const { AES } = require("./crypto-tools/aes");
const colors = require("colors");

function sendAPDU(input, reader) {
    const hex = new BinVector(input, 16).toHString
        .split(/\s/)
        .map((o) => parseInt(o, 16));
    const cmd = Buffer.from(hex);
    return new Promise(function (resolve, reject) {
        if (reader === undefined) {
            reject("no reader selected");
        }
        reader.transmit(cmd, 256 * 2).then(function (response) {
            const output = new BinVector(response.toString("hex"), 16);
            resolve(output);
        });
    });
}

function launchInterp(chat) {
    colors.enable();

    chat.addCmd("exit", function () {
        if (chat.vars.reader != undefined) {
            chat.vars.reader.close();
        }
        chat.destructor();
        exit(0);
    });

    chat.addCmd("close", function () {
        if (chat.vars.reader != undefined) {
            chat.vars.reader.transmit(
                Buffer.from([0x90, 0x00, 0x00, 0x00, 0x00]),
                16
            );
        } else {
            throw new Error("no reader selected.");
        }
    });

    chat.addCmd("vars", function () {
        Object.keys(chat.vars).map(function (k) {
            console.log(
                `${chat.vars[k].constructor.name.blue} ${k.cyan} = ${
                    chat.vars[k].toString(16).red
                }`
            );
        });
    });

    chat.addCmd("set", function (data) {
        const [n, name, value] = data.split(/^([^\s]+)\s/);
        let inp;
        try {
            inp = JSON.parse(value);
        } catch (error) {
            inp = value.trim();
        }
        chat.vars[name.trim()] = inp;
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

    chat.addCmd("aes", function (data) {
        const key = chat.vars.hasOwnProperty("key")
            ? chat.vars["key"]
            : BinVector.zero(128);
        const iv = chat.vars.hasOwnProperty("iv")
            ? chat.vars["iv"]
            : BinVector.zero(128);
        if (key.length != 128 || iv.length != 128) {
            throw new RangeError("key and iv must be 128bits length.");
        }
        const message = new BinVector(data, 16);
        const out = AES.enc_cbc(message, key, iv);
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

    chat.addCmd("l", function () {
        console.log(Object.keys(chat.cmds).join("\t"));
    });

    chat.addCmd("authenticateISO", async function (data) {
        const key =
            data.length > 0 ? new BinVector(data, 16) : BinVector.zero(64);
        let RndA, RndB;
        const AuthenticateISO = "90 1A 00 00 01 00 00";
        console.log(">>", AuthenticateISO);
        const resp1 = await sendAPDU(AuthenticateISO, chat.vars.reader);
        console.log("<<", resp1.toHString);
        if (resp1.toHString.slice(-2) === "AF") {
            const _RndB = resp1.slice(0, -2 * 8);
            RndB = DES3.dec_cbc(_RndB, key, BinVector.zero(64));
            RndA = new BinVector(chat.cmds.random(64), 16);
            const AdditionalFrameRequest = `90 AF 00 00 10 ${
                DES3.enc_cbc(RndA.appendRight(RndB.rotateLeft(8)), key, _RndB)
                    .toHString
            } 00`;
            console.log(">>", AdditionalFrameRequest);
            const resp2 = await sendAPDU(
                AdditionalFrameRequest,
                chat.vars.reader
            );
            console.log("<<", resp2.toHString);
            if (resp2.toHString.slice(-2) === "00") {
                chat.vars.iv = BinVector.zero(64);
                chat.vars.key = RndA.slice(0, 4 * 8).appendRight(
                    RndB.slice(0, 4 * 8)
                );
            } else {
                console.log("unsuccessfull connexion");
            }
        } else {
            console.log("an error occured. Try again");
        }
    });

    chat.addCmd("readers", function () {
        if (chat.vars.readers.length > 0) {
            console.log(
                chat.vars.readers
                    .map(function (r, i) {
                        return `r${i.toString().padEnd(3)} : ${r.reader.name}`;
                    })
                    .join("\n")
            );
        } else {
            console.log("no reader detected");
        }
    });

    chat.addCmd("select", function (data) {
        const i = parseInt(data.slice(1));
        if (chat.vars.readers[i]) {
            chat.vars.reader = chat.vars.readers[i];
        } else {
            console.log(`reader ${data} not found`);
        }
    });

    chat.addCmd("r", function () {
        if (chat.vars.reader !== undefined) {
            console.log(chat.vars.reader.reader.name);
        } else {
            console.log("no reader selected");
        }
    });

    chat.launch(function (input) {
        if (input !== "") {
            try {
                return new Promise(function (resolve, reject) {
                    sendAPDU(input, chat.vars.reader)
                        .then(function (output) {
                            resolve(output.toHString.blue);
                        })
                        .catch(function (err) {
                            reject(err);
                        });
                });
            } catch (err) {
                return new Promise(function (resolve, reject) {
                    reject("not an hex number: " + input);
                });
            }
        } else {
            return new Promise(function (resolve) {
                resolve("");
            });
        }
    });
}

module.exports = launchInterp;
