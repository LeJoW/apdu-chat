class BinVector {
    vector = [];
    lengthRequired = false;

    constructor(init = [], base = 2) {
        switch (init.constructor.name) {
            case "Number":
                this.vector = init === 0 ? [] : BinVector.zero(init).vector;
                this.lengthRequired = true;
                break;
            case "String":
                const striped = init.replaceAll(" ", "");
                const str = BinVector.parseInt(striped, base).toString(2);
                this.vector = new BinVector(str.split("")).vector;
                const pw = Math.log2(base);
                if (Number.isInteger(pw)) {
                    this.lengthRequired = true;
                    this.length = striped.length * pw;
                }
                break;
            case "Array":
                if (init.reduce((y, b) => y && (b == "0" || b == "1"), true)) {
                    this.vector = init.map((b) => parseInt(b, 2));
                } else {
                    throw new EvalError("Not a bit array: " + init.join(""));
                }
                break;
            case this.constructor.name:
                this.vector = JSON.parse(JSON.stringify(init.vector));
                break;
            default:
                throw new TypeError(
                    "Not a good init value. Type must one of (Number size), (String bits) or (Array bits)"
                );
        }
    }

    get length() {
        return this.vector.length;
    }

    set length(l) {
        if (l < this.GF2.deg() + 1) {
            throw new RangeError(
                "New length must be at less equal to actual length"
            );
        }
        if (l < this.length) {
            this.lengthRequired = false;
            this.vector = new BinVector(this.toString()).vector;
        }
        this.lengthRequired = true;
        this.vector = this.paddLeft(l).vector;
    }

    set vector(v) {
        if (v.reduce((y, b) => y && (b === 0 || b === 1), true)) {
            this.vector = v;
        } else {
            throw new EvalError("Not a bit array");
        }
        return this;
    }

    one(size = this.length) {
        return BinVector.one(size).vector;
    }
    zero(size = this.length) {
        return BinVector.zero(size).vector;
    }
    static one(size) {
        return new BinVector(Array(size).fill(1));
    }
    static zero(size) {
        return new BinVector(Array(size).fill(0));
    }

    appendLeft(newBV) {
        return new BinVector([...newBV.vector, ...this.vector]);
    }

    appendRight(newBV) {
        return new BinVector([...this.vector, ...newBV.vector]);
    }

    padding(size) {
        size = size > this.length ? Math.abs(this.length - size) : 0;
        return new BinVector(size);
    }

    paddLeft(size) {
        const out = new BinVector(this.appendLeft(this.padding(size)));
        out.lengthRequired = true;
        return out;
    }

    paddRight(size) {
        const out = new BinVector(this.appendRight(this.padding(size)));
        out.lengthRequired = true;
        return out;
    }

    logical(gate, binVector) {
        if (binVector.length <= this.length) {
            binVector.length = this.length;
        } else {
            this.length = binVector.length;
        }
        const out = new BinVector(
            this.vector.map((b, i) => gate(b, binVector.vector[i]))
        );
        out.length = this.length;
        return out;
    }

    or(binVector) {
        return this.logical((a, b) => a | b, binVector);
    }

    and(binVector) {
        return this.logical((a, b) => a & b, binVector);
    }

    xor(binVector) {
        return this.logical((a, b) => a ^ b, binVector);
    }

    not() {
        return new BinVector(this.xor(BinVector.one(this.length)));
    }

    shiftLeft(length) {
        const out = new BinVector(this.appendRight(BinVector.zero(length)));
        out.length = this.length + length;
        return out;
    }
    tShiftLeft(length) {
        const l = this.length;
        let o;
        if (length < l) {
            const t = new BinVector(this.vector.slice(-l + length));
            o = t.shiftLeft(length);
        } else {
            o = BinVector.zero(length);
        }
        o.length = l;
        return o;
    }

    shiftRight(length) {
        return new BinVector(this.appendLeft(BinVector.zero(length)));
    }
    tShiftRight(length) {
        const l = this.length;
        let o;
        if (length < l) {
            const t = new BinVector(this.vector.slice(0, l - length));
            o = t.shiftRight(length);
        } else {
            o = BinVector.zero(length);
        }
        o.length = l;
        return o;
    }

    GF2 = {
        add: (binVector) => this.xor(binVector),
        sub: (binVector) => this.xor(binVector),
        prod: (binVector) => {
            return (function rec(A, i, out) {
                const end = binVector.GF2.deg() + 1;
                if (i <= end) {
                    if (binVector.lsb(i) === 1) {
                        return rec(A, i + 1, out.GF2.add(A.shiftLeft(i - 1)));
                    } else {
                        return rec(A, i + 1, out);
                    }
                } else {
                    return out;
                }
            })(this, 1, BinVector.zero(1));
        },
        deg: () =>
            BinVector.parseInt(this.toString(2), 2).toString(2).length - 1,
        div: (binVector) => {
            const degB = binVector.GF2.deg();
            const { q, r } = (function rec(remainder, quotient) {
                const degA = remainder.GF2.deg();
                if (degA >= degB) {
                    const degQ = degA - degB;
                    const Q = BinVector.one(1).shiftLeft(degQ);
                    const R = remainder.GF2.add(binVector.shiftLeft(degQ));
                    return rec(R, quotient.GF2.add(Q));
                } else {
                    return { q: quotient, r: remainder };
                }
            })(this, BinVector.zero(1));
            q.length = q.GF2.deg() + 1;
            r.length = r.GF2.deg() + 1;
            return { q, r };
        },
        rem: (binVector) => this.GF2.div(binVector).r,
    };

    static GF2 = {
        fromArray: (arr) => {
            if (
                arr.reduce(function (acc, v) {
                    return acc && !isNaN(parseInt(v, 10));
                }, true)
            ) {
                if (arr.length > 0) {
                    arr = arr
                        .map(function (e) {
                            return parseInt(e, 10);
                        })
                        .sort(function (a, b) {
                            return b - a;
                        });
                    const deg = arr[0];
                    const bin = Array(deg + 1).fill(0);
                    arr.map(function (i) {
                        bin[i] = 1;
                    });
                    return new BinVector(bin.reverse());
                } else {
                    return new BinVector(0);
                }
            } else {
                throw new TypeError("Invalid input. Must be int array.");
            }
        },
    };

    lsb(i = 0) {
        return i <= this.length ? this.vector[this.length - i - 1] : 0;
    }

    msb(i = 0) {
        return i <= this.length ? this.vector[i] : 0;
    }

    reverseBitOrder() {
        const out = new BinVector(this);
        out.vector = out.vector.reverse();
        out.length = this.length;
        out.lengthRequired = this.lengthRequired;
        return out;
    }

    reverseByteOrder() {
        const L = Math.ceil(this.length / 8) * 8;
        const padded = this.paddLeft(L);
        const out = (function rec(i, o) {
            const pos = i * 8;
            const byte = padded.slice(pos - 8, pos);
            byte.length = 8;
            if (pos === L) {
                return o.appendLeft(byte);
            }
            return rec(i + 1, o.appendLeft(byte));
        })(1, new BinVector());
        return out;
    }

    slice(...args) {
        const out = new BinVector(this.vector.slice(...args));
        return out;
    }

    leftHalf() {
        if (this.length % 2 === 0) {
            return this.slice(0, this.length / 2);
        } else {
            throw new Error("Not an odd bit sequence");
        }
    }

    rightHalf() {
        if (this.length % 2 === 0) {
            return this.slice(this.length / 2);
        } else {
            throw new Error("Not an odd bit sequence");
        }
    }

    rotateLeft(length) {
        const start = this.slice(0, length);
        const out = new BinVector(this.tShiftLeft(length).or(start));
        out.length = this.length;
        return out;
    }

    toString(base = 2) {
        if (this.length === 0) return "[]";
        const out = BinVector.parseInt(this.vector.join(""), 2)
            .toString(base)
            .toUpperCase();
        if (this.lengthRequired === true) {
            let paddLength = this.length;
            if (base === 16 && this.length % 8 === 0) {
                paddLength = this.length / 4;
            }
            return out.padStart(paddLength, "0");
        }
        return out;
    }

    toInt(base = 10) {
        return parseInt(this.toString(base), base);
    }

    toEString(n, base = 2, step = " ") {
        return BinVector.printBy(n, this.toString(base), step);
    }

    get toHString() {
        const out = this.toString(16).trim();
        return BinVector.printByOctet(
            out.padStart(out.length + (out.length % 2), "0")
        );
    }

    static printByOctet(hex) {
        return Array.prototype.reduce.call(hex, (a, c, i) =>
            [...a, i % 2 === 0 ? " " : "", c].join("")
        );
    }

    static printBy(n, str, sep = " ") {
        const d = n - (str.length % n);
        return Array.prototype.reduce.call(str, (a, c, i) =>
            [...a, (i + d) % n === 0 ? sep : "", c].join("")
        );
    }

    static parseInt(input, base = 10) {
        const pref = {
            2: "0b",
            8: "0o",
            16: "0x",
        };
        if (base != 10 && pref[base] != undefined) {
            return BigInt(pref[base] + input.toString());
        }
        return BigInt(input);
    }
}

module.exports = BinVector;
