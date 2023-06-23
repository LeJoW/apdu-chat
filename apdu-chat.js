#!node

// without Babel in ES2015
const { NFC } = require("nfc-pcsc");
const readline = require("readline/promises");
const { stdin, stdout } = require("process");
const rl = readline.createInterface(stdin, stdout);
const Chat = require("./lib/chat");
const launchInterp = require("./lib/launch");
const chat = new Chat(rl);

const nfc = new NFC(); // optionally you can pass logger

launchInterp(chat);

nfc.on("reader", (reader) => {
    reader.autoProcessing = false;

    chat.vars.readers.push(reader);

    reader.on("card", (card) => {});

    reader.on("card.off", (card) => {});

    reader.on("error", (err) => {
        console.log(`${reader.reader.name}  an error occurred`, err);
    });

    reader.on("end", () => {
        if (chat.vars.reader === reader) {
            chat.vars.reader = undefined;
        }
        chat.vars.readers = chat.vars.readers.filter(function (r) {
            return r != reader;
        });
    });
});

nfc.on("error", (err) => {
    console.log("an error occurred", err);
});
