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

nfc.on("reader", (reader) => {
    // disable auto processing
    reader.autoProcessing = false;

    console.log(`${reader.reader.name}  device attached`);

    reader.on("card", (card) => {
        console.log(`${reader.reader.name}  card inserted`, card);
        launchInterp(chat, reader);
    });

    reader.on("card.off", (card) => {
        console.log(`${reader.reader.name}  card removed`, card);
    });

    reader.on("error", (err) => {
        console.log(`${reader.reader.name}  an error occurred`, err);
    });

    reader.on("end", () => {
        console.log(`${reader.reader.name}  device removed`);
    });
});

nfc.on("error", (err) => {
    console.log("an error occurred", err);
});
