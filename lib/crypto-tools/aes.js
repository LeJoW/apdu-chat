const BinVector = require("../BinVector");
const { execSync } = require("child_process");

function AES128(message, key, enc = true) {
    message.length = message.length;
    key.length = 128;
    const cmd = `echo ${message.toString(16)} | xxd -r -p | openssl enc ${
        enc ? "" : "-d"
    } -aes-128-cbc -K ${key.toString(
        16
    )} -iv 00000000000000000000000000000000 -in /dev/stdin -out /dev/stdout -nopad 2>/dev/null | xxd -p`;
    const stdout = execSync(cmd);
    return new BinVector(stdout.toString().replaceAll("\n", ""), 16);
}

function AES_CBC(message, key, iv = BinVector.zero(128), enc = true) {
    const chunksNbr = message.length / 128;
    if (Number.isInteger(chunksNbr)) {
        const out = (function rec(i, ivr, output) {
            if (i === chunksNbr) {
                return output;
            } else {
                const pos = 128 * i;
                const plainText = message.slice(pos, pos + 128);
                if (enc) {
                    const iblock = plainText.xor(ivr);
                    const oblock = AES128(iblock, key, true);
                    return rec(i + 1, oblock, output.appendRight(oblock));
                } else {
                    const oblock = AES128(plainText, key, false);
                    const oText = oblock.xor(ivr);
                    return rec(i + 1, plainText, output.appendRight(oText));
                }
            }
        })(0, iv, new BinVector());
        out.length = message.length;
        return out;
    } else {
        throw new RangeError(
            "Input message length must be multiple of 128bits. Warning: Padding method 2 is used for EV2."
        );
    }
}

function AES_MAC_SUBK(K) {
    const L = AES128(BinVector.zero(128), K);
    const R128 = BinVector.zero(120).appendRight(
        new BinVector([1, 0, 0, 0, 0, 1, 1, 1])
    );
    const Z128 = BinVector.zero(128);
    const K1 = L.tShiftLeft(1).xor(L.msb() === 0 ? Z128 : R128);
    const K2 = K1.tShiftLeft(1).xor(K1.msb() === 0 ? Z128 : R128);
    return [K1, K2];
}

function AES_CMAC(K, M, Tlen = 128, iv = BinVector.zero(128)) {
    const Mlen = M.length;
    const n = Mlen === 0 ? 1 : Math.ceil(Mlen / 128);
    const [K1, K2] = AES_MAC_SUBK(K);
    const T = (function rec(i, output) {
        const pos = i * 128;
        const Mi = M.slice(pos - 128, pos);
        if (i === n) {
            const Mn =
                Mlen % 128 === 0
                    ? K1.xor(Mi)
                    : K2.xor(Mi.appendRight(BinVector.one(1)).paddRight(128));
            return AES128(output.xor(Mn), K);
        }
        return rec(i + 1, AES128(output.xor(Mi), K));
    })(1, iv);
    return T.slice(0, Tlen);
}

const AES = {
    enc128: function (message, key) {
        return AES128(message, key, true);
    },
    dec128: function (message, key) {
        return AES128(message, key, false);
    },
    enc_cbc: function (message, key, iv) {
        return AES_CBC(message, key, iv, true);
    },
    dec_cbc: function (message, key, iv) {
        return AES_CBC(message, key, iv, false);
    },
    CMAC: AES_CMAC,
};

module.exports = {
    AES,
};
