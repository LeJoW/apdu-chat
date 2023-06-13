const BinVector = require("../BinVector");
const Permutations = require("./Permutations.json");
const Stables = require("./Substitutions.json");
const Etable = require("./Expand.json");

const kshift = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
const G = BinVector.GF2.fromArray([
    32,
    26,
    23,
    22,
    16,
    12,
    11,
    10,
    8,
    7,
    5,
    4,
    2,
    1,
    0,
]);
const DES_MODE_C = 1;
const DES_MODE_D = -1;

function debug(m, n = 4) {
    console.log(m.toEString(n));
}

function Permutation(p, input, pow = 1) {
    const pm = Permutations[p].p.map((v) => v - 1);
    const length = Permutations[p].l;
    input.length = length;
    if (pm.length === length) {
        const ped = pm.map(function (v, i) {
            return input.vector[pow === 1 ? v : pm.indexOf(i)];
        });
        const out = new BinVector(ped);
        out.length = length;
        return out;
    } else {
        const ex = (function rec(acc, i) {
            if (i === length) {
                return acc;
            } else {
                return rec(!pm.includes(i) ? [...acc, i] : acc, i + 1);
            }
        })([], 0);
        const e = ex.map(function (v, i) {
            return v - i;
        });
        let ption = pm.reduce(function (acc, id, i) {
            if (e.includes(i)) {
                return [...acc, i + e.indexOf(i), id];
            } else {
                return [...acc, id];
            }
        }, []);
        if (ption.length < length) {
            ption = ption.concat(ex.slice(ption.length - length));
        }
        const ped = ption.map(function (v, i) {
            return input.vector[pow === 1 ? v : ption.indexOf(i)];
        });
        const stripped = ped.filter(function (b, i) {
            return !ex.includes(i);
        });
        const out = new BinVector(stripped);
        out.length = length - e.length;
        return out;
    }
}

function KeySchedule(inputKey) {
    const Key = Permutation("PC1", inputKey);
    let left = Key.leftHalf();
    let right = Key.rightHalf();
    return Array(16)
        .fill(null)
        .map(function (v, i) {
            right = right.rotateLeft(kshift[i]);
            left = left.rotateLeft(kshift[i]);
            const concat = left.appendRight(right);
            concat.length = 56;
            const out = Permutation("PC2", concat);
            out.length = 48;
            return out;
        });
}

function Expand(m) {
    const out = new BinVector(
        Etable.map(function (v) {
            return m.vector[v - 1];
        })
    );
    out.length = 48;
    return out;
}

function Substitute(m) {
    const boxes = Object.values(Stables).map(function (Stable, i) {
        const inputBox = m.slice(6 * i, 6 * (i + 1));
        inputBox.length = 6;
        const row = parseInt(10 * inputBox.msb() + inputBox.lsb(), 2);
        const col = parseInt(inputBox.slice(1, 5).toString(10), 10);
        const nv = Stable[row][col];
        const out = new BinVector(nv.toString(10), 10);
        out.length = 4;
        return out;
    });
    const out = boxes.reduce(function (acc, v) {
        return acc.appendRight(v);
    }, new BinVector());
    out.length = 32;
    return out;
}

function feistel(rightHalf, key) {
    const sum = key.xor(rightHalf);
    const sed = Substitute(sum);
    sed.length = 32;
    const out = Permutation("P", sed);
    out.length = 32;
    return out;
}

function round(L, R, K) {
    const expanded = Expand(R);
    const F = feistel(expanded, K);
    return [R, L.xor(F)];
}

function tDES64(message, key, mode = DES_MODE_C) {
    const messageIP = Permutation("IP", message);
    const L1 = messageIP.leftHalf();
    const R1 = messageIP.rightHalf();
    let keys = KeySchedule(key);
    if (mode === DES_MODE_D) {
        keys = keys.reverse();
    }
    const [L16, R16] = keys.reduce(
        function ([L, R], K) {
            return round(L, R, K);
        },
        [L1, R1]
    );
    const concat = R16.appendRight(L16);
    concat.length = 64;
    const out = Permutation("IP", concat, -1);
    out.length = 64;
    return out;
}

function tDES_CBC(message, key, iv, mode = DES_MODE_C) {
    const chunksNbr = message.length / 64;
    if (Number.isInteger(chunksNbr)) {
        const out = (function rec(i, ivr, output) {
            if (i === chunksNbr) {
                return output;
            } else {
                const pos = 64 * i;
                const plainText = message.slice(pos, pos + 64);
                if (mode === DES_MODE_C) {
                    const iblock = plainText.xor(ivr);
                    const oblock = tDES64(iblock, key, DES_MODE_C);
                    return rec(i + 1, oblock, output.appendRight(oblock));
                } else {
                    const oblock = tDES64(plainText, key, DES_MODE_D);
                    const oText = oblock.xor(ivr);
                    return rec(i + 1, plainText, output.appendRight(oText));
                }
            }
        })(0, iv, new BinVector());
        out.length = message.length;
        return out;
    } else {
        throw new RangeError("Input message length must be multiple of 64bits");
    }
}

function DES_MAC_SUBK(K) {
    const L = tDES64(BinVector.zero(64), K);
    const R64 = BinVector.zero(59).appendRight(new BinVector([1, 1, 0, 1, 1]));
    const Z64 = BinVector.zero(64);
    const K1 = L.tShiftLeft(1).xor(L.msb() === 0 ? Z64 : R64);
    const K2 = K1.tShiftLeft(1).xor(K1.msb() === 0 ? Z64 : R64);
    return [K1, K2];
}

function DES_CMAC(K, M, Tlen = 64, iv = BinVector.zero(64)) {
    const Mlen = M.length;
    const n = Mlen === 0 ? 1 : Math.ceil(Mlen / 64);
    const [K1, K2] = DES_MAC_SUBK(K);
    const T = (function rec(i, output) {
        const pos = i * 64;
        const Mi = M.slice(pos - 64, pos);
        if (i === n) {
            const Mn =
                Mlen % 64 === 0
                    ? K1.xor(Mi)
                    : K2.xor(Mi.appendRight(BinVector.one(1)).paddRight(64));
            return tDES64(output.xor(Mn), K, DES_MODE_C);
        }
        return rec(i + 1, tDES64(output.xor(Mi), K, DES_MODE_C));
    })(1, iv);
    return T.slice(0, Tlen);
}

function CRC32(inputFrame) {
    inputFrame = inputFrame.reverseByteOrder().reverseBitOrder();
    const out = inputFrame
        .slice(0, 32)
        .not()
        .appendRight(inputFrame.slice(32))
        .shiftLeft(32)
        .GF2.rem(G);
    out.length = 32;
    return out.reverseByteOrder().reverseBitOrder();
}

const DES3 = {
    enc64: function (message, key) {
        return tDES64(message, key, DES_MODE_C);
    },
    dec64: function (message, key) {
        return tDES64(message, key, DES_MODE_D);
    },
    enc_cbc: function (message, key, iv) {
        return tDES_CBC(message, key, iv, DES_MODE_C);
    },
    dec_cbc: function (message, key, iv) {
        return tDES_CBC(message, key, iv, DES_MODE_D);
    },
    CMAC: DES_CMAC,
};

module.exports = {
    DES3,
    CRC32,
};
