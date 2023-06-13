class Chat {
    rl;
    cmds = {};
    vars = {
        "auto-iv": true,
    };

    constructor(rl) {
        this.rl = rl;
    }

    launch(callback) {
        this.rl.question("> ").then((answer) => {
            answer = answer.trim();
            if (/ans/.test(answer)) {
                if (this.vars.hasOwnProperty("ans")) {
                    answer = answer.replaceAll(
                        "ans",
                        this.vars.ans.toString(16)
                    );
                } else {
                    console.error("chat: var ans not set yet");
                    this.launch(callback);
                    return;
                }
            }
            const args = answer.split(/\s/);
            const cmd = args[0];
            if (this.cmds.hasOwnProperty(cmd)) {
                try {
                    const out = this.cmds[cmd](args.slice(1).join(" "));
                    if (out != undefined) {
                        this.vars.ans = out;
                    }
                } catch (error) {
                    console.error(
                        `chat: exit with error in the command`,
                        error.message
                    );
                }
                this.launch(callback);
            } else {
                callback(answer)
                    .then((output) => {
                        console.log(output);
                        this.vars.ans = output;
                        this.launch(callback);
                    })
                    .catch((output) => {
                        console.log(`chat: ${output}`);
                        this.launch(callback);
                    });
            }
        });
    }

    addCmd(cmdName, callback) {
        this.cmds[cmdName] = callback;
    }

    setVar(varName, value) {
        this.vars[varName] = value;
    }

    destructor() {
        this.rl.close();
    }
}

module.exports = Chat;
