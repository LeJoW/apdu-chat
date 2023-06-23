class Chat {
    rl;
    cmds = {};
    vars = {
        "auto-iv": true,
        readers: [],
    };
    $prompt = [
        function () {
            return new Date().toLocaleTimeString("fr-FR").slice(0, 5).yellow;
        },
    ];
    get prompt() {
        return this.$prompt
            .map(function (f) {
                return f();
            })
            .join(" ");
    }
    set prompt(arr) {
        this.$prompt = arr;
    }

    constructor(rl) {
        this.rl = rl;
    }

    launch(callback) {
        this.rl.question(this.prompt + " > ".red).then((answer) => {
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
            const arg = args.slice(1).join(" ");
            if (this.cmds.hasOwnProperty(cmd)) {
                const cmdF = this.cmds[cmd];
                function done(out) {
                    if (out != undefined) {
                        this.vars.ans = out;
                    }
                }
                try {
                    if (cmdF.constructor.name === "AsyncFunction") {
                        cmdF(arg).then((out) => {
                            done(out);
                            this.launch(callback);
                        });
                    } else {
                        done(cmdF(arg));
                        this.launch(callback);
                    }
                } catch (error) {
                    console.error(
                        `chat: exit with error in the command`,
                        error.message
                    );
                    this.launch(callback);
                }
            } else {
                callback(answer)
                    .then((output) => {
                        if (output.length > 0) {
                            console.log(output);
                            this.vars.ans = output;
                        }
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
